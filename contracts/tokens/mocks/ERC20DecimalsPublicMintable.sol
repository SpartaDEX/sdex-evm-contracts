//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.18;

import {ERC20PublicMintable} from  "./ERC20PublicMintable.sol";

contract ERC20DecimalsPublicMintable is ERC20PublicMintable {
    uint8 internal _decimals;

    constructor(
        uint8 decimals_,
        string memory name_,
        string memory symbol_
    ) ERC20PublicMintable(name_, symbol_) {
        _decimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }
}
