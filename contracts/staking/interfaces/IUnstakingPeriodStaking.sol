//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.18;

interface IUnstakingPeriodStaking {
    struct TokensToClaim {
        bool taken;
        uint256 release;
        uint256 value;
    }

    event TokensToClaimAdded(
        address indexed wallet,
        uint256 indexed round,
        uint256 amount,
        uint256 release
    );

    event TokensClaimed(address indexed wallet, uint256 amount, uint256 round);

    error NotValidUnstakingPeriod();
    error RoundDoesNotExist();
    error BeforeReleaseTime();
    error TokensAlreadyClaimed();
}
