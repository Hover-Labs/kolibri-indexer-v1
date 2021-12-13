// Main file
require('dotenv').config()
import { CONTRACTS, ContractGroup, Network } from "@hover-labs/kolibri-js"
import { initialize, isTestMode } from "./helpers"
import { getAllOvenData, putOvenLocatorsIntoBucket, xtzValueOfOvensInList, borrowedkUSDFromOvensInList } from "./oven-helpers"
import * as Sentry from "@sentry/node"
import { fixedToDecimal, getHumanReadableXTZPrice } from "./price-helpers"
import PegData from './types/peg-data'
import MetricsClient from './types/metrics-client'
import { getPlentyPegStats, getQuipuswapPegStats } from "./peg-utils"
import { getTokenBalance } from './token-helpers'
import { getQLkUSDConversionRate } from './liquidity-pool-helpers'
import { getTVLOfQuipuswapPool, getLPTokenBalance, getTotalLPTokenSupply } from './quipuswap-helpers'
import BigNumber from "bignumber.js"
import { putBucket } from "./s3-bucket-util"

const ONE_MINUTE = 1000 * 60
const LOOP_DELAY = ONE_MINUTE * 5

/**
 * Log data about a peg on a DEX
 *
 * @param pegData The Peg Data to log. If null, nothing will be logged.
 * @param metricsClient The metrics client to log
 */
const logPegData = (pegData: PegData | null, metricsClient: MetricsClient): void => {
    if (pegData === null) {
        return
    }

    // Log raw prices to console and metrics system.
    console.log(`[${pegData.network}] Latest ${pegData.exchangeName} Price ${pegData.rawPrice.toNumber()}`)
    metricsClient.gauge(`${pegData.exchangeName.toLowerCase()}.price`, pegData.rawPrice.toNumber(), [`network:${pegData.network}`]);

    // Log peg statistics to console and metrics system
    console.log(`[${pegData.network}] Peg for ${pegData.exchangeName} at ${pegData.pegPercent.toNumber()}`)
    metricsClient.gauge(`kusd.peg.${pegData.exchangeName.toLowerCase()}`, pegData.pegPercent.toNumber(), [`network:${pegData.network}`]);
}

/**
 * Run a stats loop
 *
 * @param network The network the loop is running on.
 * @param contracts The contracts on the network.
 * @param nodeUrl The URL of the node.
 * @param ovenRegistryBigMapID The Big Map ID of the Oven Registry.
 */
