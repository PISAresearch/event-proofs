import "mocha";
import * as chai from "chai";
import { EventProof } from "../build/EventProof";
import * as EventProofDefinition from "../build/EventProof.json";
import { deployContract, solidity, createFixtureLoader } from "ethereum-waffle";
import { ethers } from "ethers";
import { BigNumber, RLP } from "ethers/utils";
import * as Ganache from "ganache-core";
import { Web3Provider } from "ethers/providers";
import * as LevelUp from "levelup";
import EncodingDown from "encoding-down";
import LevelDOWN from "leveldown";
const { GetProof } = require("eth-proof");
const expect = chai.expect;
chai.use(solidity);

const secret = "0x82f969af00133dbdaf37693b2de5c1ab9038d0b189720b9c9266ae89346e8586";
const ganache = (Ganache as any).provider({
    gasLimit: 8000000,
    accounts: [{ balance: "0xDE0B6B3A7640000", secretKey: secret }]
});
const localProvider = new Web3Provider(ganache);
const wallet = new ethers.Wallet(secret, localProvider);
const loadFixture = createFixtureLoader(localProvider, [wallet]);
const jsonRpcUrl = "" // add your own url here
const prover = new GetProof(jsonRpcUrl);


class CachingProvider extends ethers.providers.BaseProvider {
    private readonly db: LevelUp.LevelUp<EncodingDown<string, any>>;

    constructor(private readonly baseProvider: ethers.providers.BaseProvider) {
        super(1);
        this.db = LevelUp.default(EncodingDown(LevelDOWN("db"), { valueEncoding: "json" }));
    }

    async perform(method: string, params: any) {
        const key = `${method}:${JSON.stringify(params)}`;
        try {
            return await this.db.get(key);
        } catch (doh) {
            const basePerfom = await this.baseProvider.perform(method, params);
            await this.db.put(key, basePerfom);
            return basePerfom;
        }
    }
}
const remoteProvider = new CachingProvider(
    new ethers.providers.JsonRpcProvider(jsonRpcUrl)
);

