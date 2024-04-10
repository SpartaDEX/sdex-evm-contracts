import { time } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber, Contract } from "ethers";
import { ethers } from "hardhat";

describe("SpartaStaking", async () => {
  let instance: Contract;
  let acl: Contract;
  let sparta: Contract;
  let stakedSparta: Contract;
  let contractsRepository: Contract;
  let stakingOwner: SignerWithAddress;
  let staker: SignerWithAddress;
  let treasury: SignerWithAddress;
  const stakingDuration = time.duration.seconds(1000000);
  const spartaRewardAmount = ethers.utils.parseEther("1000000");
  const stakedTokens = ethers.utils.parseEther("1");
  const fees = ethers.utils.parseEther("0.00005");
  const stakingTime = 100;
  let stakingStart: number;

  beforeEach(async () => {
    [stakingOwner, staker, treasury] = await ethers.getSigners();
    const SpartaAccessControl = await ethers.getContractFactory(
      "SpartaAccessControl"
    );
    stakingStart = (await time.latest()) + 100000;
    acl = await SpartaAccessControl.deploy(stakingOwner.address);
    const ERC20PublicMintable = await ethers.getContractFactory(
      "ERC20PublicMintable"
    );
    sparta = await ERC20PublicMintable.deploy("Sparta", "SPT");
    const StakedSparta = await ethers.getContractFactory("StakedSparta");
    stakedSparta = await StakedSparta.deploy(acl.address);
    const SpartaStaking = await ethers.getContractFactory("SpartaStaking");
    const ContractsRepository = await ethers.getContractFactory(
      "ContractsRepository"
    );
    contractsRepository = await ContractsRepository.deploy(acl.address);
    await acl.grantRole(
      await contractsRepository.REPOSITORY_OWNER(),
      stakingOwner.address
    );
    instance = await SpartaStaking.deploy(
      sparta.address,
      stakedSparta.address,
      acl.address,
      contractsRepository.address,
      treasury.address,
      fees
    );
    contractsRepository.setContract(
      ethers.utils.solidityKeccak256(["string"], ["SPARTA_STAKING"]),
      instance.address
    );

    const granStakedSpartaMinterRole = await acl.grantRole(
      await acl.STAKED_SPARTA_MINTER(),
      instance.address
    );

    await granStakedSpartaMinterRole.wait();
  });

  async function mintTokens(to: string, amount: number | BigNumber) {
    const mintingTx = await sparta.mint(to, amount);
    await mintingTx.wait();
  }

  async function mintTokensToContract() {
    await mintTokens(instance.address, spartaRewardAmount);
  }

  async function initialize() {
    await instance
      .connect(stakingOwner)
      .initialize(
        spartaRewardAmount,
        stakingStart,
        stakingDuration,
        stakingStart + stakingDuration + time.duration.days(31)
      );
  }

  async function calculateRatio() {
    const totalSupply: BigNumber = await instance.totalSupply();
    if (totalSupply.isZero()) {
      return totalSupply;
    }
    const rewardRate = await instance.rewardRate();
    return rewardRate.div(totalSupply);
  }

  async function calculateRewardInTime(staked: BigNumber, duration: number) {
    const ratio = await calculateRatio();
    const totalSupply = await instance.totalSupply();
    return ratio
      .mul(staked)
      .mul(duration)
      .mul(ethers.utils.parseEther("1"))
      .div(totalSupply);
  }

  async function approveTokens() {
    await sparta.connect(staker).approve(instance.address, stakedTokens);
  }

  async function mintTokensToStakerAndApprove() {
    await mintTokens(staker.address, stakedTokens);
    await approveTokens();
  }

  it("should revert when not owner want to initialize contract", async () => {
    await expect(
      instance
        .connect(staker)
        .initialize(
          spartaRewardAmount,
          stakingStart,
          stakingDuration,
          stakingStart + stakingDuration + time.duration.days(31)
        )
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("should revert when the owner try to initialize already initialized contract", async () => {
    await mintTokensToContract();
    await initialize();
    await expect(
      instance
        .connect(stakingOwner)
        .initialize(
          spartaRewardAmount,
          stakingStart,
          stakingDuration,
          stakingStart + stakingDuration + time.duration.days(31)
        )
    ).to.be.revertedWithCustomError(instance, "AlreadyInitialized");
  });

  it("should revert when the owner try to initialize contract and the balance is enough", async () => {
    await sparta
      .connect(stakingOwner)
      .mint(stakingOwner.address, spartaRewardAmount);
    await expect(
      instance
        .connect(stakingOwner)
        .initialize(
          spartaRewardAmount,
          stakingStart,
          stakingDuration,
          stakingStart + stakingDuration + time.duration.days(31)
        )
    ).to.be.revertedWithCustomError(instance, "RewardBalanceTooSmall");
  });

  it("should allow the contract owner initialize the staking", async () => {
    await mintTokensToContract();
    await sparta
      .connect(stakingOwner)
      .mint(stakingOwner.address, spartaRewardAmount);
    await expect(
      instance
        .connect(stakingOwner)
        .initialize(
          spartaRewardAmount,
          stakingStart,
          stakingDuration,
          stakingStart + stakingDuration + time.duration.days(31)
        )
    ).to.not.be.reverted;
  });

  it("should revert the staking when the staking is not initialized", async function () {
    await mintTokensToStakerAndApprove();
    await expect(
      instance.connect(staker).stake(stakedTokens)
    ).to.revertedWithCustomError(instance, "NotInitialized");
  });

  it("should allow a wallet with sparta to stake tokens", async function () {
    await mintTokensToContract();
    await mintTokensToStakerAndApprove();
    await initialize();
    await time.setNextBlockTimestamp(stakingStart);
    await instance.connect(staker).stake(stakedTokens);
  });

  it("should mint stakedSparta to the wallet that staking tokens", async function () {
    await mintTokensToContract();
    await mintTokensToStakerAndApprove();
    await initialize();
    await time.setNextBlockTimestamp(stakingStart);
    await instance.connect(staker).stake(stakedTokens);
    expect(await stakedSparta.balanceOf(staker.address)).to.be.equal(
      stakedTokens
    );
  });

  it("should properly calculate the reward", async () => {
    await mintTokensToContract();
    await mintTokensToStakerAndApprove();
    await initialize();
    await time.increaseTo(stakingStart);
    await instance.connect(staker).stake(stakedTokens);
    await time.increase(stakingTime);
    const ratio = await calculateRatio();
    const balance = await instance.balanceOf(staker.address);
    expect(await balance.mul(ratio).mul(stakingTime)).to.be.equal(
      await instance.earned(staker.address)
    );
  });

  it("should allow user to take his reward", async () => {
    await mintTokensToContract();
    await mintTokensToStakerAndApprove();
    await initialize();
    await time.setNextBlockTimestamp(stakingStart);
    await instance.connect(staker).stake(stakedTokens);
    const start = await time.latest();
    await time.increase(stakingTime);
    const balanceBefore = await sparta.balanceOf(staker.address);
    await instance.connect(staker).getReward({
      value: fees,
    });
    const finish = await time.latest();
    const balance = await sparta.balanceOf(staker.address);
    const expectedReward = await calculateRewardInTime(
      stakedTokens,
      finish - start
    );
    const expectedBalance = balanceBefore + expectedReward;
    expect(expectedBalance).to.be.equal(balance);
  });

  it("should revert when user try to withdraw the tokens that does not have", async () => {
    await mintTokensToContract();
    await mintTokensToStakerAndApprove();
    await initialize();

    await expect(
      instance.connect(staker).unstake(stakedTokens, time.duration.days(10), {
        value: fees,
      })
    ).to.be.revertedWithCustomError(instance, "CannotUnstake");
  });

  it("should revert when the user try to withdraw tokens and didn't approve the contract to burn tokens", async () => {
    await mintTokensToContract();
    await mintTokensToStakerAndApprove();
    await initialize();
    await time.setNextBlockTimestamp(stakingStart);
    await instance.connect(staker).stake(stakedTokens);
    await expect(
      instance.connect(staker).unstake(stakedTokens, time.duration.days(11), {
        value: fees,
      })
    ).to.be.revertedWith("ERC20: insufficient allowance");
  });

  it("should burn the staked sparta tokens during unstaking tokens", async () => {
    await mintTokensToContract();
    await mintTokensToStakerAndApprove();
    await initialize();
    await time.setNextBlockTimestamp(stakingStart);
    await instance.connect(staker).stake(stakedTokens);
    await stakedSparta.connect(staker).approve(instance.address, stakedTokens);
    const balanceBefore = await stakedSparta.balanceOf(staker.address);
    await instance
      .connect(staker)
      .unstake(stakedTokens, time.duration.days(10), {
        value: fees,
      });
    const balanceAfter = await stakedSparta.balanceOf(staker.address);
    expect(balanceBefore.sub(stakedTokens)).to.be.equal(balanceAfter);
  });

  it("should increment the number of tokens to claims after token unstake", async () => {
    await mintTokensToContract();
    await mintTokensToStakerAndApprove();
    await initialize();
    await time.setNextBlockTimestamp(stakingStart);
    await instance.connect(staker).stake(stakedTokens);
    await stakedSparta.connect(staker).approve(instance.address, stakedTokens);
    const counterBefore = await instance.userTokensToClaimCounter(
      staker.address
    );
    await instance
      .connect(staker)
      .unstake(stakedTokens, time.duration.days(10), {
        value: fees,
      });
    const counter = await instance.userTokensToClaimCounter(staker.address);
    expect(counterBefore.add(1)).to.be.equal(counter);
  });

  it("should calculate the amount of tokens to withdraw properly", async () => {
    await mintTokensToContract();
    await mintTokensToStakerAndApprove();
    await initialize();
    await time.setNextBlockTimestamp(stakingStart);
    await instance.connect(staker).stake(stakedTokens);
    await stakedSparta.connect(staker).approve(instance.address, stakedTokens);
    await instance
      .connect(staker)
      .unstake(stakedTokens, time.duration.days(10), {
        value: fees,
      });
    const counter = await instance.userTokensToClaimCounter(staker.address);
    const pendingTokens = await instance.userTokensToClaim(
      staker.address,
      counter - 1
    );

    expect(pendingTokens.value).to.be.equal(stakedTokens.div(2));
  });

  it("should revert when user try to withdraw tokens from not existing round", async () => {
    await mintTokensToContract();
    await mintTokensToStakerAndApprove();
    await initialize();
    await expect(
      instance.connect(staker).withdrawTokensToClaim(0, {
        value: fees,
      })
    ).to.revertedWithCustomError(instance, "RoundDoesNotExist");
  });

  it("should revert when user try to withdraw tokens before release time", async () => {
    await mintTokensToContract();
    await mintTokensToStakerAndApprove();
    await initialize();
    await time.setNextBlockTimestamp(stakingStart);
    await instance.connect(staker).stake(stakedTokens);
    await stakedSparta.connect(staker).approve(instance.address, stakedTokens);
    await instance
      .connect(staker)
      .unstake(stakedTokens, time.duration.days(50), {
        value: fees,
      });
    await expect(
      instance.connect(staker).withdrawTokensToClaim(0, {
        value: fees,
      })
    ).to.revertedWithCustomError(instance, "BeforeReleaseTime");
  });

  it("should allow wallet to take the pending tokens to withdraw", async () => {
    await mintTokensToContract();
    await mintTokensToStakerAndApprove();
    await initialize();
    await time.setNextBlockTimestamp(stakingStart);
    await instance.connect(staker).stake(stakedTokens);
    await stakedSparta.connect(staker).approve(instance.address, stakedTokens);
    const withdrawAfter = time.duration.days(60);
    const tokensToWithdraw = stakedTokens.mul(25).div(100);
    const tokensAsFees = tokensToWithdraw;
    const balanceTreasuryBefore = await sparta.balanceOf(treasury.address);

    await instance.connect(staker).unstake(stakedTokens, withdrawAfter, {
      value: fees,
    });

    await time.increase(withdrawAfter);
    const balanceBefore = await sparta.balanceOf(staker.address);
    await instance.connect(staker).withdrawTokensToClaim(0, {
      value: fees,
    });
    const balanceAfter = await sparta.balanceOf(staker.address);
    // after 60 days is 25% of the fee
    const balanceTreasuryAfter = await sparta.balanceOf(treasury.address);
    expect(balanceAfter.sub(balanceBefore)).to.be.equal(
      stakedTokens.sub(stakedTokens.mul(25).div(100))
    );
    expect(balanceTreasuryAfter.sub(tokensAsFees)).to.be.equal(
      balanceTreasuryBefore
    );
  });

  it("should revert when wallet try to withdraw already withdrawn tokens", async () => {
    await mintTokensToContract();
    await mintTokensToStakerAndApprove();
    await initialize();
    await time.setNextBlockTimestamp(stakingStart);
    await instance.connect(staker).stake(stakedTokens);
    await stakedSparta.connect(staker).approve(instance.address, stakedTokens);
    const withdrawAfter = time.duration.days(50);
    await instance.connect(staker).unstake(stakedTokens, withdrawAfter, {
      value: fees,
    });
    await time.increase(withdrawAfter);
    await instance.connect(staker).withdrawTokensToClaim(0, {
      value: fees,
    });
    await expect(
      instance.connect(staker).withdrawTokensToClaim(0, {
        value: fees,
      })
    ).to.be.revertedWithCustomError(instance, "TokensAlreadyClaimed");
  });
});
