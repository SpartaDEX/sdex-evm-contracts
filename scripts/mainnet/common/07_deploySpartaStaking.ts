import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import {
  deployContract,
  getContractAddress,
  getDeployConfig,
  getEnv,
  getNetwork,
} from "../../../utils";

async function main() {
  const networkName = await getNetwork();
  const env = getEnv();
  const config = await getDeployConfig();
  const start = config["start"] as number;
  if (!start) {
    throw new Error("start not stored in config");
  }
  const end = config["end"] as number;
  if (!end) {
    throw new Error("end not stored in config");
  }
  const treasury = config["treasury"] as string;
  if (!treasury) {
    throw new Error("treasury not stored in config");
  }
  const amountRaw = config["amount"] as string;
  if (!amountRaw) {
    throw new Error("amount not stored in config");
  }
  const amount = BigNumber.from(amountRaw);
  const unlock = 60 * 60 * 24 * 32 + end;

  const SpartaStaking = await ethers.getContractFactory("SpartaStaking");
  const SpartaAccessControl = await ethers.getContractFactory(
    "SpartaAccessControl"
  );
  const contractsRepositoryAddress = await getContractAddress(
    "ContractsRepository",
    env
  );
  const spartaAddress = await getContractAddress("Sparta", env);
  const stakedSpartaAddress = await getContractAddress("StakedSparta", env);
  const spartaACAddress = await getContractAddress("SpartaAccessControl", env);
  const spartaAccessControl = await SpartaAccessControl.attach(spartaACAddress);

  const spartaStaking = await deployContract(
    networkName,
    "SpartaStaking",
    SpartaStaking,
    [
      spartaAddress,
      stakedSpartaAddress,
      spartaACAddress,
      contractsRepositoryAddress,
      treasury,
      ethers.utils.parseEther("0.0005"),
    ],
    env
  );

  const Sparta = await ethers.getContractFactory("Sparta");
  const sparta = await Sparta.attach(spartaAddress);
  console.log("transfer");
  const transferTx = await sparta.transfer(spartaStaking.address, amount);
  await transferTx.wait();

  const duration = end - start;

  console.log("initialziation");
  const initSpartaStakingTx = await spartaStaking.initialize(
    amount,
    start,
    duration,
    unlock
  );

  await initSpartaStakingTx.wait();

  const roleTx = await spartaAccessControl.grantRole(
    await spartaAccessControl.STAKED_SPARTA_MINTER(),
    spartaStaking.address
  );

  await roleTx.wait();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
