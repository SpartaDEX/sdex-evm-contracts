//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.18;

import {ERC20PublicMintable} from "./ERC20PublicMintable.sol";

contract MockStable is ERC20PublicMintable {
    constructor(
        string memory name_,
        string memory symbol_
    ) ERC20PublicMintable(name_, symbol_) {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}
