// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
@dev An implementation of the ERC20 contract which has a fixed TotalSupply at creation time
*/
contract FixSupplyToken is ERC20 {
  // solhint-disable-next-line func-visibility
  constructor(
    string memory name,
    string memory symbol,
    uint256 totalSupply
  ) ERC20(name, symbol) {
    _mint(msg.sender, totalSupply);
  }
}
