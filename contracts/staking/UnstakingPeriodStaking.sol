//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.18;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IUnstakingPeriodStaking} from "./interfaces/IUnstakingPeriodStaking.sol";

contract UnstakingPeriodStaking is IUnstakingPeriodStaking {
    using SafeERC20 for IERC20;

    mapping(address => uint256) public userTokensToClaimCounter;
    mapping(address => mapping(uint256 => TokensToClaim))
        public userTokensToClaim;

    function _withdrawTokensToClaim(
        IERC20 token_,
        uint256 round_
    ) public payable {
        TokensToClaim storage tokensToClaim = userTokensToClaim[msg.sender][
            round_
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
        token_.safeTransfer(msg.sender, tokensToClaim.value);

        tokensToClaim.taken = true;

        emit TokensClaimed(msg.sender, tokensToClaim.value, round_);
    }
}
