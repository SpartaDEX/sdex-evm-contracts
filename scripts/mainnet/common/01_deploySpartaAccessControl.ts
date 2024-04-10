import { ethers } from "hardhat";
import {
  deployContract,
  getDeployConfig,
  getEnv,
  getNetwork,
} from "../../../utils";

async function main() {
  const networkName = await getNetwork();
  const env = getEnv();
  const config = await getDeployConfig();
  const SpartaAccessControl = await ethers.getContractFactory(
    "SpartaAccessControl"
  );
  const admin = config["admin"];

  if (!admin) {
    throw new Error("Admin wallet not defined");
  }

  const spartaAC = await deployContract(
    networkName,
    "SpartaAccessControl",
    SpartaAccessControl,
    [admin],
    env
  );

  await spartaAC.deployed();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
