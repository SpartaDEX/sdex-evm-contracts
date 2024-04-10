// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.18;

interface IUniswapV2Migrator {
    function migrate(
        address token,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    ) external;
}