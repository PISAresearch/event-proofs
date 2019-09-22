import "mocha";
import * as chai from "chai";
import { EventProof } from "../build/EventProof";
import * as EventProofDefinition from "../build/EventProof.json";
import { deployContract, solidity, loadFixture } from "ethereum-waffle";
import { ethers } from "ethers";
import { BigNumber, RLP } from "ethers/utils";
const { GetProof } = require("eth-proof");
const expect = chai.expect;
chai.use(solidity);

describe("EventProof", () => {
    // 6339082 on ropsten

    // tx hash in that block - 0x3b4cfcf4dc6c43e444528b8a26138992e58020b250a804b6b3e510f75439ea0d
    const block = {
        difficulty: "0x1b00af4b0",
        extraData: "0xde830204058f5061726974792d457468657265756d86312e33342e30826c69",
        gasLimit: "0x7a121d",
        gasUsed: "0x7977cb",
        hash: "0x6a80d3a40c3ccd5ca1d2094bca78e0717e120bc2fc54aa2c0b466197cd6041d7",
        logsBloom:
            "0x013000400000808000000100a000000140000000420100010008000102058000000810002002410001000400010020020000000480000000000200200000004000100000024000204002101800002004000000000000020080032000202024000000402000000001001010000044a000800000002000ac00011080500021004c0300010040200820048004000401040100000433000021a0040000080000000000000504000000080010208004500448980400000000080000019220000010010040004a860002400040006000800c000800000300004400400081014040002202000008000000000000008000010200000000400801210540200000a8200000",
        miner: "0x3dea9963bf4c1a3716025de8ae05a5cac66db46e",
        mixHash: "0xd729a47678d7952ef0ed00bdc3ac69d09eb7905e0e9a7cc03ed4e7bfc3d398ae",
        nonce: "0xe31f10001fd65688",
        number: "0x60ba0a",
        parentHash: "0x7d3ff957f4ddb1232bc8a84219fa2651ae4828a41e324ac4fb3e108321c1586e",
        receiptsRoot: "0x8351fdd35fb45615f12f98ecbf74f0d4cab4746bb2341642094ee85e0d47cb7e",
        sha3Uncles: "0x7f07bb03366d2a9e1ea39b28c3b7839f8de5459bb9251520d055eee346016e8a",
        size: "0x2f97",
        stateRoot: "0xd893e5ef2e16e3f759ff3499909e6c90491cc451c23aa933a964984cbbba1380",
        timestamp: "0x5d724e95",
        totalDifficulty: "0x51031e033dc855",
        transactions: [],
        transactionsRoot: "0xaf498ce6ca2f72e9488693c6f61a8aea92f6f79f92a79f3e99f943ab7699b3bb",
        uncles: ["0xf25a51c81290eebee3bb3bfbd51461a195c3c18af2c80a84e24426183bc42b81"]
    };

    const rlpEncodedBlock = (block: any) => {
        // struct BlockHeader {
        //     bytes32 parentHash;
        //     bytes32 sha3Uncles;
        //     address miner;
        //     bytes32 stateRoot;
        //     bytes32 transactionsRoot;
        //     bytes32 receiptsRoot;
        //     bytes logsBloom;
        //     uint256 difficulty;
        //     uint32 number;
        //     uint32 gasLimit;
        //     uint32 gasUsed;
        //     uint32 timestamp;
        //     bytes extraData;
        //     bytes32 mixHash;
        //     uint8 nonce;
        // }

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
            block.gasUsed,
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

    const receiptToRlp = (receipt: ethers.providers.TransactionReceipt) => {
        const forEncoding = [
            new BigNumber(receipt.status).toHexString(),
            receipt.cumulativeGasUsed.toHexString(),
            receipt.logsBloom,
            receipt.logs.map(log => [log.address, log.topics, log.data])
        ];
        return RLP.encode(forEncoding);
    };

    async function deployEventProof(provider, [wallet]) {
        return (await deployContract(wallet, EventProofDefinition)) as EventProof;
    }

    it("rlp encoding hashes correctly", async () => {
        const rlpBlock = rlpEncodedBlock(block);
        const blockHash = ethers.utils.keccak256(rlpBlock);
        expect(blockHash).to.equal(block.hash);
    });

    it("extracts receipt root", async () => {
        const eventProof = await loadFixture(deployEventProof);
        const rlpBlock = rlpEncodedBlock(block);
        const receiptsRoot = await eventProof.functions.extractReceiptsRoot(rlpBlock);
        expect(receiptsRoot).to.equal(block.receiptsRoot);
    });

    it("prove merkle inclusion", async () => {
        // get a proof for a root - then try to prove it using prove-eth?
        const txHash = "0x0ea44167dd31bca6a29a8f5c52fe4b73e92a7f6b9898322e8dc70478a7366806";
        const eventProof = await loadFixture(deployEventProof);
        const prover = new GetProof("https://ropsten.infura.io/v3/e587e78efcdd4c1eb5b068ee99a6ec0b");
        const pr = await prover.receiptProof(txHash);
        const receiptProof = prepareReceiptProof(pr);

        const result = await eventProof.functions.merkleProof(
            receiptProof.rlpEncodedReceipt,
            receiptProof.path,
            receiptProof.witness,
            block.receiptsRoot
        );

        expect(result).to.be.true;
    }).timeout(10000);

    it("can rlp encode receipt", async () => {
        const rlpExpected =
            "0xf9016601837925c3b9010000100000000000000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000002000000000000000000000000040000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000020000000000000000000f85cf85a947ae0c8ea75428cd62fa48aca8738cff510125f2df842a0934b615ac45ae983959e39bac5d942944fe163a5b1e2b846f603224108d1f56ca0000000000000000000000000dba031ef165613ced730319c5f37ec8e316425ce80";
        const txHash = "0x3b4cfcf4dc6c43e444528b8a26138992e58020b250a804b6b3e510f75439ea0d";
        const provider = new ethers.providers.JsonRpcProvider(
            "https://ropsten.infura.io/v3/e587e78efcdd4c1eb5b068ee99a6ec0b"
        );
        const receipt = await provider.getTransactionReceipt(txHash);
        const rlp = receiptToRlp(receipt);
        expect(rlp).to.equal(rlpExpected);
    }).timeout(4000);

    it("prove header and receipt inclusion", async () => {
        const txHash = "0x0ea44167dd31bca6a29a8f5c52fe4b73e92a7f6b9898322e8dc70478a7366806";
        const eventProof = await loadFixture(deployEventProof);
        const prover = new GetProof("https://ropsten.infura.io/v3/e587e78efcdd4c1eb5b068ee99a6ec0b");
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
    }).timeout(5000);
});


