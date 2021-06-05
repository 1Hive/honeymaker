## Honeymaker

A small bot that calls the Honeyswap DX swap fee receiver and issuance contracts periodically. Read more [here](https://github.com/1Hive/honeyswap/blob/master/HONEYMAKER.md).

### Running

Simply clone the repository, install the dependencies and configure the bot:

- `MNEMONIC`: The mnemonic for the private key the bot should use when sending transactions.
- `ETH_URI`: The Ethereum node to connect to.
- `CONTRACT_ADDRESS`: The DX swap fee receiver contract address.
- `ISSUANCE_CONTRACT_ADDRESS`: The contract address for the issuance contract (optional).
- `SUBGRAPH_URI`: The Honeyswap subgraph URI to fetch liquidity position information from.
- `FEE_CUTOFF`: The minimum fees (in USD) that will be converted as a result of burning liquidity. Defaults to $50.
- `INTERVAL`: The interval at which the `convert` function will be called in milliseconds. Defaults to 1 day.
- `PROTO_FEE_CHUNK_SIZE`: Specifies the number of pairs on each `takeProtocolFee` call (optional, default: 5)
- `PROTO_FEE_GAS_LIMIT`: Specifies the gas limit for calls to the protocol fee contract (optional, default: 1.5m wei).
- `ISSUANCE_GAS_LIMIT`: Specifies the gas limit for calls to the issuance contract (optional, default: 500k wei)

## License

GPL 3.0
