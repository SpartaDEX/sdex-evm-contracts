import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { Contract } from "ethers";
import { ethers } from "hardhat";

describe("StakedSparta", async function () {
  let instance: Contract;
  let acl: Contract;
  let deployer: SignerWithAddress;
  let stakedSpartaMinterRoleAddress: SignerWithAddress;
  let nonStakedSpartaMinterRoleAddress: SignerWithAddress;
  let tokensOwner: SignerWithAddress;

  beforeEach(async () => {
    [
      deployer,
      stakedSpartaMinterRoleAddress,
      nonStakedSpartaMinterRoleAddress,
      tokensOwner,
    ] = await ethers.getSigners();
    const SpartaAccessControl = await ethers.getContractFactory(
      "SpartaAccessControl"
    );
    acl = await SpartaAccessControl.deploy(deployer.address);
    await acl.deployed();
    const StakedSparta = await ethers.getContractFactory("StakedSparta");
    instance = await StakedSparta.deploy(acl.address);
    await instance.deployed();
    const grantRoleTx = await acl.grantRole(
      await acl.STAKED_SPARTA_MINTER(),
      stakedSpartaMinterRoleAddress.address
    );

    await grantRoleTx.wait();
  });

  it("should revert minting tokens when the signer does not have STAKED_SPARTA_MINTER_ROLE role", async function () {
    await expect(instance.mintTo(tokensOwner.address, 100)).to.be.reverted;
  });

  it("should revert tokens transfer", async function () {
    await expect(
      instance.transfer(nonStakedSpartaMinterRoleAddress.address, 100)
    ).to.be.reverted;
  });

  it("should revert tokens transfer from", async function () {
    await expect(
      instance.transferFrom(
        tokensOwner.address,
        nonStakedSpartaMinterRoleAddress.address,
        100
      )
    ).to.be.reverted;
  });

  it("should revert approving tokens access to the address without STAKED_SPARTA_MINTER_ROLE role", async function () {
    await expect(
      instance
        .connect(nonStakedSpartaMinterRoleAddress)
        .approve(tokensOwner.address, 100)
    ).to.be.reverted;
  });

  it("should revert burning tokens when the signer does not have STAKED_SPARTA_MINTER_ROLE role", async function () {
    await instance
      .connect(stakedSpartaMinterRoleAddress)
      .mintTo(tokensOwner.address, 100);
    await expect(
      instance.burnFrom(tokensOwner.address, 100)
    ).to.be.revertedWithCustomError(instance, "OperationNotAllowed");
  });

  it("should allow mint tokens when the signer has STAKED_SPARTA_MINTER_ROLE role", async () => {
    await instance
      .connect(stakedSpartaMinterRoleAddress)
      .mintTo(tokensOwner.address, 100);
    const balance = await instance.balanceOf(tokensOwner.address);
    expect(balance).to.equal(100);
  });
  it("should allow approve tokens access when the spender has STAKED_SPARTA_MINTER_ROLE role", async () => {
    await instance
      .connect(stakedSpartaMinterRoleAddress)
      .mintTo(tokensOwner.address, 100);
    await expect(
      instance
        .connect(tokensOwner)
        .approve(stakedSpartaMinterRoleAddress.address, 10)
    ).to.be.not.reverted;

    expect(
      await instance.allowance(
        tokensOwner.address,
        stakedSpartaMinterRoleAddress.address
      )
    ).to.be.equal(10);
  });
  it("should allow burn tokens access when the spender has STAKED_SPARTA_MINTER_ROLE role", async () => {
    await instance
      .connect(stakedSpartaMinterRoleAddress)
      .mintTo(tokensOwner.address, 100);
    await instance
      .connect(tokensOwner)
      .approve(stakedSpartaMinterRoleAddress.address, 10);

    await expect(
      instance
        .connect(stakedSpartaMinterRoleAddress)
        .burnFrom(tokensOwner.address, 10)
    ).to.be.not.reverted;
  });
});
