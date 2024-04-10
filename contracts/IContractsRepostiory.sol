// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.18;

interface IContractsRepostiory {
    error ContractDoesNotExist();
    error OnlyRepositoryOnwer();
    error ZeroContractAddress();
    error ZeroIdentifier();
    error OwnAddress();

    event ContractRegistered(bytes32 indexed id, address addr);

    function getContract(bytes32 contractId) external view returns (address);

    function tryGetContract(bytes32 contractId) external view returns (address);

    function setContract(bytes32 contractId, address contractAddress) external;
}
