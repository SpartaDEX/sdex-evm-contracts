//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.18;

interface IPredifinedUnstakingPeriodStaking {
    struct PredifinedFee {
        uint64 percentage;
        uint128 duration;
    }

    error MinUnstakingDurationGreaterThanMax();

    function unstake(uint256 amount_, uint256 afterIndex) external payable;
}
