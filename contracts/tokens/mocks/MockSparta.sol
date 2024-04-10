//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.18;

import {Sparta} from "../Sparta.sol";

contract MockSparta is Sparta {
    constructor() Sparta(msg.sender) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
