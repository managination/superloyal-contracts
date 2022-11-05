import { FixSupplyToken, StakingMintableToken } from "../src/types";
import { expect, use } from "chai";
import { solidity } from "ethereum-waffle";
import { before, describe } from "mocha";
import { ethers } from "hardhat";
import { SystemUnderTest } from "./utils/SystemUnderTest";
import { Signer } from "ethers";
import { addressZero } from "./utils/helpers";
import exp = require("constants");

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
    const fixSupplyToken: FixSupplyToken = (await sut.deployContract(sut.wallets[0], "FixSupplyToken", [
      "Fix Supply Token for Test",
      "FST",
      [sut.accounts[0]],
      [sut.ONE.mul(1e9)]
    ])) as FixSupplyToken;
    expect(await fixSupplyToken.balanceOf(sut.accounts[0])).to.equal(sut.ONE.mul(1e9));
    expect(await fixSupplyToken.totalSupply()).to.equal(sut.ONE.mul(1e9));
  });

  it("deploys a token contract and mints all the tokens into multiple accounts", async function () {
    const fixSupplyToken: FixSupplyToken = (await sut.deployContract(sut.wallets[0], "FixSupplyToken", [
      "Billion Token for Test",
      "BTT",
      [sut.accounts[0], sut.accounts[1], sut.accounts[2], sut.accounts[3], sut.accounts[4]],
      [
        sut.ONE.mul(2e8),
        sut.ONE.mul(2e8),
        sut.ONE.mul(2e8),
        sut.ONE.mul(2e8),
        sut.ONE.mul(2e8)
      ]
    ])) as FixSupplyToken;
    await fixSupplyToken.deployed();
    const tx = await ethers.provider.getTransactionReceipt(fixSupplyToken.deployTransaction.hash);
    const transfers = sut.getEventsFromReceipt(fixSupplyToken.interface, tx, "Transfer");
    expect(sut.findTransferEvent(transfers, addressZero, sut.accounts[0], sut.ONE.mul(2e8))).to.not.be.undefined;
    expect(sut.findTransferEvent(transfers, addressZero, sut.accounts[1], sut.ONE.mul(2e8))).to.not.be.undefined;
    expect(sut.findTransferEvent(transfers, addressZero, sut.accounts[2], sut.ONE.mul(2e8))).to.not.be.undefined;
    expect(sut.findTransferEvent(transfers, addressZero, sut.accounts[3], sut.ONE.mul(2e8))).to.not.be.undefined;
    expect(sut.findTransferEvent(transfers, addressZero, sut.accounts[4], sut.ONE.mul(2e8))).to.not.be.undefined;

    expect(await fixSupplyToken.balanceOf(sut.accounts[0])).to.equal(sut.ONE.mul(2e8));
    expect(await fixSupplyToken.balanceOf(sut.accounts[1])).to.equal(sut.ONE.mul(2e8));
    expect(await fixSupplyToken.balanceOf(sut.accounts[2])).to.equal(sut.ONE.mul(2e8));
    expect(await fixSupplyToken.balanceOf(sut.accounts[3])).to.equal(sut.ONE.mul(2e8));
    expect(await fixSupplyToken.balanceOf(sut.accounts[4])).to.equal(sut.ONE.mul(2e8));

    expect(await fixSupplyToken.totalSupply()).to.equal(sut.ONE.mul(1e9));
  });

  it("throws an error if the arrays are not of equal length", async function () {
    try {
      const fixSupplyToken = (await sut.deployContract(sut.wallets[0], "FixSupplyToken", [
        "Billion Token for Test",
        "BTT",
        [sut.accounts[0], sut.accounts[1], sut.accounts[2], sut.accounts[3]],
        [
          sut.ONE.mul(2e8),
          sut.ONE.mul(2e8),
          sut.ONE.mul(2e8),
          sut.ONE.mul(2e8),
          sut.ONE.mul(2e8)
        ]
      ])) as FixSupplyToken;
      await fixSupplyToken.deployed();
      expect(1).to.equal(0, "no error thrown");
    } catch (err: any) {
      expect(err.message).to.contain("arrays must have same lenght");
    }
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

  it("indicats that minting is disabled", async function() {
    expect(await mintableToken.canMint()).to.be.false
  })

  describe("after providing stake", function () {

    beforeEach(async function() {
      await (await sut.slu.transfer(mintableToken.address, sut.ONE.mul(1e6)))
    })

    it("indicats that minting is enabled", async function() {
      expect(await mintableToken.canMint()).to.be.true
    })

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

    it("the stake can be withdrawn by the owner", async function() {
      await expect(mintableToken.withdrawStake(sut.ONE.mul(5e5)))
          .to.emit(sut.slu, "Transfer")
          .withArgs(mintableToken.address, brandAddress, sut.ONE.mul(5e5))
    })

    it("if the stake is withdrawn by the owner minting is blocked", async function() {
      await mintableToken.withdrawStake(sut.ONE.mul(5e5))
      await expect(mintableToken.mint(sut.accounts[2], sut.ONE))
          .to.be.revertedWith("insufficient stake for minting");
    })

  })

});
