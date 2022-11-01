import { FixSupplyToken, StakingMintableToken } from "../src/types";
import { expect, use } from "chai";
import { solidity } from "ethereum-waffle";
import { before, describe } from "mocha";
import { ethers } from "hardhat";
import { SystemUnderTest } from "./utils/SystemUnderTest";
import { Signer } from "ethers";
import { addressZero } from "./utils/helpers";

use(solidity);

// Start test block
describe("Tokens", function () {
  this.timeout(10000);

  const sut = new SystemUnderTest(ethers);
  let mintableToken: StakingMintableToken;
  let fixSupplyToken: FixSupplyToken;
  let brand: Signer;
  let brandAddress: string;

  before(async function () {
    await sut.ready;
    brand = sut.wallets[1];
    brandAddress = sut.accounts[1];
  });

  beforeEach(async function () {
    mintableToken = (await sut.deployContract(brand, "StakingMintableToken", [
      "Mintable Token for Test",
      "MTT",
        sut.accounts[0],
        sut.slu.address,
        sut.ONE.mul(1e6)
    ])) as StakingMintableToken;
    await mintableToken.deployed();
  });

  it("sent all the fixed supply tokens to address 0", async function () {
    expect((await sut.slu.balanceOf(sut.accounts[0])).toString()).to.equal(sut.ONE.mul(1e9));
  });

  it("forbids non owner from minting", async function () {
    await expect(
        mintableToken.connect(sut.wallets[0]).mint(sut.accounts[1], sut.ONE)
    ).to.be.revertedWith("address is missing MINTER_ROLE");
  });

  it("no tokens can be minted if no stake has been provided", async function() {
    await expect(mintableToken.mint(sut.accounts[2], sut.ONE))
        .to.be.revertedWith("insufficient stake for minting");
  })

  it("the owner can add new minters", async function() {
    const MINTER_ROLE = await mintableToken.MINTER_ROLE()
    await expect(mintableToken.addMinter(sut.accounts[2]))
        .to.emit (mintableToken, "RoleGranted")
        .withArgs(MINTER_ROLE, sut.accounts[2], brandAddress)
    await expect(mintableToken.mint(sut.accounts[2], sut.ONE))
        .to.be.revertedWith("insufficient stake for minting");
  })

  describe("after providing stake", function () {

    beforeEach(async function() {
      await (await sut.slu.transfer(mintableToken.address, sut.ONE.mul(1e6)))
    })

    // Test case
    it("owner can mint new mintable tokens", async function () {
      await expect(mintableToken.mint(sut.accounts[2], sut.ONE.mul(10000)))
          .to.emit(mintableToken, "Transfer")
          .withArgs(addressZero, sut.accounts[2], sut.ONE.mul(10000));
    });

    it("anyone can burn mintable tokens", async function () {
      await mintableToken.mint(sut.accounts[2], sut.ONE.mul(10000));
      await expect(mintableToken.connect(sut.wallets[2]).burn(sut.ONE.mul(10000)))
          .to.emit(mintableToken, "Transfer")
          .withArgs(sut.accounts[2], addressZero, sut.ONE.mul(10000));
    });

    it("forbids non owner from minting", async function () {
      await expect(
          mintableToken.connect(sut.wallets[0]).mint(sut.accounts[1], sut.ONE.mul(10000))
      ).to.be.revertedWith("address is missing MINTER_ROLE");
    });

  })

});