describe("EventProof", () => {
    const rlpEncodedBlock = (block: any) => {
        const selectedBlockElements = [
            block.parentHash,
            block.sha3Uncles,
            block.miner,
            block.stateRoot,
            block.transactionsRoot,
            block.receiptsRoot,
            block.logsBloom,
            block.difficulty,
            block.number,
            block.gasLimit,
            block.gasUsed === "0x0" ? "0x": block.gasUsed,
            block.timestamp,
            block.extraData,
            block.mixHash,
            block.nonce
        ];

        return RLP.encode(selectedBlockElements);
    };

    const prepareReceiptProof = (proof: any) => {
        // the path is HP encoded
        const indexBuffer = proof.txIndex.slice(2);
        const hpIndex = "0x" + (indexBuffer.startsWith("0") ? "1" + indexBuffer.slice(1) : "00" + indexBuffer);

        // the value is the second buffer in the leaf (last node)
        const value = "0x" + Buffer.from(proof.receiptProof[proof.receiptProof.length - 1][1]).toString("hex");
        // the parent nodes must be rlp encoded
        const parentNodes = RLP.encode(proof.receiptProof);

        return {
            path: hpIndex,
            rlpEncodedReceipt: value,
            witness: parentNodes
        };
    };

    const receiptToRlp = (receipt: any) => {
        const forEncoding = [
            new BigNumber(receipt.status).toHexString(),
            new BigNumber(receipt.cumulativeGasUsed).toHexString(),
            receipt.logsBloom,
            receipt.logs.map(log => [log.address, log.topics, log.data])
        ];
        return RLP.encode(forEncoding);
    };

    async function deployEventProof(provider, [wallet]) {
        return (await deployContract(wallet, EventProofDefinition)) as EventProof;
    }

    it("rlp encoding hashes correctly", async () => {
        const block = await remoteProvider.perform("getBlock", { blockTag: new BigNumber(5000079).toHexString() });
        const rlpBlock = rlpEncodedBlock(block);
        const blockHash = ethers.utils.keccak256(rlpBlock);
        expect(blockHash).to.equal(block.hash);
    }).timeout(5000);

    it("extracts receipt root", async () => {
        const eventProof = await loadFixture(deployEventProof);
        const block = await remoteProvider.perform("getBlock", { blockTag: new BigNumber(6339082).toHexString() });
        const rlpBlock = rlpEncodedBlock(block);
        const receiptsRoot = await eventProof.functions.extractReceiptsRoot(rlpBlock);
        expect(receiptsRoot).to.equal(block.receiptsRoot);
    }).timeout(5000);

    it("prove merkle inclusion", async () => {
        // known tx hash in block 6339082
        const txHash = "0x0ea44167dd31bca6a29a8f5c52fe4b73e92a7f6b9898322e8dc70478a7366806";
        const eventProof = await loadFixture(deployEventProof);
        const block = await remoteProvider.perform("getBlock", { blockTag: new BigNumber(6339082).toHexString() });
        const pr = await prover.receiptProof(txHash);
        const receiptProof = prepareReceiptProof(pr);

        const result = await eventProof.functions.merkleProof(
            receiptProof.rlpEncodedReceipt,
            receiptProof.path,
            receiptProof.witness,
            block.receiptsRoot
        );

        expect(result).to.be.true;
    }).timeout(100000);

    it("can rlp encode receipt", async () => {
        const rlpExpected =
            "0xf9016601837925c3b9010000100000000000000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000002000000000000000000000000040000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000020000000000000000000f85cf85a947ae0c8ea75428cd62fa48aca8738cff510125f2df842a0934b615ac45ae983959e39bac5d942944fe163a5b1e2b846f603224108d1f56ca0000000000000000000000000dba031ef165613ced730319c5f37ec8e316425ce80";
        const txHash = "0x3b4cfcf4dc6c43e444528b8a26138992e58020b250a804b6b3e510f75439ea0d";
        const receipt = await remoteProvider.perform("getTransactionReceipt", { transactionHash: txHash });
        const rlp = receiptToRlp(receipt);
        expect(rlp).to.equal(rlpExpected);
    }).timeout(4000);

    it("prove header and receipt inclusion", async () => {
        const txHash = "0x0ea44167dd31bca6a29a8f5c52fe4b73e92a7f6b9898322e8dc70478a7366806";
        const eventProof = await loadFixture(deployEventProof);
        
        const block = await remoteProvider.perform("getBlock", { blockTag: new BigNumber(6339082).toHexString() });
        const pr = await prover.receiptProof(txHash);
        const receiptProof = prepareReceiptProof(pr);
        const rlpBlock = rlpEncodedBlock(block);

        const result = await eventProof.functions.proveReceiptInclusion(
            block.hash,
            rlpBlock,
            receiptProof.rlpEncodedReceipt,
            receiptProof.path,
            receiptProof.witness
        );
        expect(result).to.be.true;
    }).timeout(100000);

    it("extract parent hash", async () => {
        const eventProof = await loadFixture(deployEventProof);
        const block = await remoteProvider.perform("getBlock", { blockTag: new BigNumber(5000079).toHexString() });
        const rlpBlock = rlpEncodedBlock(block);
        const parentHash = await eventProof.functions.extractParentHash(rlpBlock);
        expect(parentHash).to.equal(block.parentHash);
    });

    it("prove block hashes", async () => {
        const blockHeaders = [];
        const startIndex = 5000000;
        for (let index = startIndex; index < startIndex + 3; index++) {
            const block = await remoteProvider.perform("getBlock", { blockTag: new BigNumber(index).toHexString() });
            blockHeaders.push(rlpEncodedBlock(block));
        }
        const eventProof = await loadFixture(deployEventProof);
        const result = await eventProof.functions.proveBlocks(blockHeaders);
        
        expect(result).to.equal(true);
    }).timeout(100000);
});