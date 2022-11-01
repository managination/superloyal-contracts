import { SplittableToken } from "../src/types";
import { expect, use } from "chai";
import { solidity } from "ethereum-waffle";
import { BigNumber, providers, Signer } from "ethers";
import { addressZero, DECIMAL_PRECISION, deployContract, getEventsFromReceipt } from "./utils/helpers";
import { describe } from "mocha";
import { ethers } from "hardhat";

use(solidity);

// Start test block
describe("Splittable Tokens", function () {
  this.timeout(10000);

  let accounts: string[];
  const wallets: Signer[] = [];
  let provider: providers.JsonRpcProvider;
  let splittableToken: SplittableToken;

  function findTransferEvent(events: any[], fromAddress: string, toAddress: string, amount: BigNumber): any {
    return events.find((t) => {
      return t.args.from == fromAddress && t.args.to == toAddress && (amount.eq(t.args.value) || amount.lt(0));
    });
  }

  beforeEach(async function () {
    provider = ethers.provider;
    accounts = await provider.listAccounts();
    // accounts = ["0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"]
    // wallets.push(new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", provider))
    for (const account of accounts) {
      wallets.push(provider.getSigner(account));
    }
  });

  describe("token constructor", function () {
    it("deploys a token contract and mints all the tokens into a single account", async function () {
      const deployment = (splittableToken = (await deployContract(wallets[0], "SplittableToken", [
        "Billion Token for Test",
        "BTT",
        [accounts[0]],
        [DECIMAL_PRECISION.mul(1e9)]
      ])) as SplittableToken);
      await splittableToken.deployed();
      const tx = await ethers.provider.getTransactionReceipt(deployment.deployTransaction.hash);
      expect(
          findTransferEvent(
              getEventsFromReceipt(splittableToken.interface, tx, "Transfer"),
              addressZero,
              accounts[0],
              DECIMAL_PRECISION.mul(1e9)
          )
      ).to.not.be.undefined;
      expect(await splittableToken.totalSupply()).to.equal(DECIMAL_PRECISION.mul(1e9));
      expect(await splittableToken.balanceOf(accounts[0])).to.equal(DECIMAL_PRECISION.mul(1e9));
    });

    it("deploys a token contract and mints all the tokens into multiple accounts", async function () {
      const splittableToken = (await deployContract(wallets[0], "SplittableToken", [
        "Billion Token for Test",
        "BTT",
        [accounts[0], accounts[1], accounts[2], accounts[3], accounts[4]],
        [
          DECIMAL_PRECISION.mul(2e8),
          DECIMAL_PRECISION.mul(2e8),
          DECIMAL_PRECISION.mul(2e8),
          DECIMAL_PRECISION.mul(2e8),
          DECIMAL_PRECISION.mul(2e8)
        ]
      ])) as SplittableToken;
      await splittableToken.deployed();
      const tx = await ethers.provider.getTransactionReceipt(splittableToken.deployTransaction.hash);
      const transfers = getEventsFromReceipt(splittableToken.interface, tx, "Transfer");
      expect(findTransferEvent(transfers, addressZero, accounts[0], DECIMAL_PRECISION.mul(2e8))).to.not.be.undefined;
      expect(findTransferEvent(transfers, addressZero, accounts[1], DECIMAL_PRECISION.mul(2e8))).to.not.be.undefined;
      expect(findTransferEvent(transfers, addressZero, accounts[2], DECIMAL_PRECISION.mul(2e8))).to.not.be.undefined;
      expect(findTransferEvent(transfers, addressZero, accounts[3], DECIMAL_PRECISION.mul(2e8))).to.not.be.undefined;
      expect(findTransferEvent(transfers, addressZero, accounts[4], DECIMAL_PRECISION.mul(2e8))).to.not.be.undefined;

      expect(await splittableToken.balanceOf(accounts[0])).to.equal(DECIMAL_PRECISION.mul(2e8));
      expect(await splittableToken.balanceOf(accounts[1])).to.equal(DECIMAL_PRECISION.mul(2e8));
      expect(await splittableToken.balanceOf(accounts[2])).to.equal(DECIMAL_PRECISION.mul(2e8));
      expect(await splittableToken.balanceOf(accounts[3])).to.equal(DECIMAL_PRECISION.mul(2e8));
      expect(await splittableToken.balanceOf(accounts[4])).to.equal(DECIMAL_PRECISION.mul(2e8));

      expect(await splittableToken.totalSupply()).to.equal(DECIMAL_PRECISION.mul(1e9));
    });

    it("throws an error if the arrays are not of equal length", async function () {
      try {
        const deployment = (splittableToken = (await deployContract(wallets[0], "SplittableToken", [
          "Billion Token for Test",
          "BTT",
          [accounts[0], accounts[1], accounts[2], accounts[3]],
          [
            DECIMAL_PRECISION.mul(2e8),
            DECIMAL_PRECISION.mul(2e8),
            DECIMAL_PRECISION.mul(2e8),
            DECIMAL_PRECISION.mul(2e8),
            DECIMAL_PRECISION.mul(2e8)
          ]
        ])) as SplittableToken);
        await splittableToken.deployed();
        expect(1).to.equal(0, "no error thrown");
      } catch (err: any) {
        expect(err.message).to.contain("arrays must have same lenght");
      }
    });
  });

  describe("token operations", function () {
    beforeEach(async function () {
      splittableToken = (await deployContract(wallets[0], "SplittableToken", [
        "Billion Token for Test",
        "BTT",
        [accounts[0]],
        [DECIMAL_PRECISION.mul(1e8)]
      ])) as SplittableToken;
      await splittableToken.deployed();
    });

    it("has an initial split ratio of 1", async function () {
      expect(await splittableToken.exponent()).to.equal(0);
      expect(await splittableToken.totalSupply()).to.equal(DECIMAL_PRECISION.mul(1e8));
    });

    it("total supply is 1 Billion", async function () {
      expect(await splittableToken.totalSupply()).to.equal(DECIMAL_PRECISION.mul(1e8));
    });

    it("the owner can increase the total supply", async function () {
      // increase supply by 5
      await splittableToken.connect(wallets[0]).increaseSupply();
      expect(await splittableToken.exponent()).to.equal(1);
      expect(await splittableToken.totalSupply()).to.equal(DECIMAL_PRECISION.mul(2e8));
      // increase supply by 1
      await splittableToken.connect(wallets[0]).increaseSupply();
      expect(await splittableToken.exponent()).to.equal(2);
      expect(await splittableToken.totalSupply()).to.equal(DECIMAL_PRECISION.mul(4e8));
    });

    it("when the owner increases the supply an event is emited", async function () {
      await expect(splittableToken.connect(wallets[0]).increaseSupply())
          .to.emit(splittableToken, "IncreaseSupply")
          .withArgs(1);
    });

    it("anyone can transfer tokens", async function () {
      let tx = await (await splittableToken.transfer(accounts[1], DECIMAL_PRECISION)).wait();
      let transfers = getEventsFromReceipt(splittableToken.interface, tx, "Transfer");
      expect(transfers.length).to.equal(1);
      expect(findTransferEvent(transfers, accounts[0], accounts[1], DECIMAL_PRECISION)).to.not.be.undefined;
      expect(await splittableToken.balanceOf(accounts[1])).to.equal(DECIMAL_PRECISION);

      tx = await (await splittableToken.connect(wallets[1]).transfer(accounts[2], DECIMAL_PRECISION)).wait();
      transfers = getEventsFromReceipt(splittableToken.interface, tx, "Transfer");
      expect(transfers.length).to.equal(1);
      expect(findTransferEvent(transfers, accounts[1], accounts[2], DECIMAL_PRECISION)).to.not.be.undefined;
      expect(await splittableToken.balanceOf(accounts[2])).to.equal(DECIMAL_PRECISION);
    });

    it("multiplier is increased only once if to and from are the same", async function () {
      await (await splittableToken.connect(wallets[0]).increaseSupply()).wait();
      const tx = await (await splittableToken.connect(wallets[0]).transfer(accounts[0], DECIMAL_PRECISION)).wait();
      const transfers = getEventsFromReceipt(splittableToken.interface, tx, "Transfer");
      expect(transfers.length).to.equal(2);
      expect(findTransferEvent(transfers, addressZero, accounts[0], DECIMAL_PRECISION.mul(1e8))).to.not.be.undefined;
      expect(findTransferEvent(transfers, accounts[0], accounts[0], DECIMAL_PRECISION)).to.not.be.undefined;
    });

    it("when the owner increases the supply already credited accounts are increased", async function () {
      await splittableToken.transfer(accounts[1], DECIMAL_PRECISION);
      await splittableToken.connect(wallets[0]).increaseSupply();
      expect(await splittableToken.balanceOf(accounts[1])).to.equal(DECIMAL_PRECISION.mul(2));
    });

    it("accounts only benefit from increases after they receive tokens", async function () {
      await splittableToken.transfer(accounts[6], DECIMAL_PRECISION.mul(100));
      let w6balance = DECIMAL_PRECISION.mul(100);
      for (let i = 1; i <= 5; i++) {
        await splittableToken.connect(wallets[0]).increaseSupply();
        await splittableToken.connect(wallets[6]).transfer(accounts[i], DECIMAL_PRECISION);
        w6balance = w6balance.mul(2).sub(DECIMAL_PRECISION);
        expect(await splittableToken.balanceOf(accounts[6])).to.equal(w6balance);
        expect(await splittableToken.totalSupply()).to.equal(DECIMAL_PRECISION.mul(1e8).mul(2 ** i));
      }

      for (let i = 1; i <= 5; i++) {
        expect(await splittableToken.balanceOf(accounts[i])).to.equal(
            DECIMAL_PRECISION.mul(2 ** (5 - i)),
            `failed at account ${i}`
        );
        expect(await splittableToken.userExponents(accounts[i])).to.equal(i, `failed at account ${i}`);
      }

      let sum = DECIMAL_PRECISION.mul(0);
      for (let i = 0; i < 10; i++) {
        sum = sum.add(await splittableToken.balanceOf(accounts[i]));
      }
      expect(sum.div(DECIMAL_PRECISION)).to.equal((await splittableToken.totalSupply()).div(DECIMAL_PRECISION));
    });

    it("balances are increased correctly even if the account is not updated between increases", async function () {
      await (await splittableToken.increaseSupply()).wait();

      await splittableToken.transfer(accounts[6], DECIMAL_PRECISION.mul(100));
      let w6balance = DECIMAL_PRECISION.mul(100);
      for (let i = 1; i <= 5; i++) {
        await splittableToken.connect(wallets[0]).increaseSupply();
        const amount = DECIMAL_PRECISION; //.mul(Math.floor(Math.random() * 1000000) ).div(1000000);
        // console.log(amount.toString())
        await splittableToken.connect(wallets[6]).transfer(accounts[i], amount);
        w6balance = w6balance.mul(2).sub(amount);
        expect(await splittableToken.balanceOf(accounts[6])).to.equal(w6balance);
        expect(await splittableToken.totalSupply()).to.equal(DECIMAL_PRECISION.mul(1e8).mul(2 ** (i + 1)));
      }

      for (let i = 1; i <= 5; i++) {
        expect(await splittableToken.balanceOf(accounts[i])).to.equal(
            DECIMAL_PRECISION.mul(2 ** (5 - i)),
            `failed at account ${i}`
        );
        expect(await splittableToken.userExponents(accounts[i])).to.equal(i + 1, `failed at account ${i}`);
      }

      let sum = DECIMAL_PRECISION.mul(0);
      for (let i = 0; i < 10; i++) {
        if ((await splittableToken.balanceOf(accounts[i])).gt(0)) {
          let events = 2;
          if ((await splittableToken.userExponents(accounts[i])).eq(await splittableToken.exponent())) events = 1;
/*
          console.log(
              `account ${i} balance ${await splittableToken.balanceOf(
                  accounts[i]
              )} exponent ${await splittableToken.userExponents(accounts[i])}`
          );
*/
          const tx = await (await splittableToken.connect(wallets[i]).transfer(accounts[i], 0)).wait();
          const transfers = getEventsFromReceipt(splittableToken.interface, tx, "Transfer");
          expect(transfers.length).to.equal(events, `account ${i} failed`);
          expect(findTransferEvent(transfers, accounts[i], accounts[i], DECIMAL_PRECISION.mul(0))).to.not.be.undefined;
          if (events == 2)
            expect(findTransferEvent(transfers, addressZero, accounts[i], DECIMAL_PRECISION.mul(-1))).to.not.be
                .undefined;
          sum = sum.add(await splittableToken.balanceOf(accounts[i]));
        }
      }
      expect(sum).to.equal(await splittableToken.totalSupply());
    });

    describe("working with increased balances", function () {
      beforeEach(async function () {
        for (let i = 1; i <= 5; i++) {
          await splittableToken.transfer(accounts[i], DECIMAL_PRECISION.mul(100));
        }
        await splittableToken.connect(wallets[0]).increaseSupply();
      });

      it("tokens are minted only into the sender account if recipient account has zero balance", async function () {
        const senderSigner = wallets[1];
        const sender = accounts[1];
        const recipient = accounts[6];

        expect(await splittableToken.userExponents(sender)).to.equal(0);
        expect(await splittableToken.userExponents(recipient)).to.equal(0);

        const tx = await (
            await splittableToken.connect(senderSigner).transfer(recipient, DECIMAL_PRECISION.mul(25).div(10))
        ).wait();
        const transfers = getEventsFromReceipt(splittableToken.interface, tx, "Transfer");
        expect(transfers.length).to.equal(2);
        expect(findTransferEvent(transfers, addressZero, sender, DECIMAL_PRECISION.mul(100))).to.not.be.undefined;
        expect(findTransferEvent(transfers, sender, recipient, DECIMAL_PRECISION.mul(25).div(10))).to.not.be.undefined;
        // no minting into zero balance addresses
        expect(findTransferEvent(transfers, addressZero, recipient, DECIMAL_PRECISION.mul(-1))).to.be.undefined;

        expect(await splittableToken.userExponents(sender)).to.equal(1);
        expect(await splittableToken.userExponents(recipient)).to.equal(1);
      });

      it("tokens are minted into sender and recipient accounts if recipient account has non zero balance", async function () {
        const senderSigner = wallets[1];
        const sender = accounts[1];
        const recipient = accounts[2];

        expect(await splittableToken.userExponents(sender)).to.equal(0);
        expect(await splittableToken.userExponents(recipient)).to.equal(0);

        const tx = await (
            await splittableToken.connect(senderSigner).transfer(recipient, DECIMAL_PRECISION.mul(25).div(10))
        ).wait();
        const transfers = getEventsFromReceipt(splittableToken.interface, tx, "Transfer");
        expect(transfers.length).to.equal(3);
        expect(findTransferEvent(transfers, addressZero, sender, DECIMAL_PRECISION.mul(100))).to.not.be.undefined;
        expect(findTransferEvent(transfers, sender, recipient, DECIMAL_PRECISION.mul(25).div(10))).to.not.be.undefined;
        expect(findTransferEvent(transfers, addressZero, recipient, DECIMAL_PRECISION.mul(100))).to.not.be.undefined;

        expect(await splittableToken.userExponents(sender)).to.equal(1);
        expect(await splittableToken.userExponents(recipient)).to.equal(1);
      });

      it("the token holder can transfer the increased tokens", async function () {
        const senderSigner = wallets[1];
        const sender = accounts[1];
        const recipient = accounts[6];

        // 100 were transferred before the increase, hence the balance is 200
        const tx = await (
            await splittableToken.connect(senderSigner).transfer(recipient, DECIMAL_PRECISION.mul(125))
        ).wait();
        const transfers = getEventsFromReceipt(splittableToken.interface, tx, "Transfer");
        expect(transfers.length).to.equal(2);
        expect(findTransferEvent(transfers, addressZero, sender, DECIMAL_PRECISION.mul(100))).to.not.be.undefined;
        expect(findTransferEvent(transfers, sender, recipient, DECIMAL_PRECISION.mul(125))).to.not.be.undefined;
      });

      it("the tokens are increased only once", async function () {
        const senderSigner = wallets[1];
        const sender = accounts[1];
        const recipient = accounts[6];

        let tx = await (
            await splittableToken.connect(senderSigner).transfer(recipient, DECIMAL_PRECISION.mul(125))
        ).wait();
        let transfers = getEventsFromReceipt(splittableToken.interface, tx, "Transfer");
        expect(transfers.length).to.equal(2);
        expect(findTransferEvent(transfers, addressZero, sender, DECIMAL_PRECISION.mul(100))).to.not.be.undefined;
        expect(findTransferEvent(transfers, sender, recipient, DECIMAL_PRECISION.mul(125))).to.not.be.undefined;

        expect(await splittableToken.balanceOf(recipient)).to.equal(DECIMAL_PRECISION.mul(125));
        expect(await splittableToken.balanceOf(sender)).to.equal(DECIMAL_PRECISION.mul(75));

        tx = await (await splittableToken.connect(senderSigner).transfer(recipient, DECIMAL_PRECISION.mul(75))).wait();
        transfers = getEventsFromReceipt(splittableToken.interface, tx, "Transfer");
        expect(transfers.length).to.equal(1);
        expect(findTransferEvent(transfers, sender, recipient, DECIMAL_PRECISION.mul(75))).to.not.be.undefined;
        expect(await splittableToken.balanceOf(recipient)).to.equal(DECIMAL_PRECISION.mul(200));
        expect(await splittableToken.balanceOf(sender)).to.equal(0);
      });
    });
  });
});
