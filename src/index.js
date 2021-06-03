const ethers = require('ethers')
const fetch = require('node-fetch')
const logger = require('./logger')

const ONE_GWEI = 1000000000
const ONE_DAY = 24 * 60 * 60 * 1000

// Configuration
const {
  MNEMONIC,
  ETH_URI,
  CONTRACT_ADDRESS,
  SUBGRAPH_URI,
  FEE_CUTOFF = 50,
  INTERVAL = ONE_DAY
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

// Set up provider and wallet
const provider = ethers.getDefaultProvider(ETH_URI)
const wallet = ethers.Wallet
  .fromMnemonic(MNEMONIC)
  .connect(provider)

// Run information
logger.info(`Acting as ${wallet.address}`)
logger.info(`Connected to ${ETH_URI}`)
logger.info(`Calling convert on ${CONTRACT_ADDRESS} every ${INTERVAL}ms`)

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
                totalSupply
                token0 {
                  id
                }
                token1 {
                  id
                }
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
      return [pair.token0.id, pair.token1.id]
    })
}

async function convertShares (
  signer,
  makerAddress,
) {
  const pairs = await fetchPairs(makerAddress)
  const maker = new ethers.Contract(
    makerAddress,
    ['function convert (address _tokenA, address _tokenB)'],
    signer
  )

  logger.info('Converting shares...')
  for (const [tokenA, tokenB] of pairs) {
    try {
      const tx = await maker.convert(tokenA, tokenB, { gasPrice: ONE_GWEI, gasLimit: 1400000 })
      logger.info(`- Sent transaction to convert ${tokenA}-${tokenB} pair (${tx.hash})`)
      await tx.wait(2)
    } catch (err) {
      logger.fatal(`- Transaction for ${tokenA}-${tokenB} pair failed to process.`)
      logger.fatal(`- ${err.message}`)
    }
  }
  logger.info('Done converting shares.')

  const balance = await signer.provider.getBalance(signer.address)
  logger.info(`Current balance is ${balance}`)
}

async function main () {
  await convertShares(wallet, CONTRACT_ADDRESS)

  setTimeout(() => {
    main()
  }, INTERVAL)
}

main()
