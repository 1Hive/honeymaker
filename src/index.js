const ethers = require('ethers')
const fetch = require('node-fetch')
const logger = require('./logger')
const { chunk } = require('./util')

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

// Token pairs to convert for
const TOKEN_PAIRS = [
  // HNY-WXDAI
  ['0x71850b7e9ee3f13ab46d67167341e4bdc905eef9', '0xe91d153e0b41518a2ce8dd3d7944fa863463a97d'],
  // HNY-WETH
  ['0x6a023ccd1ff6f2045c3309768ead9e68f978f6e1', '0x71850b7e9ee3f13ab46d67167341e4bdc905eef9'],
  // HNY-STAKE
  ['0x71850b7e9ee3f13ab46d67167341e4bdc905eef9', '0xb7d311e2eb55f2f68a9440da38e7989210b9a05e']
]

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
  for (const ids of chunk(pairs, 5)) {
    try {
      const tx = await maker.convert(ids, { gasPrice: ONE_GWEI, gasLimit: 1400000 })

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
  logger.info(`Current balance is ${balance}`)
}

// Honeycomb balance proxies to call
const BALANCE_PROXIES = [
  // HNY-WXDAI
  '0x2dF0Af12DB95f16c33f496461bB2E38B1C860227',
  // HNY-WETH
  '0x23512464529127ec01a3422453a4416e6b569984',
  // HNY-STAKE
  '0x745963503a6489b91f7a8ff784d286877a775d72'
]

async function transferBalances (
  signer,
  proxies
) {
  logger.info('Transferring Honeycomb balances...')
  for (const proxyAddress of proxies) {
    const proxy = new ethers.Contract(
      proxyAddress,
      ['function transfer ()'],
      signer
    )

    try {
      const {
        hash
      } = await proxy.transfer({ gasLimit: 1400000 })
      logger.info(`- Sent transaction to transfer balance of ${proxyAddress} pair (${hash})`)
    } catch (err) {
      logger.fatal(`- Transaction for ${proxyAddress} proxy failed to process.`)
      logger.fatal(`- ${err.message}`)
    }
  }
  logger.info('Done transferring balances.')

  const balance = await signer.provider.getBalance(signer.address)
  logger.info(`Current balance is ${balance}`)
}

async function main () {
  await convertShares(wallet, CONTRACT_ADDRESS)
  await transferBalances(wallet, BALANCE_PROXIES)

  setTimeout(() => {
    main()
  }, INTERVAL)
}

main()
