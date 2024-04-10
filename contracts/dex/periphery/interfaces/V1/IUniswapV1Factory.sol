// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.18;

interface IUniswapV1Factory {
    function getExchange(address) external view returns (address);
}
