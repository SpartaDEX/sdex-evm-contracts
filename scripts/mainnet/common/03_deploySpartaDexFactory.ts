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
  const admin = config["admin"];

  if (!admin) {
    throw new Error("Admin wallet not defined");
  }

  const aclAddress = await getContractAddress("SpartaAccessControl", env);
  const SpartaDexFactory = await ethers.getContractFactory("SpartaDexFactory");
  const spartaDexRouter = await deployContract(
    networkName,
    "SpartaDexFactory",
    SpartaDexFactory,
    [admin, aclAddress],
    env
  );
  await spartaDexRouter.deployed();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
