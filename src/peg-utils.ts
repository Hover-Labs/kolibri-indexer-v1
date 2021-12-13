/** Utilities for working with DEX pegs */

import PegData from './types/peg-data'
import { ContractGroup, HarbingerClient, Network } from '@hover-labs/kolibri-js'
import { TezosToolkit } from '@taquito/taquito'
import { getHumanReadableXTZPrice, getQuipuswapPriceForAsset } from './price-helpers'
import { getTokenBalance } from './token-helpers'

/**
 * Get peg data for the Quipuswap DEX.
 *
 * Returns null if the quipuswap dex is not defined for the current network.
 *
 * @param contracts The group of contracts
 * @param network The network that is being executed on
 * @param harbingerClient A harbinger client
 * @param toolkit A Toolkit for inspecting Tezos smart contracts
 */
export const getQuipuswapPegStats = async (
    contracts: ContractGroup,
    network: Network,
    harbingerClient: HarbingerClient,
    toolkit: TezosToolkit
): Promise<PegData | null> => {
    // Don't return data if the quipuswap pool isn't defined.
    if (contracts.DEXES.QUIPUSWAP.POOL === null) {
        return null
    }

    // Grab pice of kUSD in quipuswap
    const quipuswapPriceUSD = await getQuipuswapPriceForAsset(contracts.DEXES.QUIPUSWAP.POOL, toolkit)
    const harbingerPriceUSD = await getHumanReadableXTZPrice(harbingerClient)

    // Calculate peg.
    const harbingerQuipuswapPeg = quipuswapPriceUSD.dividedBy(harbingerPriceUSD).minus(1).times(100)

    return {
        exchangeName: "Quipuswap",
        network,
        rawPrice: quipuswapPriceUSD,
        pegPercent: harbingerQuipuswapPeg,
    }
}

/**
 * Get peg data for the Plenty DEX.
 *
 * Returns null if the Plenty dex is not defined for the current network.
 *
 * @param contracts The group of contracts
 * @param network The network that is being executed on
 * @param harbingerClient A harbinger client
 * @param toolkit A Toolkit for inspecting Tezos smart contracts
 */
export const getPlentyPegStats = async (
    contracts: ContractGroup,
    network: Network,
    harbingerClient: HarbingerClient,
    toolkit: TezosToolkit
): Promise<PegData | null> => {
    // Don't return data if the plenty pool isn't defined.
    if (contracts.DEXES.PLENTY.POOL === null) {
        return null
    }

    // Get price of PLENTY in quipuswap
    const plentyPriceXTZ = await getQuipuswapPriceForAsset(contracts.DEXES.PLENTY.PLENTY_QUIPUSWAP_POOL!, toolkit)
    const xtzPrice = await getHumanReadableXTZPrice(harbingerClient)
    const plentyPriceUSD = plentyPriceXTZ.times(xtzPrice)

    // Grab kUSD price, in terms of plenty
    const plentyInPlentyPool = await getTokenBalance(contracts.DEXES.PLENTY.POOL, contracts.DEXES.PLENTY.PLENTY_TOKEN!, 18, toolkit)
    const kUSDInPlentyPool = await getTokenBalance(contracts.DEXES.PLENTY.POOL, contracts.TOKEN!, 18, toolkit)
    const kUSDInPlentyPrice = plentyInPlentyPool.dividedBy(kUSDInPlentyPool)

    // Calculate kUSD price in terms of USD
    const kUSDPrice = kUSDInPlentyPrice.times(plentyPriceUSD)

    // Calculate peg
    const pegPercent = kUSDPrice.minus(1).times(100)

    return {
        exchangeName: "Plenty",
        network,
        rawPrice: kUSDPrice,
        pegPercent,
    }
}

