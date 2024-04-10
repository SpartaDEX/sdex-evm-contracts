import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { Contract } from "ethers";
import { ethers } from "hardhat";

describe("MockWithFees", () => {
  let instance: Contract;
  let acl: Contract;
  const fees = ethers.utils.parseEther("0.00005");
  let owner: SignerWithAddress;
  let treasury: SignerWithAddress;
  let feesManager: SignerWithAddress;
  let notFeesManager: SignerWithAddress;
  let payer: SignerWithAddress;

  beforeEach(async () => {
    [owner, treasury, feesManager, notFeesManager, payer] =
      await ethers.getSigners();
    const SpartaAccessControl = await ethers.getContractFactory(
      "SpartaAccessControl"
    );
    acl = await SpartaAccessControl.deploy(owner.address);
    await acl.grantRole(await acl.FEES_MANAGER(), feesManager.address);
    const WithFees = await ethers.getContractFactory("MockWithFees");
    instance = await WithFees.deploy(acl.address, treasury.address, fees);
  });

  it("should revert if the fees is not correct", async () => {
    await expect(
      instance.connect(payer).mockFee()
    ).to.be.revertedWithCustomError(instance, "OnlyWithFees");
  });
  it("should allow execute if the fee is correct", async () => {
    await instance.connect(payer).mockFee({
      value: fees,
    });
  });
  it("should revert if not fees manager want to take ETH", async function () {
    await expect(
      instance.connect(notFeesManager).transfer()
    ).to.be.revertedWithCustomError(instance, "OnlyFeesManagerAccess");
  });
  it("should allow manager to take ETH", async function () {
    const balanceBefore = await instance.provider.getBalance(treasury.address);
    await instance.connect(payer).mockFee({
      value: fees,
    });
    await instance.connect(feesManager).transfer();
    expect(await instance.provider.getBalance(treasury.address)).to.be.equal(
      balanceBefore.add(fees)
    );
  });
});
