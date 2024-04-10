//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.18;

interface IStakingCore {
    event Staked(address indexed account, uint256 value);
    event Unstaked(address indexed account, uint256 value);

    function balanceOf(address account) external view returns (uint256);

    function lastTimeRewardApplicable() external view returns (uint256);

    function totalSupply() external view returns (uint256);

    function exit() external;

    function getReward() external;

    function stake(uint256 amount) external;

    function unstake(uint256 amount) external;
}
