// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.18;

import {IUniswapV2Router01} from "../interfaces/IUniswapV2Router01.sol";

contract RouterEventEmitter {
    event Amounts(uint[] amounts);

    receive() external payable {}

    function swapExactTokensForTokens(
        address router,
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external {
        (bool success, bytes memory returnData) = router.delegatecall(
            abi.encodeWithSelector(
                IUniswapV2Router01(router).swapExactTokensForTokens.selector,
                amountIn,
                amountOutMin,
                path,
                to,
                deadline
            )
        );
        assert(success);
        emit Amounts(abi.decode(returnData, (uint[])));
    }

    function swapTokensForExactTokens(
        address router,
        uint amountOut,
        uint amountInMax,
        address[] calldata path,
        address to,
        uint deadline
    ) external {
        (bool success, bytes memory returnData) = router.delegatecall(
            abi.encodeWithSelector(
                IUniswapV2Router01(router).swapTokensForExactTokens.selector,
                amountOut,
                amountInMax,
                path,
                to,
                deadline
            )
        );
        assert(success);
        emit Amounts(abi.decode(returnData, (uint[])));
    }
}
