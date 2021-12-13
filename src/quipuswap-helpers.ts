/** Utilities for working with Quipuswap */

import { ContractGroup, HarbingerClient } from "@hover-labs/kolibri-js"
import { TezosToolkit } from '@taquito/taquito'
import { getTokenBalance } from "./token-helpers"
import BigNumber from "bignumber.js"
import { fixedToDecimal, getHumanReadableXTZPrice } from './price-helpers'

/**
 * Get the USD TVL value of the Quipuswap pool.
 *
 * This is the sum of both the kUSD and the XTZ in the pool
 *
 * @param contracts A group of contracts
 * @param harbingerClient A source for the XTZ price
 * @param toolkit A toolkit to inspect Tezos smart contracts
 */
export const getTVLOfQuipuswapPool = async (contracts: ContractGroup, harbingerClient: HarbingerClient, toolkit: TezosToolkit): Promise<BigNumber> => {
    const kUSDInQuipuswapPool = await getTokenBalance(contracts.DEXES.QUIPUSWAP.POOL!, contracts.TOKEN!, 18, toolkit)
    const xtzInQuipuswapPool = fixedToDecimal(await toolkit.tz.getBalance(contracts.DEXES.QUIPUSWAP.POOL!), 6)
    const xtzPrice = await getHumanReadableXTZPrice(harbingerClient)
    return kUSDInQuipuswapPool.plus(xtzInQuipuswapPool.times(xtzPrice))
}

/**
 * Get the number of LP tokens held by an address
 *
 * TODO(keefertaylor): Consider merging this with token-helpers.ts
 *
 * @param holderAddress The address holding the LP tokens
 * @param poolAddress The address of the Quipuswap pool
 * @param toolkit The Tezos toolkit to use
 */
export const getLPTokenBalance = async (holderAddress: string, poolAddress: string, toolkit: TezosToolkit): Promise<BigNumber> => {
    const quipuswapContract = await toolkit.contract.at(poolAddress)
    const quipuswapStorage: any = await quipuswapContract.storage()

    const balanceObject = await quipuswapStorage.storage.ledger.get(holderAddress)
    if (balanceObject === undefined) {
        return new BigNumber(0)
    }

    return balanceObject.balance
}

/**
 * Get the total supply of LP tokens.
 */
export const getTotalLPTokenSupply = async (poolAddress: string, toolkit: TezosToolkit): Promise<BigNumber> => {
    const quipuswapContract = await toolkit.contract.at(poolAddress)
    const quipuswapStorage: any = await quipuswapContract.storage()
    return quipuswapStorage.storage.total_supply
}
