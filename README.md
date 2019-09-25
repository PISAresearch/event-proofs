# Event proof

A POC to explore how Ethereum logs could be verified in a smart contract. Proofs are generated using eth-proof and verified using the Merkle Patricia Tree implementation from Peace Relay. If running the tests against Infura be patient with them as generating proofs requires a lot of rpc calls.

Some other related projects: 

### Logs bloom
[EventStorage.sol](https://github.com/figs999/Ethereum/blob/master/EventStorage.sol) by Chance Santana-Wees- Verifies the header against a trusted hash, then uses the logs bloom to prove inclusion. Unfortunately, this method suffers from possible collision attacks in the bloom, see this. In PISA's case we would need to protect against potentially strong opponents so we couldn't use this approach. I encourage you to check out Chance's other contracts though, my personal favourite is the EVMVM :)

### Proveth
This [project](https://github.com/lorenzb/proveth) by a team at 2018 IC3 Boot camp aims to standardise the Merkle proofs required for receipts, state and transactions. They create proofs in python, and have working verification for transactions.

### PeaceRelay
Another [project](https://github.com/KyberNetwork/peace-relay) to come out of IC3, Peace relay is a bridge between ETH compatible chains. It verifies ETHHash proof of work via SmartPool. Headers from other chains can then be used to prove the state on different blockchains. I used their Merkle tree verification code in this POC.

### Eth Proof
A great [lib](https://github.com/zmitton/eth-proof) by Zac Mitton for getting and verifying Merkle Patricia proofs for state, transactions and receipts. I used this as part of this POC.