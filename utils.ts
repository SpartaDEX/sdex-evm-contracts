import { Provider } from "@ethersproject/abstract-provider";
import { BigNumber, Contract } from "ethers";
import * as fs from "fs";
import { ethers } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import * as path from "path";
import { Environment } from "./types";

export function getConfigDir(): string {
  return path.join(process.cwd(), "config");
}

export function getDeployConfig(): { [key: string]: string | number } {
  try {
    return JSON.parse(
      fs
        .readFileSync(path.join(getConfigDir(), `deploymentConfig.json`))
        .toString()
    );
  } catch (e) {
    return {};
  }
}

export function getConfigFileByName(filename: string): {
  [key: string]: string | number;
} {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(getConfigDir(), filename)).toString()
    );
  } catch (e) {
    return {};
  }
}

export function getContractAddresses(
  network: string,
  env: Environment = Environment.LOCAL
): {
  [key: string]: string | null;
} {
  try {
    return JSON.parse(
      fs
        .readFileSync(
          path.join(getConfigDir(), `${env}_${network}_contractAddresses.json`)
        )
        .toString()
    );
  } catch (e) {
    return {};
  }
}

export function L0ChainIdToNetwork(chainId: number): string {
  switch (chainId) {
    case 10001:
      return "rinkeby";
    case 10002:
      return "bnbt";
    case 10004:
      return "ropsten";
    case 10006:
      return "fuji";
    case 10009:
      return "maticmum";
    case 10010:
      return "arbitrum_rinkeby";
    case 10011:
      return "optimism_kovan";
    case 10012:
      return "fantom_testnet";
    case 1:
      return "homestead";
    case 2:
      return "bnb";
    case 9:
      return "matic";
    case 6:
      return "avax_mainnet";
  }

  throw new Error("Invalid chain id");
}

export function writeContractAddresses(
  network: string,
  contractAddresses: { [key: string]: string | null },
  env: Environment = Environment.LOCAL
) {
  fs.writeFileSync(
    path.join(getConfigDir(), `${env}_${network}_contractAddresses.json`),
    JSON.stringify(contractAddresses, null, 4) // Indent 2 spaces
  );
}

export function getDomainNameAndTxData(): {
  [key: string]: { txHash: string; topLevelDomainAddress: string };
} {
  try {
    return JSON.parse(
      fs
        .readFileSync(path.join(getConfigDir(), `Domain_tx_data_and_name.json`))
        .toString()
    );
  } catch (e) {
    return {};
  }
}

export function checkAndWriteDomainNameAndTxData(
  domainName: string,
  txHash: string,
  topLevelDomainAddress: string
) {
  let domains = { ...getDomainNameAndTxData() };
  domains[domainName] = { txHash, topLevelDomainAddress };
  fs.writeFileSync(
    path.join(getConfigDir(), `Domain_tx_data_and_name.json`),
    JSON.stringify(domains, null, 4) // Indent 2 spaces
  );
}

export function getTLDNameAndTxData(): {
  [key: string]: string | null;
} {
  try {
    return JSON.parse(
      fs
        .readFileSync(path.join(getConfigDir(), `TLD_tx_data_and_name.json`))
        .toString()
    );
  } catch (e) {
    return {};
  }
}

export function checkAndWriteTLDNameAndTxData(TLDName: string, txHash: string) {
  let TLDs = { ...getTLDNameAndTxData() };
  TLDs[TLDName] = txHash;
  fs.writeFileSync(
    path.join(getConfigDir(), `TLD_tx_data_and_name.json`),
    JSON.stringify(TLDs, null, 4) // Indent 2 spaces
  );
}

export function writeVerificationData(
  constructorArguments: any[],
  address: string
) {
  fs.writeFileSync(
    path.join(process.cwd(), "scripts", `verify.json`),
    JSON.stringify(
      {
        constructorArguments,
        address,
      },
      null,
      4
    ) // Indent 2 spaces
  );
}

export function readVerificationData(): { [key: string]: string | number } {
  try {
    return JSON.parse(
      fs
        .readFileSync(path.join(process.cwd(), "scripts", `verify.json`))
        .toString()
    );
  } catch (e) {
    return {};
  }
}

export function getFirstMigration(): number {
  const config = getDeployConfig();
  if (config["lastMigration"] == undefined) {
    return 1;
  }

  return config["lastMigration"] as number;
}

async function saveVerificationData(
  networkName: string,
  contractName: string,
  contractAddress: string,
  ctorParams: any[],
  env: Environment = Environment.LOCAL
) {
  let addresses = { ...getContractAddresses(networkName, env) };
  addresses[contractName] = contractAddress;
  writeContractAddresses(networkName, addresses, env);

  fs.writeFileSync(
    path.join(getConfigDir(), `${networkName}_verify_${contractName}.js`),
    "module.exports = " + JSON.stringify(ctorParams, null, 4) + ";"
  );
  console.log(
    `To verify contract\n 'npx hardhat verify --constructor-args config/${networkName}_verify_${contractName}.js ${contractAddress} --network ${networkName}'`
  );
  writeVerificationData(ctorParams, contractAddress);
}

