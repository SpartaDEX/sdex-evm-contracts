import { time } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber, Contract } from "ethers";
import { ethers } from "hardhat";

describe("SpartaRewardLpLinearStaking", () => {
  let instance: Contract;
  let lpPair: Contract;
  let router: Contract;
  let weth9: Contract;
  let contractsRepository: Contract;
  let owner: SignerWithAddress;
  let treasury: SignerWithAddress;
  let tokenA: Contract;
  let acl: Contract;
  let tokenB: Contract;
  let stakedSparta: Contract;
  let spartaStaking: Contract;
  let start: number;
  let duration: number;
  let sparta: Contract;
  const tokenAmount = ethers.utils.parseEther("1000");
  const fees = ethers.utils.parseEther("0.00005");
  const spartaRewardAmount = ethers.utils.parseEther("100000");

  beforeEach(async () => {
    [owner, treasury] = await ethers.getSigners();

    const SACL = await ethers.getContractFactory("SpartaAccessControl");
    acl = await SACL.deploy(owner.address);

    const WETH9 = await ethers.getContractFactory("WETH9");
    weth9 = await WETH9.deploy();
    const SpartaDexFactory = await ethers.getContractFactory(
      "UniswapV2Factory"
    );
    const SpartaDexRouter = await ethers.getContractFactory("SpartaDexRouter");
    const factory = await SpartaDexFactory.deploy(owner.address);
    const SpartaDexPair = await ethers.getContractFactory("SpartaDexPair");
    router = await SpartaDexRouter.deploy(factory.address, weth9.address);
    const ERC20PublicMintable = await ethers.getContractFactory(
      "ERC20PublicMintable"
    );
    tokenA = await ERC20PublicMintable.deploy("TokenA", "TKA");
    sparta = await ERC20PublicMintable.deploy("Sparta", "SPT");
    tokenB = await ERC20PublicMintable.deploy("TokenB", "TKB");

    await tokenA.mint(owner.address, tokenAmount);
    await tokenB.mint(owner.address, tokenAmount);
    await sparta.mint(owner.address, spartaRewardAmount.mul(2));
    await tokenA.approve(router.address, tokenAmount);
    await tokenB.approve(router.address, tokenAmount);

    await router.addLiquidity(
      tokenA.address,
      tokenB.address,
      tokenAmount,
      tokenAmount,
      0,
      0,
      owner.address,
      (await time.latest()) + 1000
    );

    const tokenAddress = await factory.getPair(tokenA.address, tokenB.address);
    lpPair = await SpartaDexPair.attach(tokenAddress);

    const SpartaRewardLpLinearStaking = await ethers.getContractFactory(
      "SpartaRewardLpLinearStaking"
    );
    const ContractsRepository = await ethers.getContractFactory(
      "ContractsRepository"
    );
    contractsRepository = await ContractsRepository.deploy(acl.address);
    const StakedSparta = await ethers.getContractFactory("StakedSparta");
    stakedSparta = await StakedSparta.deploy(acl.address);
    const SpartaStaking = await ethers.getContractFactory("SpartaStaking");
    spartaStaking = await SpartaStaking.deploy(
      sparta.address,
      stakedSparta.address,
      acl.address,
      contractsRepository.address,
      treasury.address,
      fees
    );

    instance = await SpartaRewardLpLinearStaking.deploy(
      lpPair.address,
      sparta.address,
      acl.address,
      contractsRepository.address,
      treasury.address,
      fees
    );

    await acl.grantRole(
      await contractsRepository.REPOSITORY_OWNER(),
      owner.address
    );

    const granStakedSpartaMinterRole = await acl.grantRole(
      await acl.STAKED_SPARTA_MINTER(),
      spartaStaking.address
    );

    await contractsRepository.setContract(
      ethers.utils.solidityKeccak256(["string"], ["SPARTA_STAKING"]),
      spartaStaking.address
    );

    await sparta.transfer(spartaStaking.address, spartaRewardAmount);
    await sparta.transfer(instance.address, spartaRewardAmount);

    start = (await time.latest()) + 10;
    duration = 60 * 60 * 24 * 12;
    await granStakedSpartaMinterRole.wait();
    await spartaStaking.initialize(
      spartaRewardAmount,
      start,
      duration,
      start + 60 * 60 * 24 * 12 + time.duration.days(31)
    );

    await instance.initialize(
      spartaRewardAmount,
      duration,
      start,
      start + duration + time.duration.days(31)
    );
  });

  it("should split the reward correctly", async function () {
    const balance = await lpPair.balanceOf(owner.address);
    await lpPair.approve(instance.address, balance);
    await time.setNextBlockTimestamp(start + 1);
    await instance.stake(balance);
    await time.increase(60 * 60 * 24 * 5);
    await instance.getReward({
      value: fees,
    });
    const rewardPerToken = await instance.rewardPerToken();
    const expectedReward = rewardPerToken
      .mul(balance)
      .div(BigNumber.from(10).pow(18));

    expect(expectedReward.mul(25000).div(100000)).to.be.equal(
      await sparta.balanceOf(owner.address)
    );
  });
});
