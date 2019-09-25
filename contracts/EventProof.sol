pragma solidity ^0.5.11;
pragma experimental ABIEncoderV2;
import "./PatriciaTree.sol";


contract EventProof {
    // just a public method to test the merkle patricia proof
    function merkleProof(
        bytes memory value,
        bytes memory encodedPath,
        bytes memory rlpParentNodes,
        bytes32 root
    ) public pure returns(bool) {
        return MerklePatriciaProof.verify(
            value, encodedPath, rlpParentNodes, root
        );
    }

    /**
     * Extracts the receipts root from an rlp encoded block.
     */
    function extractReceiptsRoot(
        bytes memory rlpEncodedBlock
    ) public pure returns (bytes32 receiptsRoot) {
        // Adapted from:
        // https://github.com/figs999/Ethereum/blob/master/EventStorage.sol
        // where copyCallData is used:
        // assembly {
        //     calldatacopy(add(receiptsRoot,0), 257, 32)  //receiptRoot
        // }

        assembly {
            // rlp encoded position of receipts root is 189
            receiptsRoot := mload(add(rlpEncodedBlock, 189))
        }
    }

    /**
     * Proves a header matches the a trusted block hash, and that that header
     * contains a receipts root which itself contains a provided receipt.
     */
    function proveReceiptInclusion(
        bytes32 trustedBlockhash,
        bytes memory rlpEncodedBlockHeader,
        bytes memory rlpEncodedReceipt,
        bytes memory receiptPath,
        bytes memory receiptWitness
    ) public pure returns(bool) {
        if(trustedBlockhash != keccak256(rlpEncodedBlockHeader)) return false;

        // extract the receipts from the verified blcok header
        bytes32 receiptsRoot = extractReceiptsRoot(rlpEncodedBlockHeader);

        // use the root to prove inclusion of the receipt
        return MerklePatriciaProof.verify(rlpEncodedReceipt, receiptPath, receiptWitness, receiptsRoot);
    }

    function proveBlocks(
        bytes[] memory rlpEncodedHeaders
    ) public pure returns(bool) {
        for(uint index = rlpEncodedHeaders.length - 1; index > 0; index--){
            require(
                keccak256(rlpEncodedHeaders[index - 1]) == extractParentHash(rlpEncodedHeaders[index]),
                "Incorrect parent hash."
            );
        }
        return true;
    }

    function extractParentHash(
        bytes memory rlpEncodedHeader
    ) public pure returns(bytes32 parentHash) {
        assembly {
            // rlp encoded position of parent hash is 36
            parentHash := mload(add(rlpEncodedHeader, 36))
        }
    }
}