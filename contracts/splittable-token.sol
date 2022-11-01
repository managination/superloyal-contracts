// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

//import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title implements minting/burning functionality for owner
contract SplittableToken is ERC20, Ownable {
  uint256 public initialSupply;
  // initial multiplier is 100% or 1
  uint256 public exponent;
  // the userMultipliers start by being zero and increase in step with the multiplier
  mapping(address => uint256) public userExponents;

  event IncreaseSupply(uint256 multiplier);

  // solhint-disable-next-line func-visibility
  constructor(
    string memory name,
    string memory symbol,
    address[] memory _initialHolders,
    uint256[] memory _initialBalances
  ) ERC20(name, symbol) {
    require(_initialHolders.length == _initialBalances.length, "arrays must have same lenght");
    uint256 _initialSupply = 0;
    for (uint256 i = 0; i < _initialHolders.length; i++) {
      _initialSupply += _initialBalances[i];
      _mint(_initialHolders[i], _initialBalances[i]);
    }
    initialSupply = _initialSupply;
  }

  function totalSupply() public view override returns (uint256) {
    return (initialSupply * (2**exponent));
  }

  function _beforeTokenTransfer(
    address from,
    address to,
    uint256 amount
  ) internal override {
    // do not check balances for mint
    if (from != address(0x0)) {
      _checkBalance(from);
      _checkBalance(to);
    }
  }

  function _checkBalance(address _account) private {
    uint256 mainExp = exponent;
    uint256 userExp = userExponents[_account];
    if (mainExp > userExp) {
      uint256 accBalance = super.balanceOf(_account);
      if (accBalance > 0) {
        _mint(_account, accBalance * ((2**(mainExp - userExp)) - 1));
      }
      userExponents[_account] = mainExp;
    }
  }

  function balanceOf(address _account) public view override returns (uint256) {
    return super.balanceOf(_account) * (2**(exponent - userExponents[_account]));
  }

  /// @dev the supply is increased by the multiplier: The multiplier always refers to the initialSupply
  function increaseSupply() public onlyOwner {
    exponent += 1;
    emit IncreaseSupply(exponent);
  }
}
