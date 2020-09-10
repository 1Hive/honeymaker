const ethers = require('ethers')
const logger = require('./logger')

const ONE_DAY = 24 * 60 * 60 * 1000

// Configuration
const {
  MNEMONIC,
  ETH_URI,
  CONTRACT_ADDRESS,
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
  ['0x71850b7e9ee3f13ab46d67167341e4bdc905eef9', '0xe91d153e0b41518a2ce8dd3d7944fa863463a97d']
]

async function convertShares (
  signer,
  makerAddress,
  pairs,
) {
  const maker = new ethers.Contract(
    makerAddress,
    ['function convert (address _tokenA, address _tokenB)'],
    signer
  )

  logger.info('Converting shares...')
  for (const [tokenA, tokenB] of pairs) {
    try {
      const {
        hash
      } = await maker.convert(tokenA, tokenB, { gasLimit: 660000 })
      logger.info(`- Sent transaction to convert ${tokenA}-${tokenB} pair (${hash})`)
    } catch (err) {
      logger.fatal(`- Transaction for ${tokenA}-${tokenB} pair failed to process.`)
      logger.fatal(`- ${err.message}`)
      process.exit(1)
    }
  }
  logger.info('Done converting shares.')

  const balance = await signer.provider.getBalance(signer.address)
  logger.info(`Current balance is ${balance}`)

  setTimeout(() => {
    convertShares(signer, makerAddress, pairs)
  }, INTERVAL)
}

convertShares(wallet, CONTRACT_ADDRESS, TOKEN_PAIRS)
