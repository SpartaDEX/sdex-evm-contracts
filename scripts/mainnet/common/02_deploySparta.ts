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
  const Sparta = await ethers.getContractFactory("Sparta");
  const config = await getDeployConfig();
  const tokenWallet = config["tokenWallet"];

  if (!tokenWallet) {
    throw new Error("Token wallet not defined!");
  }

  const sparta = await deployContract(
    networkName,
    "Sparta",
    Sparta,
    [tokenWallet],
    env
  );
  await sparta.deployed();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
