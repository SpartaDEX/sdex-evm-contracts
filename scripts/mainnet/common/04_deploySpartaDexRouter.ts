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

  const wNative = config["wNative"];
  if (!wNative) {
    throw new Error("Wrapped native not available");
  }

  const SpartaDexRouter = await ethers.getContractFactory("SpartaDexRouter");
  const factoryAddress = await getContractAddress("SpartaDexFactory", env);
  const spartaDexRouter = await deployContract(
    networkName,
    "SpartaDexRouter",
    SpartaDexRouter,
    [factoryAddress, wNative],
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
