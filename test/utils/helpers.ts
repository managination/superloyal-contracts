import { BigNumber, Signer } from "ethers";
import { Interface } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { LogDescription } from "@ethersproject/abi/src.ts/interface";
import { TransactionReceipt } from "@ethersproject/abstract-provider";

function toBN(num: any) {
  return BigNumber.from(num.toString());
}

const addressZero = "0x0000000000000000000000000000000000000000";
const LIQUIDATION_RESERVE = toBN(1e18);
const DECIMAL_PRECISION = toBN(1e18);

function randBetween(min: number, max: number) {
  // min and max included
  return Math.floor(Math.random() * (max - min + 1) + min);
}

async function deployContract(signer: Signer, name: string, args?: any): Promise<any> {
  const factory = await ethers.getContractFactory(name);
  args = args ? args : [];
  const contract = await factory.connect(signer).deploy(...args);

  await contract.deployed();

  return contract;
}

async function getContractAt(name: string, address: string) {
  const factory = await ethers.getContractFactory(name);
  return factory.attach(address);
}

function getEventsFromReceipt(
  contractInterface: Interface,
  receipt: TransactionReceipt,
  eventName = ""
): LogDescription[] {
  const events: LogDescription[] = [];
  for (const log of receipt.logs)
    try {
      const event = contractInterface.parseLog(log);
      if (event.name === eventName || eventName == "") {
        events.push(event);
      }
    } catch (err) {
      // do nothing
    }
  return events;
}

export {
  toBN,
  randBetween,
  deployContract,
  getContractAt,
  addressZero,
  getEventsFromReceipt,
  LIQUIDATION_RESERVE,
  DECIMAL_PRECISION
};
