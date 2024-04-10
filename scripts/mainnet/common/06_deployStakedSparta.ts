import { ethers } from "hardhat";
import {
  deployContract,
  getContractAddress,
  getEnv,
  getNetwork,
} from "../../../utils";

async function main() {
  const networkName = await getNetwork();
  const env = getEnv();
  const spartaACAddress = await getContractAddress("SpartaAccessControl", env);
  const StakedSparta = await ethers.getContractFactory("StakedSparta");
  const stakedSparta = await deployContract(
    networkName,
    "StakedSparta",
    StakedSparta,
    [spartaACAddress],
    env
  );
  await stakedSparta.deployed();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
