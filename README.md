## Honeymaker

A small bot that calls the Honeyswap SushiMaker contract periodically. Read more [here](https://github.com/1Hive/honeyswap/blob/master/HONEYMAKER.md).

### Running

Simply clone the repository, install the dependencies and configure the bot:

- `MNEMONIC`: The mnemonic for the private key the bot should use when sending transactions.
- `ETH_URI`: The Ethereum node to connect to.
- `CONTRACT_ADDRESS`: The SushiMaker contract address.
- `SUBGRAPH_URI`: The Honeyswap subgraph URI to fetch liquidity position information from.
- `FEE_CUTOFF`: The minimum fees (in USD) that will be converted as a result of burning liquidity. Defaults to $50.
- `INTERVAL`: The interval at which the `convert` function will be called in milliseconds. Defaults to 1 day.

## License

GPL 3.0