export async function deployContractDeterministically(
  hre: HardhatRuntimeEnvironment,
  fromAddress: string,
  networkName: string,
  contractName: string,
  ctorParamTypes: any[],
  ctorParamValues: any[],
  salt: string,
  env: Environment = Environment.LOCAL
) {
  console.log(
    `Deploys ${contractName} deterministically with salt: ${salt}, ctorParams: ${ctorParamValues} (${ctorParamTypes})`
  );
  const contractAddresses = getContractAddresses(networkName);

  if (contractAddresses["SimpleFactory"] == undefined)
    throw new Error("SimpleFactory address is missing");

  const ContractFactory = await hre.ethers.getContractFactory(contractName);
  const bytecode = ContractFactory.bytecode;

  const SimpleFactory = await hre.ethers.getContractFactory("SimpleFactory");
  const factoryInstance = await SimpleFactory.attach(
    contractAddresses["SimpleFactory"]
  );
  const saltHash = hre.ethers.utils.solidityKeccak256(["string"], [salt]);
  const deploymentBytecode = await buildBytecode(
    ctorParamTypes,
    ctorParamValues,
    bytecode,
    hre
  );
  const deploymentAddress = await buildCreate2Address(
    saltHash,
    deploymentBytecode,
    hre,
    factoryInstance.address
  );
  const tx = await factoryInstance.deployCreate2(deploymentBytecode, saltHash);
  await tx.wait();

  await saveVerificationData(
    networkName,
    contractName,
    deploymentAddress,
    ctorParamValues,
    env
  );

  return deploymentAddress;
}

export async function buildCreate2Address(
  saltHex: string,
  byteCode: string,
  hre: HardhatRuntimeEnvironment,
  factoryAddress: string
) {
  return `0x${ethers.utils
    .keccak256(
      `0x${["ff", factoryAddress, saltHex, hre.ethers.utils.keccak256(byteCode)]
        .map((x) => x.replace(/0x/, ""))
        .join("")}`
    )
    .slice(-40)}`.toLowerCase();
}

export async function buildBytecode(
  constructorTypes: any[],
  constructorArgs: any[],
  contractBytecode: string,
  hre: HardhatRuntimeEnvironment
) {
  return `${contractBytecode}${(
    await encodeParams(constructorTypes, constructorArgs, hre)
  ).slice(2)}`;
}

export async function buildBeaconCreate2Address(
  hre: HardhatRuntimeEnvironment,
  networkName: string,
  saltHex: string,
  blueprintName: string
) {
  const BeaconProxyFactory = await hre.ethers.getContractFactory("BeaconProxy");
  const bytecode = BeaconProxyFactory.bytecode;

  const contractAddresses = getContractAddresses(networkName);
  if (contractAddresses["ContractFactory"] == undefined) {
    throw new Error("ContractFactory address is missing");
  }

  const ContractFactory = await hre.ethers.getContractFactory(
    "ContractFactory"
  );
  const factoryInstance = await ContractFactory.attach(
    contractAddresses["ContractFactory"]
  );
  const beaconAddr = await factoryInstance.beacons(blueprintName);

  const deploymentBytecode = await buildBytecode(
    ["address", "bytes"],
    [beaconAddr, []],
    bytecode,
    hre
  );
  return await buildCreate2Address(
    saltHex,
    deploymentBytecode,
    hre,
    contractAddresses["ContractFactory"]
  );
}

export async function encodeParams(
  dataTypes: any[],
  data: any[],
  hre: HardhatRuntimeEnvironment
) {
  return hre.ethers.utils.defaultAbiCoder.encode(dataTypes, data);
}

// @ts-ignore
export async function deployContract(
  networkName: string,
  contractName: string,
  contractFactory: ethers.ContractFactory,
  ctorParams: any[] = [],
  env: Environment = Environment.LOCAL
) {
  console.log(`Deploys ${contractName}`);
  const contractInstance = await contractFactory.deploy(...ctorParams);
  await contractInstance.deployed();

  await saveVerificationData(
    networkName,
    contractName,
    contractInstance.address,
    ctorParams,
    env
  );

  return contractInstance;
}

