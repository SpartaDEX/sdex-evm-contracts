//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.18;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IStakedSparta is IERC20 {
    function mintTo(address to, uint256 amount) external;

    function burnFrom(address wallet, uint256 amount) external;
}
