//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.18;

import {IStakedSparta} from "../tokens/interfaces/IStakedSparta.sol";
import {ISpartaStaking} from "./interfaces/ISpartaStaking.sol";
import {ToInitialize} from "../ToInitialize.sol";
import {WithFees} from "../WithFees.sol";
import {ZeroAddressGuard} from "../ZeroAddressGuard.sol";
import {ZeroAmountGuard} from "../ZeroAmountGuard.sol";
import {IAccessControl, IAccessControlHolder} from "../IAccessControlHolder.sol";
import {IContractsRepostiory} from "../IContractsRepostiory.sol";
import {IPredifinedUnstakingPeriodStaking} from "./interfaces/IPredifinedUnstakingPeriodStaking.sol";

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract SpartaStaking is
    ISpartaStaking,
    IPredifinedUnstakingPeriodStaking,
    ToInitialize,
    Ownable,
    WithFees,
    ZeroAddressGuard,
    ZeroAmountGuard
{
    using SafeERC20 for IERC20;

    uint256 constant UNLOCK_TIMESTAMP_MINIMUM_DIFF = 30 days;
    uint256 constant MINIML_UNSTAKING_PERIOD = 10 days;
    bytes32 constant SPARTA_STAKING_CONTRACT_ID = keccak256("SPARTA_STAKING");

    IERC20 public immutable sparta;
    IStakedSparta public immutable stakedSparta;
    IContractsRepostiory public immutable contractsRepository;
    uint256 public totalSupply;
    uint256 public rewardPerTokenStored;
    uint256 public rewardRate;
    uint256 public start;
    uint256 public updatedAt;
    uint256 public duration;
    uint256 public override unlockTokensTimestamp;
    mapping(address => uint256) public balanceOf;
    mapping(address => uint256) public rewards;
    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public userTokensToClaimCounter;
    mapping(address => mapping(uint256 => TokensToClaim))
        public userTokensToClaim;

    modifier isOngoing() {
        if (block.timestamp < start) {
            revert BeforeStakingStart();
        }
        if (finishAt() < block.timestamp) {
            revert AfterStakingFinish();
        }
        _;
    }

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        updatedAt = lastTimeRewardApplicable();

        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }

        _;
    }

    modifier canUstake(uint256 amount, uint256 duration_) {
        if (amount == 0) {
            revert ZeroAmount();
        }
        if (amount > balanceOf[msg.sender]) {
            revert CannotUnstake();
        }
        if (duration_ < MINIML_UNSTAKING_PERIOD) {
            revert MinimalUnstakingPeriod();
        }
        _;
    }

    constructor(
        IERC20 sparta_,
        IStakedSparta stakedSparta_,
        IAccessControl acl_,
        IContractsRepostiory contractRepository_,
        address treasury_,
        uint256 fees_
    ) Ownable() WithFees(acl_, treasury_, fees_) {
        sparta = sparta_;
        stakedSparta = stakedSparta_;
        contractsRepository = contractRepository_;
    }

    function stake(uint256 _amount) external {
        stakeAs(msg.sender, _amount);
    }

    function initialize(
        uint256 amount_,
        uint256 start_,
        uint256 duration_,
        uint256 unlockTokensTimestamp_
    )
        external
        notInitialized
        onlyOwner
        notZeroAmount(amount_)
        notZeroAmount(duration_)
    {
        if (sparta.balanceOf(address(this)) < amount_) {
            revert RewardBalanceTooSmall();
        }
        if (block.timestamp > start_) {
            revert StartNotValid();
        }
        if (
            start_ + duration_ + UNLOCK_TIMESTAMP_MINIMUM_DIFF >
            unlockTokensTimestamp_
        ) {
            revert NotValidUnlockTimestamp();
        }

        duration = duration_;
        start = start_;
        rewardRate = amount_ / duration_;
        updatedAt = block.timestamp;

        unlockTokensTimestamp = unlockTokensTimestamp_;
        initialized = true;

        emit Initialized(start_, duration_, amount_, unlockTokensTimestamp_);
    }

    function withdrawTokensToClaimFromRounds(
        uint256[] calldata rounds
    ) external {
        uint256 roundsLength = rounds.length;
        for (uint roundIndex = 0; roundIndex < roundsLength; ) {
            withdrawTokensToClaim(rounds[roundIndex]);
            unchecked {
                ++roundIndex;
            }
        }
    }

    function unlockTokens(
        address to,
        uint256 amount
    )
        external
        isInitialized
        notZeroAddress(to)
        notZeroAmount(amount)
        onlyOwner
    {
        if (block.timestamp < unlockTokensTimestamp) {
            revert ToEarlyToWithdrawReward();
        }
        sparta.safeTransfer(to, amount);
    }

    function moveToNextSpartaStaking()
        external
        updateReward(msg.sender)
        isInitialized
    {
        ISpartaStaking current = currentImplementation();

        uint256 balance = balanceOf[msg.sender];
        if (balance == 0) {
            revert ZeroAmount();
        }
        balanceOf[msg.sender] = 0;
        totalSupply -= balance;
        stakedSparta.burnFrom(msg.sender, balance);
        sparta.forceApprove(address(current), balance);
        current.stakeAs(msg.sender, balance);

        emit MovedToNextImplementation(msg.sender, balance, 0);
    }

    function moveToNextSpartaStakingWithReward()
        external
        isInitialized
        updateReward(msg.sender)
    {
        ISpartaStaking current = currentImplementation();
        uint256 balance = balanceOf[msg.sender];
        uint256 reward = rewards[msg.sender];
        uint256 total = balance + reward;
        stakedSparta.burnFrom(msg.sender, balance);

        if (total == 0) {
            revert ZeroAmount();
        }

        balanceOf[msg.sender] = 0;
        rewards[msg.sender] = 0;
        totalSupply -= balance;
        sparta.forceApprove(address(current), total);
        current.stakeAs(msg.sender, total);

        emit MovedToNextImplementation(msg.sender, balance, reward);
    }

    function toEnd() external view returns (uint256) {
        return block.timestamp >= finishAt() ? 0 : finishAt() - block.timestamp;
    }

    function totalLocked(address wallet) external view returns (uint256) {
        return totalPendingToClaim(wallet) + earned(wallet) + balanceOf[wallet];
    }

    function getUserAllocations(
        address _wallet
    ) external view returns (TokensToClaim[] memory) {
        uint256 counter = userTokensToClaimCounter[_wallet];
        TokensToClaim[] memory toClaims = new TokensToClaim[](counter);

        for (uint256 i = 0; i < counter; ) {
            toClaims[i] = userTokensToClaim[_wallet][i];
            unchecked {
                ++i;
            }
        }

        return toClaims;
    }

    function unstake(
        uint256 amount,
        uint256 after_
    )
        public
        payable
        onlyWithFees
        isInitialized
        canUstake(amount, after_)
        updateReward(msg.sender)
    {
        uint256 round = userTokensToClaimCounter[msg.sender];
        uint256 tokensToWidthdraw = calculateWithFee(amount, after_);
        uint256 releaseTime = after_ + block.timestamp;
        uint256 spartaFees = amount - tokensToWidthdraw;

        userTokensToClaim[msg.sender][round] = TokensToClaim(
            false,
            releaseTime,
            tokensToWidthdraw
        );

        ++userTokensToClaimCounter[msg.sender];
        balanceOf[msg.sender] -= amount;
        totalSupply -= amount;

        if (spartaFees > 0) {
            sparta.transfer(treasury, spartaFees);
        }

        stakedSparta.burnFrom(msg.sender, amount);

        emit Unstaked(msg.sender, amount, tokensToWidthdraw, releaseTime);
    }

    function stakeAs(
        address wallet,
        uint256 amount
    )
        public
        isInitialized
        isOngoing
        notZeroAddress(wallet)
        updateReward(wallet)
    {
        sparta.safeTransferFrom(msg.sender, address(this), amount);

        balanceOf[wallet] += amount;
        totalSupply += amount;
        stakedSparta.mintTo(wallet, amount);

        emit Staked(wallet, amount);
    }

    function getReward()
        public
        payable
        isInitialized
        onlyWithFees
        updateReward(msg.sender)
    {
        uint256 reward = rewards[msg.sender];
        if (reward == 0) {
            revert ZeroAmount();
        }

        sparta.safeTransfer(msg.sender, reward);
        rewards[msg.sender] = 0;

        emit RewardTaken(msg.sender, reward);
    }

    function withdrawTokensToClaim(uint256 round) public payable onlyWithFees {
        TokensToClaim storage tokensToClaim = userTokensToClaim[msg.sender][
            round
        ];
        if (tokensToClaim.release == 0) {
            revert RoundDoesNotExist();
        }
        if (block.timestamp < tokensToClaim.release) {
            revert BeforeReleaseTime();
        }
        if (tokensToClaim.taken) {
            revert TokensAlreadyClaimed();
        }
        sparta.safeTransfer(msg.sender, tokensToClaim.value);

        tokensToClaim.taken = true;

        emit TokensClaimed(msg.sender, tokensToClaim.value, round);
    }

    function finishAt() public view override returns (uint256) {
        return start + duration;
    }

    function rewardPerToken() public view returns (uint) {
        if (totalSupply == 0 || block.timestamp < start) {
            return rewardPerTokenStored;
        }

        return
            rewardPerTokenStored +
            (rewardRate * (lastTimeRewardApplicable() - updatedAt) * 1e18) /
            totalSupply;
    }

    function lastTimeRewardApplicable() public view returns (uint) {
        return _min(finishAt(), block.timestamp);
    }

    function earned(address _account) public view returns (uint256) {
        return
            ((balanceOf[_account] *
                (rewardPerToken() - userRewardPerTokenPaid[_account])) / 1e18) +
            rewards[_account];
    }

    function totalPendingToClaim(address wallet) public view returns (uint256) {
        uint256 toClaim = 0;
        uint256 rounds = userTokensToClaimCounter[wallet];
        for (uint256 roundIndex = 0; roundIndex < rounds; ) {
            TokensToClaim memory tokensToClaim = userTokensToClaim[wallet][
                roundIndex
            ];
            if (!tokensToClaim.taken) {
                toClaim += tokensToClaim.value;
            }
            unchecked {
                ++roundIndex;
            }
        }
        return toClaim;
    }

    function currentImplementation() public view returns (ISpartaStaking) {
        address spartaStakingAddress = contractsRepository.getContract(
            SPARTA_STAKING_CONTRACT_ID
        );

        if (spartaStakingAddress == address(this)) {
            revert CurrentImplementation();
        }

        return SpartaStaking(spartaStakingAddress);
    }

    function calculateWithFee(
        uint256 input,
        uint256 _duration
    ) public pure returns (uint256) {
        uint256 saturatedDuration = _duration > 110 days ? 110 days : _duration;
        uint256 feesNominator = ((110 days - saturatedDuration) * 500) / 1 days;
        uint256 feesOnAmount = (input * feesNominator) / 100000;
        return input - feesOnAmount;
    }

    function _min(uint x, uint y) private pure returns (uint) {
        return x <= y ? x : y;
    }
}