const main = async (network: Network, contracts: ContractGroup, nodeUrl: string, ovenRegistryBigMapID: number): Promise<void> => {
    if (isTestMode()) {
        console.log("!!! Running in Test Mode - Data is not logged !!!")
    }
    const { harbingerClient, stableCoinClient, metricsClient, s3Client, toolkit } = initialize(nodeUrl, network, contracts)

    // Core contracts cannot be null. Error out if they are.
    if (
        contracts.LIQUIDITY_POOL === null ||
        contracts.TOKEN === null ||
        contracts.FARMS.KUSD.farm === null ||
        contracts.FARMS.QLKUSD.farm === null ||
        contracts.FARMS.KUSD_LP.farm === null ||
        contracts.DEXES.QUIPUSWAP.POOL === null
    ) {
        console.log("Fatal: Contracts object not populated correctly!")
        console.log(JSON.stringify(contracts))
        process.exit(1)
    }

    try {
        console.log(`[${network}] Running!`, new Date())
        metricsClient.increment('updateData.called', 1, [`network:${network}`]);

        // Process price data
        const harbingerPrice = await getHumanReadableXTZPrice(harbingerClient)
        console.log(`[${network}] Latest Harbinger Price`, harbingerPrice.toNumber())
        metricsClient.gauge('xtz.price', harbingerPrice.toNumber(), [`network:${network}`]);

        // Process pegs
        logPegData(await getQuipuswapPegStats(contracts, network, harbingerClient, toolkit), metricsClient)
        logPegData(await getPlentyPegStats(contracts, network, harbingerClient, toolkit), metricsClient)

        // Process and dump ovens
        const ovenList = await getAllOvenData(network, ovenRegistryBigMapID, stableCoinClient, harbingerClient, nodeUrl)
        await putOvenLocatorsIntoBucket(s3Client, ovenList, network)
        metricsClient.gauge('oven.count', ovenList.length, [`network:${network}`]);

        // Process oven TVL
        const totalOvenBalanceXTZ = xtzValueOfOvensInList(ovenList)
        const totalOvenBalanceUSD = fixedToDecimal(totalOvenBalanceXTZ, 6).times(harbingerPrice)

        console.log(`[${network}] Total XTZ Balance of Ovens`, fixedToDecimal(totalOvenBalanceXTZ, 6).toNumber())
        metricsClient.gauge('xtz.usd_total', totalOvenBalanceUSD.toNumber(), [`network:${network}`])
        metricsClient.gauge('tvl.ovens', totalOvenBalanceUSD.toNumber(), [`network:${network}`])
        metricsClient.gauge('xtz.total', fixedToDecimal(totalOvenBalanceXTZ, 6).toNumber(), [`network:${network}`]);

        // Process total tokens.
        const totalBorrowedkUSD = fixedToDecimal(borrowedkUSDFromOvensInList(ovenList), 18)
        console.log(`[${network}] Total Tokens`, totalBorrowedkUSD.toNumber())
        metricsClient.gauge('kusd.total', totalBorrowedkUSD.toNumber(), [`network:${network}`]);

        // Process APY
        const apy = await stableCoinClient.getStabilityFeeApy()
        metricsClient.gauge('apy', apy.dividedBy(Math.pow(10, 18 - 2)).toNumber(), [`network:${network}`]);

        // Process TVL for Liquidity Pool
        const liquidityPoolBalance = await getTokenBalance(contracts.LIQUIDITY_POOL, contracts.TOKEN, 18, toolkit)
        metricsClient.gauge('tvl.liquidity_pool', liquidityPoolBalance, [`network:${network}`])

        // Process TVL for kUSD Farm
        const kUSDFarmBalance = await getTokenBalance(contracts.FARMS.KUSD.farm, contracts.TOKEN, 18, toolkit)
        metricsClient.gauge('tvl.kusd_farm', kUSDFarmBalance, [`network:${network}`])

        // Process TVL for QLkUSD Farm
        const qlkusdConversionRate = await getQLkUSDConversionRate(contracts, toolkit)
        const farmBalance = await getTokenBalance(contracts.FARMS.QLKUSD.farm, contracts.LIQUIDITY_POOL, 36, toolkit)
        const liquidityPoolFarmBalanceUSD = farmBalance.times(qlkusdConversionRate)
        metricsClient.gauge('tvl.qlkusd_farm', liquidityPoolFarmBalanceUSD, [`network:${network}`])

        // Process TVL for Quipuswap LP farm
        const quipuswapTvl = await getTVLOfQuipuswapPool(contracts, harbingerClient, toolkit)
        const lpTokensInFarm = await getLPTokenBalance(contracts.FARMS.KUSD_LP.farm, contracts.DEXES.QUIPUSWAP.POOL, toolkit)
        const lpTokenTotalSupply = await getTotalLPTokenSupply(contracts.DEXES.QUIPUSWAP.POOL, toolkit)
        const quipuswapFarmBalanceUSD = lpTokenTotalSupply.isEqualTo(0) ?
            new BigNumber(0) :
            quipuswapTvl.times(lpTokensInFarm.dividedBy(lpTokenTotalSupply))  // Value in pool * (percent of LP tokens held in farm)

        console.log(`[${network}] TVL Quipu: ${quipuswapTvl.toNumber()}`)
        console.log(`[${network}] Total LPs ${lpTokenTotalSupply.toNumber()}`)
        console.log(`[${network}] LPs in Farm ${lpTokensInFarm.toNumber()}`)
        console.log(`[${network}] quipuswapFarmBalanceUSD: ${quipuswapFarmBalanceUSD.toNumber()}`)

        metricsClient.gauge('tvl.quipuswap_lp_farm', quipuswapFarmBalanceUSD, [`network:${network}`])

        // Process TVL
        // TVL = Amount in ovens + amount in liquidity pools + amounts in farms
        const totalFarmBalanceUSD = kUSDFarmBalance.plus(liquidityPoolFarmBalanceUSD).plus(quipuswapFarmBalanceUSD)
        const tvlUSD = totalOvenBalanceUSD.plus(liquidityPoolBalance).plus(totalFarmBalanceUSD)
        metricsClient.gauge('tvl', tvlUSD, [`network:${network}`])

        // Place data in buckets
        await putBucket(
            s3Client,
            {
                allOvenData: ovenList,
                apy,
                totalBalance: totalOvenBalanceXTZ,
                totalBalanceUSD: totalOvenBalanceUSD,
                totalTokens: totalBorrowedkUSD
            },
            `${network}/all-data.json`
        )
        await putBucket(s3Client, { allOvenData: ovenList }, `${network}/oven-data.json`)
        await putBucket(s3Client, { apy }, `${network}/apy.json`)
        await putBucket(s3Client, {
            totalBalance: totalOvenBalanceXTZ,
            totalTokens: totalBorrowedkUSD,
            liquidityPoolBalance,
            kUSDFarmBalance,
            liquidityPoolFarmBalanceUSD,
            quipuswapFarmBalanceUSD,
            totalFarmBalanceUSD,
            tvlUSD
        }, `${network}/totals.json`)

        console.log(`[${network}] Finished!`, new Date())
    } catch (e: any) {
        console.error(e)
        console.log(`[${network}] Error!`, e.stack)
        Sentry.captureException(e);
    }
    console.log(`[${network}] Setting timeout for loop to ${LOOP_DELAY}`)
    setTimeout(main.bind(null, network, contracts, nodeUrl, ovenRegistryBigMapID), LOOP_DELAY)
}

// Run on mainnet and testnet.
main(Network.Mainnet, CONTRACTS.MAIN, 'https://rpc.tzbeta.net', 383)
main(Network.Granada, CONTRACTS.TEST, 'https://rpctest.tzbeta.net', 159183)
