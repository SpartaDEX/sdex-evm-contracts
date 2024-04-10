//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.18;

import {SpartaDexPair} from "../dex/core/SpartaDexPair.sol";
import {LinearStaking} from "./LinearStaking.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";

contract LpLinearStaking is LinearStaking {
    constructor(
        SpartaDexPair _lpToken,
        IERC20 _reward,
        IAccessControl _acl,
        address _treasury,
        uint256 _value
    )
        LinearStaking(
            IERC20(address(_lpToken)),
            _reward,
            _acl,
            _treasury,
            _value
        )
    {}
}
