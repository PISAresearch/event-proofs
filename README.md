# Event proofs

A POC to explore how Ethereum logs could be verified in a smart contract. Proofs are generated using eth-proof and verified using the Merkle Patricia Tree implementation from Peace Relay. If running the tests against Infura be patient with them as generating proofs requires a lot of rpc calls.

## Future Ethereum improvements

### Accumulators
One nice improvement would be to include an RSA accumulator, (like in Plasma Prime),of the logs in each header. The accumulator should accumulate the previous accumulator and all the new logs in the current block. The difference between two accumulators from any two blocks could then be used to prove the inclusion/exclusion of a log in the whole range between the two blocks.

### Reducing header verification costs
Another small improvement would be to hash the logs bloom prior to including it into the header. This would mean a second hashing operation when creating the header, but at the moment when supplying header data to the chain for verification the whole logs bloom needs to be included.

## Related projects: 

### [EventStorage](https://github.com/figs999/Ethereum/blob/master/EventStorage.sol)
EventStorage.sol by Chance Santana-Wees verifies the header against a trusted hash, then uses the logs bloom to prove inclusion. Unfortunately, this method suffers from possible collision attacks in the bloom, see this. In PISA's case we would need to protect against potentially strong opponents so we couldn't use this approach. I encourage you to check out Chance's other contracts though, my personal favourite is the EVMVM :)

### [Proveth](https://github.com/lorenzb/proveth)
This project by a team at 2018 IC3 Boot camp aims to standardise the Merkle proofs required for receipts, state and transactions. They create proofs in python, and have working verification for transactions.

### [PeaceRelay](https://github.com/KyberNetwork/peace-relay)
Another project to come out of IC3, Peace relay is a bridge between ETH compatible chains. It verifies ETHHash proof of work via SmartPool. Headers from other chains can then be used to prove the state on different blockchains. I used their Merkle tree verification code in this POC.

### [Eth Proof](https://github.com/zmitton/eth-proof)
A great lib by Zac Mitton for getting and verifying Merkle Patricia proofs for state, transactions and receipts. I used this as part of this POC.
