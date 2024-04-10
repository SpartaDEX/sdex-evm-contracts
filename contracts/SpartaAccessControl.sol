// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.18;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ZeroAddressGuard} from "./ZeroAddressGuard.sol";

/**
 * @title SpartaAccessControl
 * @notice This contract is used for managing access across different roles in the Sparta smart contract system.
 */
contract SpartaAccessControl is AccessControl, ZeroAddressGuard {
    /// @notice Role allowed to register staking contracts
    bytes32 public constant STAKING_REGISTRATOR =
        keccak256("STAKING_REGISTRATOR");

    /// @notice Role allowed to mint staked SPARTA tokens
    bytes32 public constant STAKED_SPARTA_MINTER =
        keccak256("STAKED_SPARTA_MINTER");

    /// @notice Role allowed to manage fees in the system
    bytes32 public constant FEES_MANAGER = keccak256("FEES_MANAGER");

    /// @notice Role allowed to create pair on SpartaDexFactory
    bytes32 public constant PAIR_CREATOR = keccak256("PAIR_CREATOR");

    /// @notice Role allowed to add Liquidity on SpartaDexRouter
    bytes32 public constant LIQUIDITY_PROVIDER =
        keccak256("LIQUIDITY_PROVIDER");

    /// @notice Role allowed to turn off liqudiity controlling in sparta dex.
    bytes32 public constant LIQUIDITY_CONTROLLER =
        keccak256("LIQUIDITY_CONTROLLER");

    constructor(address _admin) notZeroAddress(_admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
    }
}
