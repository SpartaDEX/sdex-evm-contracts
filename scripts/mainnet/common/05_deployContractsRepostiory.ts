import { ethers } from "hardhat";
import {
  deployContract,
  getContractAddress,
  getEnv,
  getNetwork,
} from "../../../utils";

async function main() {
  const env = getEnv();
  const ContractsRepository = await ethers.getContractFactory(
    "ContractsRepository"
  );
  const spartaAccessControlAddress = await getContractAddress(
    "SpartaAccessControl",
    env
  );

  const networkName = await getNetwork();

  await deployContract(
    networkName,
    "ContractsRepository",
    ContractsRepository,
    [spartaAccessControlAddress],
    env
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
