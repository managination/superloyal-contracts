/* eslint-disable @typescript-eslint/no-var-requires */
import {MintableToken, SplittableToken} from "../src/types";
import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployOptions, DeployResult} from "hardhat-deploy/types";
import {Deployment} from "hardhat-deploy/dist/types";
import {getEventsFromReceipt, toBN} from "../test/utils/helpers";

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
module.exports = async ({deployments, network}: HardhatRuntimeEnvironment) => {

    const {deploy} = deployments;
    const deployAndGetContract = getDeployFunction(deploy);

    const stableCoin = await deployAndGetContract(
        "MintableToken",
        deployer,
        ["TroveStableCoin", "BEUR"],
        "TroveStableCoin"
    );
    const ewt = await deployAndGetContract("MintableToken", deployer, ["Energy Web Token", "EWT"], "EWT");
    const eth = await deployAndGetContract("MintableToken", deployer, ["Ethereum", "ETH"], "ETH");
    const albt = await deployAndGetContract("MintableToken", deployer, ["Alliance Block Token", "ALBT"], "ALBT");
    const bonqToken = await deployAndGetContract("MintableToken", deployer, ["BonqToken", "BONQ"], "BonqToken");

    const tokenToPriceFeed = await deployAndGetContract("TokenToPriceFeed", deployer);

    const ewtPricefeed = await deployAndGetContract(
        "TestPriceFeed",
        deployer,
        [ewt.address, tokenToPriceFeed.address],
        "TestPriceFeed1"
    ) as TestPriceFeed;
    const ethPricefeed = await deployAndGetContract(
        "TestPriceFeed",
        deployer,
        [eth.address, tokenToPriceFeed.address],
        "TestPriceFeed2"
    ) as TestPriceFeed;
    const albtPriceFeed = await deployAndGetContract(
        "TestPriceFeed",
        deployer,
        [albt.address, tokenToPriceFeed.address],
        "TestPriceFeed3"
    ) as TestPriceFeed;

    let tx = await tokenToPriceFeed.setTokenPriceFeed(ewt.address, ewtPricefeed.address, 120, gasSettings);
    await tx.wait();
    tx = await tokenToPriceFeed.setTokenPriceFeed(eth.address, ethPricefeed.address, 120, gasSettings);
    await tx.wait();
    tx = await tokenToPriceFeed.setTokenPriceFeed(albt.address, albtPriceFeed.address, 120, gasSettings);
    await tx.wait();

    await (await ewtPricefeed.setPrice("5000000000000000000")).wait()
    await (await ethPricefeed.setPrice("1500000000000000000000")).wait()
    await (await albtPriceFeed.setPrice("500000000000000000")).wait()

    const troveCreator = await deployAndGetContract("TroveCreator", deployer);

    const bonqStaking = await deployAndGetContract("BONQStaking", deployer, [bonqToken.address]);

    const troveFactory = await deployAndGetContract("TroveFactory", deployer, [
        troveCreator.address,
        stableCoin.address,
        bonqStaking.address
    ]);

    tx = await troveFactory.setTokenPriceFeed(tokenToPriceFeed.address, gasSettings);
    await tx.wait();

    const mintableTokenOwner = await deployAndGetContract("MintableTokenOwner", deployer, [stableCoin.address]);

    tx = await mintableTokenOwner.addMinter(await (await ethers.getSigners())[0].getAddress(), gasSettings);
    await tx.wait();

    tx = await stableCoin.transferOwnership(mintableTokenOwner.address, gasSettings);
    await tx.wait();

    tx = await mintableTokenOwner.transferOwnership(troveFactory.address, gasSettings);
    await tx.wait();

    tx = await troveFactory.setTokenOwner(gasSettings);
    await tx.wait();

    tx = await bonqStaking.setFactory(troveFactory.address, gasSettings);
    await tx.wait();

    const communityLiquidationPool1 = await deployAndGetContract("CommunityLiquidationPool", deployer, [
        troveFactory.address,
        ewt.address
    ], "CommunityLiquidationPool1");
    const communityLiquidationPool2 = await deployAndGetContract("CommunityLiquidationPool", deployer, [
        troveFactory.address,
        eth.address
    ], "CommunityLiquidationPool2");
    const communityLiquidationPool3 = await deployAndGetContract("CommunityLiquidationPool", deployer, [
        troveFactory.address,
        albt.address
    ], "CommunityLiquidationPool3");

    const stabilityPool = await deployAndGetContract("StabilityPool", deployer, [
        troveFactory.address,
        bonqToken.address
    ]);

    const arbitragePool = await deployAndGetContract("ArbitragePool", deployer, [troveFactory.address, routerAddress]);

    tx = await arbitragePool.addToken(ewt.address);
    await tx.wait();
    tx = await arbitragePool.addToken(eth.address);
    await tx.wait();
    tx = await arbitragePool.addToken(albt.address);
    await tx.wait();

    tx = await troveFactory.setArbitragePool(arbitragePool.address, gasSettings);
    await tx.wait();

    tx = await troveFactory.setStabilityPool(stabilityPool.address, gasSettings);
    await tx.wait();

    tx = await troveFactory.setLiquidationPool(ewt.address, communityLiquidationPool1.address, gasSettings);
    await tx.wait();
    tx = await troveFactory.setLiquidationPool(eth.address, communityLiquidationPool2.address, gasSettings);
    await tx.wait();
    tx = await troveFactory.setLiquidationPool(albt.address, communityLiquidationPool3.address, gasSettings);
    await tx.wait();
    tx = await troveFactory.setStabilityPool(stabilityPool.address, gasSettings);
    await tx.wait();

    console.log("ewt", [ewt.address]);
    console.log("eth", [eth.address]);
    console.log("albt", [albt.address]);
    console.log("StableCoin deployed to:", [stableCoin.address]);
    console.log("TroveFactory deployed to:", troveFactory.address);
    console.log("TokenToPriceFeed deployed to:", tokenToPriceFeed.address);
    console.log("StabilityPool deployed to:", stabilityPool.address);
    console.log("ArbitragePool deployed to:", arbitragePool.address);
    console.log("BONQ-staking deployed to:", bonqStaking.address);
    console.log("BONQ token deployed to:", bonqToken.address);
    await setInitialState(
        [{contract: ewt, price: "5000000000000000000"}, {
            contract: eth,
            price: "1500000000000000000000"
        }, {contract: albt, price: "500000000000000000"}],
        troveFactory, network.name);
};
module.exports.skip = async (hre: HardhatRuntimeEnvironment) => {
    return hre.network.name == "mainnet";
};

