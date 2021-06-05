const ethers = require('ethers')
const fetch = require('node-fetch')
const logger = require('./logger')
const { chunk } = require('./util')

const ONE_GWEI = 1000000000
const ONE_DAY = 24 * 60 * 60 * 1000

// Configuration
const {
  // Signer
  MNEMONIC,
  ETH_URI,

  // Contract addresses
  CONTRACT_ADDRESS,
  ISSUANCE_CONTRACT_ADDRESS,

  // Subgraph
  SUBGRAPH_URI,

  // Runtime configuration
  FEE_CUTOFF = 50,
  INTERVAL = ONE_DAY,

  // Performance adjustments
  PROTO_FEE_CHUNK_SIZE = 5,
  PROTO_FEE_GAS_LIMIT = 1500000,
  ISSUANCE_GAS_LIMIT = 500000,
} = process.env

if (!MNEMONIC) {
  logger.error('Please set `MNEMONIC`.')
  process.exit(1)
}

if (!ETH_URI) {
  logger.error('Please set `ETH_URI`.')
  process.exit(1)
}

if (!CONTRACT_ADDRESS) {
  logger.error('Please set `CONTRACT_ADDRESS`.')
  process.exit(1)
}

if (!INTERVAL) {
  logger.error('Please set `INTERVAL`.')
  process.exit(1)
}

if (!SUBGRAPH_URI) {
  logger.error('Please set `SUBGRAPH_URI`.')
  process.exit(1)
}

if (!ISSUANCE_CONTRACT_ADDRESS) {
  logger.warning('`ISSUANCE_CONTRACT_ADDRESS` is not set. Ignoring.')
}

if (!PROTO_FEE_CHUNK_SIZE) {
  logger.fatal('Please set `PROTO_FEE_CHUNK_SIZE`.')
  process.exit(1)
}

if (!PROTO_FEE_GAS_LIMIT) {
  logger.fatal('Please set `PROTO_FEE_GAS_LIMIT`.')
  process.exit(1)
}

if (!ISSUANCE_GAS_LIMIT) {
  logger.fatal('Please set `ISSUANCE_GAS_LIMIT`.')
  process.exit(1)
}

// Set up provider and wallet
const provider = ethers.getDefaultProvider(ETH_URI)
const wallet = ethers.Wallet
  .fromMnemonic(MNEMONIC)
  .connect(provider)

// Run information
logger.info(`Acting as ${wallet.address}`)
logger.info(`Connected to ${ETH_URI}`)
logger.info(`Calling takeProtocolFee on ${CONTRACT_ADDRESS} every ${INTERVAL}ms with ${PROTO_FEE_CHUNK_SIZE} pairs per call.`)

if (ISSUANCE_CONTRACT_ADDRESS) {
  logger.info(`Calling executeAdjustment on ${ISSUANCE_CONTRACT_ADDRESS} every ${INTERVAL}ms`)
}

logger.info(`Gas limits:`)
logger.info(`- Fee receiver calls: ${PROTO_FEE_GAS_LIMIT} wei`)

if (ISSUANCE_CONTRACT_ADDRESS) {
  logger.info(`- Issuance calls: ${ISSUANCE_GAS_LIMIT} wei`)
}

async function fetchPairs (
  makerAddress
) {
  let liquidityPositions = []

  const perPage = 20
  let page = 0
  while (true) {
    const response = await fetch(SUBGRAPH_URI, {
      method: 'post',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: `{
          user(id: "${makerAddress.toLowerCase()}") {
            liquidityPositions(
              first: ${perPage},
              skip: ${perPage * page},
              orderBy: liquidityTokenBalance,
              orderDirection: desc
            ) {
              pair {
                id
                totalSupply
                reserveUSD
              }
              liquidityTokenBalance
            } 
          }
        }`
      })
    })
    const { data } = await response.json()

    if (data.user.liquidityPositions.length === 0) {
      break
    }

    liquidityPositions = liquidityPositions.concat(data.user.liquidityPositions)
    page++
  }

  return liquidityPositions
    .filter((position) => {
      const potentialFeeUSD = Number(position.liquidityTokenBalance) / Number(position.pair.totalSupply) * position.pair.reserveUSD

      return potentialFeeUSD >= FEE_CUTOFF
    })
    .map(({ pair }) => {
      return pair.id
    })
}

async function convertShares (
  signer,
  makerAddress,
) {
  const pairs = await fetchPairs(makerAddress)
  const maker = new ethers.Contract(
    makerAddress,
    ['function takeProtocolFee (address[] pairs)'],
    signer
  )

  logger.info('Converting shares...')
  for (const ids of chunk(pairs, PROTO_FEE_CHUNK_SIZE)) {
    try {
      const tx = await maker.takeProtocolFee(ids, { gasPrice: ONE_GWEI, gasLimit: PROTO_FEE_GAS_LIMIT })

      for (const id of ids) {
        logger.info(`- Sent transaction to convert ${id} pair (${tx.hash})`)
      }
      await tx.wait(2)
    } catch (err) {
      logger.fatal(`- Transaction for pairs (${ids.join(', ')}) failed to process.`)
      logger.fatal(`- ${err.message}`)
    }
  }
  logger.info('Done converting shares.')

  const balance = await signer.provider.getBalance(signer.address)
  logger.info(`Current balance is ${balance} wei`)
}

async function executeIssuanceAdjustment (
  signer,
  contractAddress
) {
  const issuanceContract = new ethers.Contract(
    contractAddress,
    ['function executeAdjustment ()'],
    signer
  )

  logger.info('Executing issuance adjustment...')
  try {
    const tx = await issuanceContract.executeAdjustment({ gasPrice: ONE_GWEI, gasLimit: ISSUANCE_GAS_LIMIT })
    logger.info(`- Sent transaction to execute issuance adjustment (${tx.hash})`)
    await tx.wait(2)
  } catch (err) {
    logger.fatal(`- Transaction to execute issuance adjustment failed.`)
    logger.fatal(`- ${err.message}`)
  }
  logger.info('Done executing issuance adjustment.')

  const balance = await signer.provider.getBalance(signer.address)
  logger.info(`Current balance is ${balance} wei`)
}

async function main () {
  await convertShares(wallet, CONTRACT_ADDRESS)

  if (ISSUANCE_CONTRACT_ADDRESS) {
    await executeIssuanceAdjustment(wallet, ISSUANCE_CONTRACT_ADDRESS)
  }

  setTimeout(() => {
    main()
  }, INTERVAL)
}

main()
