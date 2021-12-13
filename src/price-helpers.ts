/** Helpers for working with prices. */

import BigNumber from "bignumber.js"
import { HarbingerClient } from "@hover-labs/kolibri-js"
import { TezosToolkit } from '@taquito/taquito'

/**
 * Convert a fixed point number to a decimal
 *
 * @param fixed The fixed point number to convert
 * @param decimals The number of decimals int the fixed point number
 */
export const fixedToDecimal = (fixed: BigNumber, decimals: number): BigNumber => {
    return fixed.dividedBy(Math.pow(10, decimals))
}

/**
 * Get the price of XTZ in human readable format.
 */
export const getHumanReadableXTZPrice = async (harbingerClient: HarbingerClient): Promise<BigNumber> => {
    const priceData = await harbingerClient.getPriceData()
    return fixedToDecimal(priceData.price, 6)
}

/**
 * Get the price of an asset in a quipuswap pool in terms of XTZ
 *
 * @param poolAddress The address of the quipuswap pool
 * @param toolkit A tezos Toolkit that can introspect smart contracts
 */
export const getQuipuswapPriceForAsset = async (poolAddress: string, toolkit: TezosToolkit) => {
    // Retrieve pool contract storage
    const quipuswapPool = await toolkit.contract.at(poolAddress)
    const quipuswapStorage: any = await quipuswapPool.storage()

    // Calculate price
    const currentAsset = fixedToDecimal(quipuswapStorage.storage.token_pool, 18)
    const currentXTZ = fixedToDecimal(quipuswapStorage.storage.tez_pool, 6)
    return currentAsset.dividedBy(currentXTZ)
}
