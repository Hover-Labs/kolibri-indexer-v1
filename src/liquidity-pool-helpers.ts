/** Helpers for working with the liquidity pool */

import BigNumber from 'bignumber.js'
import { TezosToolkit } from '@taquito/taquito'
import { fixedToDecimal } from './price-helpers'
import { ContractGroup } from '@hover-labs/kolibri-js'
import { getTokenBalance } from './token-helpers'

/** Get the conversion rate of 1 QLkUSD to kUSD */
export const getQLkUSDConversionRate = async (contracts: ContractGroup, toolkit: TezosToolkit): Promise<BigNumber> => {
    const totalSupply = await getLPTokenTotalSupply(contracts.LIQUIDITY_POOL!, toolkit)
    const kUSDInPool = await getTokenBalance(contracts.LIQUIDITY_POOL!, contracts.TOKEN!, 18, toolkit)

    if (kUSDInPool.isEqualTo(new BigNumber(0))) {
        return new BigNumber(0)
    }

    return kUSDInPool.dividedBy(totalSupply)
}

/** Get the total supply of QLkUSD tokens */
const getLPTokenTotalSupply = async (liquidityPoolAddress: string, toolkit: TezosToolkit): Promise<BigNumber> => {
    const liquidityPoolContract = await toolkit.contract.at(liquidityPoolAddress)
    const liquidityPoolStorage: any = await liquidityPoolContract.storage()
    return liquidityPoolStorage.totalSupply.isEqualTo(0) ?
        new BigNumber(0) :
        fixedToDecimal(liquidityPoolStorage.totalSupply, 36)
}