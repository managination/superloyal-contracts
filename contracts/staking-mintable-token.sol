// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/access/Ownable.sol";


/// @title implements minting/burning functionality for owner
contract StakingMintableToken is ERC20, Ownable, AccessControl {
  IERC20 immutable stakedToken;
  address immutable superloyal;
  uint256 public requiredBalance;
  bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

  modifier onlyMinter() {
    require(hasRole(MINTER_ROLE, msg.sender), "address is missing MINTER_ROLE");
    _;
  }

  // solhint-disable-next-line func-visibility
  constructor(string memory name,
    string memory symbol,
    address _superloyal,
    address _stakedToken,
    uint256 _requiredBalance) ERC20(name, symbol) {
    requiredBalance = _requiredBalance;
    superloyal = _superloyal;
    stakedToken = IERC20(_stakedToken);
    _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    addMinter(msg.sender);
  }

  function setRequiredBalance(uint256 _requiredBalance) public {
    require(msg.sender == superloyal, "only superloyal can change the required stake");
    requiredBalance = _requiredBalance;
  }

  function withdrawStake() public onlyOwner {
    stakedToken.transfer(msg.sender, stakedToken.balanceOf(address(this)) - requiredBalance);
  }

  function grantRole(bytes32 role, address account) public override onlyRole(getRoleAdmin(role)) {
    super.grantRole(role, account);
  }

  function revokeRole(bytes32 role, address account) public override onlyRole(getRoleAdmin(role)) {
    super.revokeRole(role, account);
  }

  function addMinter(address _newMinter) public onlyOwner {
    grantRole(MINTER_ROLE, _newMinter);
  }

  function removeMinter(address _minter) public onlyOwner {
    revokeRole(MINTER_ROLE, _minter);
  }

  /// @dev mints tokens to the recipient, to be called from owner
  /// @param recipient address to mint
  /// @param amount amount to be minted
  function mint(address recipient, uint256 amount) public onlyMinter {
    require(stakedToken.balanceOf(address(this)) >= requiredBalance, "insufficient stake for minting");
    _mint(recipient, amount);
  }

  /// @dev burns token of specified amount from msg.sender
  /// @param amount to burn
  function burn(uint256 amount) public {
    _burn(msg.sender, amount);
  }
}
