// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.18;
import {WETH9} from "./WETH9.sol";

contract WETHMock is WETH9 {
    uint256 internal _totalSupply;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        emit Deposit(to, amount);
    }

    function withdraw(uint wad) public override {
        super.withdraw(wad);
        _totalSupply -= wad;
    }

    function totalSupply() public view override returns (uint) {
        return _totalSupply;
    }
}
