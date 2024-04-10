// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.18;

import {WithFees} from "./WithFees.sol";
import {IAccessControlHolder, IAccessControl} from "./IAccessControlHolder.sol";

contract MockWithFees is WithFees {
    constructor(
        IAccessControl _acl,
        address _treasury,
        uint256 _value
    ) WithFees(_acl, _treasury, _value) {}

    function mockFee() external payable onlyWithFees {}
}