// @ts-ignore
export async function verifyAfterDeployment(
  networkName: string,
  contractName: string,
  ctorParams: any[],
  contractAddress: string
) {
  let addresses = { ...getContractAddresses(networkName) };
  addresses[contractName] = contractAddress;

  fs.writeFileSync(
    path.join(getConfigDir(), `${networkName}_verify_${contractName}.js`),
    "module.exports = " + JSON.stringify(ctorParams, null, 4) + ";"
  );
  console.log(
    `To verify contract\n 'npx hardhat verify --constructor-args config/${networkName}_verify_${contractName}.js ${contractAddress} --network ${networkName}'`
  );
  writeVerificationData(ctorParams, contractAddress);
}

export async function getNetworkName(provider: Provider) {
  const network = await provider.getNetwork();
  if (network.name === "unknown") {
    switch (network.chainId) {
      case 4002:
        return "fantom_testnet";
      case 43113:
        return "fuji";
      case 43114:
        return "avax_mainnet";
    }
  } else if (network.name === "arbitrum-rinkeby") {
    return "arbitrum_rinkeby";
  } else if (network.name === "optimism-kovan") {
    return "optimism_kovan";
  } else return network.name;
}

export function getSelectors(contract: Contract, toIgnore?: Array<string>) {
  const signatures = Object.keys(contract.interface.functions);
  let ret = [];
  for (const sig of signatures) {
    if (!toIgnore || !toIgnore.includes(sig)) {
      ret.push(contract.interface.getSighash(sig));
    }
  }

  return ret;
}

export function getSelectorsForFacets(
  contract: Contract,
  toIgnore?: Array<string>
) {
  const signatures = Object.keys(contract.interface.functions);
  let ret = [];
  const _toIgnore = toIgnore
    ? toIgnore
    : ["init(bytes)", "initialize(bytes)", "cleanUp()"];

  for (const sig of signatures) {
    if (
      !_toIgnore.includes(sig) &&
      !sig.startsWith("_") &&
      !sig.startsWith("encode") &&
      !sig.startsWith("initialize")
    ) {
      ret.push(contract.interface.getSighash(sig));
    }
  }

  return ret;
}

export function getSelectorsWithFunctionsForFacets(
  contract: Contract,
  toIgnore?: Array<string>
) {
  const signatures = Object.keys(contract.interface.functions);
  let ret = [];
  const _toIgnore = toIgnore
    ? toIgnore
    : ["init(bytes)", "initialize(bytes)", "cleanUp()"];

  for (const sig of signatures) {
    if (
      !_toIgnore.includes(sig) &&
      !sig.startsWith("_") &&
      !sig.startsWith("encode") &&
      !sig.startsWith("initialize")
    ) {
      ret.push({
        function: sig,
        selector: contract.interface.getSighash(sig),
      });
    }
  }

  return ret;
}

export function getFacetsMapping(
  contract: Contract,
  toIgnore?: Array<string>
): Array<{
  function: string;
  selector: string;
}> {
  const signatures = Object.keys(contract.interface.functions);
  let ret = [];
  const _toIgnore = toIgnore
    ? toIgnore
    : ["init(bytes)", "initialize(bytes)", "cleanUp()"];

  for (const sig of signatures) {
    if (
      !_toIgnore.includes(sig) ||
      sig.startsWith("_") ||
      sig.startsWith("encode")
    ) {
      ret.push({
        function: sig,
        selector: contract.interface.getSighash(sig),
      });
    }
  }

  return ret;
}

export const getBlockchainTimestamp = async (
  offset?: number
): Promise<BigNumber> => {
  const provider = ethers.providers.getDefaultProvider();
  const latestBlock = await provider.getBlock("latest");
  const now = (await provider.getBlock(latestBlock.number)).timestamp;
  const offset_ = offset ? offset : 0;
  return BigNumber.from(now + offset_);
};

export const getEnv = (): Environment => {
  const config = getDeployConfig();
  const envString: string | undefined = config["env"] as string | undefined;
  if (!envString) {
    throw new Error("env not set in deploymentConfig");
  }

  return envString as Environment;
};

export const getFeesTo = (): string => {
  const config = getDeployConfig();
  const feesTo: string | undefined = config["feesTo"] as string | undefined;
  if (!feesTo) {
    throw new Error("feesTo not set in deploymentConfig");
  }

  return feesTo;
};

export const getFeesToSetter = (): string => {
  const config = getDeployConfig();
  const feesTo: string | undefined = config["feesToSetter"] as
    | string
    | undefined;
  if (!feesTo) {
    throw new Error("feesTo not set in deploymentConfig");
  }

  return feesTo;
};

export const getNetwork = async (): Promise<string> => {
  const [owner] = await ethers.getSigners();
  return (await owner.provider?.getNetwork())?.name as string;
};

export const getContractAddress = async (
  contract: string,
  env: Environment = Environment.LOCAL
): Promise<string> => {
  const addresses = getContractAddresses(await getNetwork(), env);
  const address = addresses[contract];
  if (!address) {
    throw new Error(`Cannot get ${contract} address for env: ${env}`);
  }
  return address;
};
