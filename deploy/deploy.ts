/* eslint-disable @typescript-eslint/no-var-requires */
import { FixSupplyToken, StakingMintableToken } from "../src/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployOptions, DeployResult } from "hardhat-deploy/types";
import { Deployment } from "hardhat-deploy/dist/types";
import { DECIMAL_PRECISION } from "../test/utils/helpers";

interface DeploymentsMap {
  [key: string]: Deployment
}

const {ethers} = require("hardhat");

const gasSettings = {gasPrice: "1000000000"}; //{maxFeePerGas: "300", maxPriorityFeePerGas: "10"}
//used to keep code small and pretty
const deploymentResults: DeploymentsMap = {};

type DeploymentFunction = (name: string, options: DeployOptions) => Promise<DeployResult>;

function getDeployFunction(basicDeployFunction: DeploymentFunction) {
  return async function deployAndGetContract(contractName: string,
                                             deployer: string,
                                             args: any[] = [],
                                             deploymentName: string = contractName) {
    const ContractFactory = await ethers.getContractFactory(contractName);

    let result = await basicDeployFunction(deploymentName, {
      contract: contractName,
      from: deployer,
      args: args,
      log: true,
      ...gasSettings
    });
    deploymentResults[deploymentName] = result;
    // @ts-ignore
    return ContractFactory.attach(result.receipt.contractAddress);
  };
}

/* eslint-disable no-undef */
// @ts-ignore
module.exports = async ({deployments, network}: HardhatRuntimeEnvironment) => {

  const {deploy} = deployments;
  const deployAndGetContract = getDeployFunction(deploy);

  const accounts = await ethers.provider.listAccounts();
  const deployer = accounts[0];
  const sl = accounts[1];
  const minter = accounts[2];

  const slu = await deployAndGetContract("FixSupplyToken", deployer,
      [
        "Super Loyal Utility Token",
        "SLU",
        [sl], [DECIMAL_PRECISION.mul(1e9)]
      ], "SLU") as FixSupplyToken;
  const bp = await deployAndGetContract(
      "StakingMintableToken",
      deployer,
      [
        "Test Brand Token",
        "BPT",
        sl,
        slu.address,
        DECIMAL_PRECISION.mul(1e6)
      ],
      "BP") as StakingMintableToken;
  await bp.addMinter(minter)
  await (await slu.connect((await ethers.getSigners())[1]).transfer(bp.address, DECIMAL_PRECISION.mul(1e6))).wait();
  console.log(`minting is enabled ${await bp.canMint()}`)
  console.log(`SLU deployed to ${slu.address}`)
  console.log(`BP deployed to ${bp.address}`)

}