async function setInitialState(tokens: { contract: MintableToken, price: string }[], troveFactory: TroveFactory, network: string) {
    let testAddresses: string[]
    if (["hardhat", "localhost", "ganache", "volta-test", "goerli-test"].find(name => name == network)) {
        testAddresses = [
            // Tests
            "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
            "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
            "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc",
            "0x90f79bf6eb2c4f870365e785982e1f101e93b906",
            "0x15d34aaf54267db7d7c367839aaf71a00a2c6a65",
            "0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc",
            "0x976ea74026e726554db657fa54763abd0c3a0aa9",
            "0x14dc79964da2c08b23698b3d3cc7ca32193d9955",
            "0x23618e81e3f5cdf7f54c3d65f7fbc0abf5b21e8f",
            "0xa0ee7a142d267c1f36714e4a8f75612f20a79720",
            "0xbcd4042de499d14e55001ccbb24a551f3b954096",
            "0x71be63f3384f5fb98995898a86b02fb2426c5788",
            "0xfabb0ac9d68b0b445fb7357272ff202c5651694a",
            "0x1cbd3b2770909d4e10f157cabc84c7264073c9ec",
            "0xdf3e18d64bc6a983f673ab319ccae4f1a57c7097",
            "0xcd3b766ccdd6ae721141f452c550ca635964ce71",
            "0x2546bcd3c84621e976d8185a91a922ae77ecec30",
            "0xbda5747bfd65f08deb54cb465eb87d40e51b197e",
            "0xdd2fd4581271e230360230f9337d5c0430bf44c0",
            "0x8626f6940e2eb28930efb4cef49b2d1f2c9c1199"
        ];
    } else {
        testAddresses = [
            // Josh
            "0xeFD866A2A285b819f9Ee248bef23Fe4a90A2aBC1",
            // Michal
            "0xCe8cfE11582f456150d6B8b89EEB3E7b4654aa8A",
            // Delia
            "0xF69Db912e1A7fE7E90D60b01a87f6CA0Eb024CE8",
            //Danyial
            "0x744D68D541C4AcC9abDC4a8fAA9E275056823f47",
            "0x6224027372486564331a85085E7bd65ac2FE2945",
            "0x0924ab8df0fA80156dD6440F4deB25f2FB566085",
            "0x087357B923B8Bcc6B510cCFA5229aB50536B0705",
            "0x38D89906b0ca475612b87D0F5db08573443B107c",
            // Micha
            "0x4A89333f9188849d9E9E7AEA6c69c8700cAae5c5",]
    }
    console.log(network, testAddresses)
    const ONE = toBN("1000000000000000000");

    for (const token of tokens) {
        console.log(`\n********** creating troves with ${await token.contract.name()}`)
        const owner = await token.contract.owner()
        const signer = await ethers.getSigner(owner)
        await (await token.contract.mint(owner, ONE.mul(1000000000))).wait();
        await (await token.contract.approve(troveFactory.address, ONE.mul(1000000000))).wait()
        for (const address of testAddresses) {
            const tx = await (await troveFactory.createTroveAndBorrow(token.contract.address, ONE.mul(10000), address, toBN(token.price).mul(5000), "0x0000000000000000000000000000000000000000")).wait();
            const event = getEventsFromReceipt(troveFactory.interface, tx, "NewTrove")[0].args
            const trove = await ethers.getContractAt("Trove", event.trove, signer) as Trove;
            console.log(`          ********** transferred ownership to ${address}`)
            await (await trove.transferOwnership(address)).wait()
        }
    }

}
