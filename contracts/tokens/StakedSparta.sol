//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.18;

import {IAccessControlHolder, IAccessControl} from "../IAccessControlHolder.sol";
import {IStakedSparta} from "./interfaces/IStakedSparta.sol";

import {ERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract StakedSparta is IAccessControlHolder, IStakedSparta, ERC20 {
    IAccessControl public immutable override acl;

    error OperationNotAllowed();

    constructor(IAccessControl _acl) ERC20("sSPARTA", "sSPARTA") {
        acl = _acl;
    }

    bytes32 public constant STAKED_SPARTA_MINTER =
        keccak256("STAKED_SPARTA_MINTER");

    function transferFrom(
        address,
        address,
        uint256
    ) public virtual override(IERC20, ERC20) returns (bool) {
        revert OperationNotAllowed();
    }

    function transfer(
        address,
        uint256
    ) public virtual override(IERC20, ERC20) returns (bool) {
        revert OperationNotAllowed();
    }

    function approve(
        address spender,
        uint256 amount
    ) public virtual override(IERC20, ERC20) returns (bool) {
        if (!acl.hasRole(STAKED_SPARTA_MINTER, spender)) {
            revert OperationNotAllowed();
        }

        _approve(msg.sender, spender, amount);
        return true;
    }

    function mintTo(
        address to,
        uint256 amount
    ) external override onlyStakedSpartaMinterRoleAccess {
        _mint(to, amount);
    }

    function burnFrom(
        address wallet,
        uint256 amount
    ) external override onlyStakedSpartaMinterRoleAccess {
        _spendAllowance(wallet, msg.sender, amount);
        _burn(wallet, amount);
    }

    modifier onlyStakedSpartaMinterRoleAccess() {
        if (!acl.hasRole(STAKED_SPARTA_MINTER, msg.sender)) {
            revert OperationNotAllowed();
        }
        _;
    }
}
