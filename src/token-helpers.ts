/** Helpers for working with Tokens */

import BigNumber from "bignumber.js"
import { fixedToDecimal } from './price-helpers'
import { TezosToolkit } from '@taquito/taquito'

/**
 * Return the balance of tokens held by an address
 * 
 * Note: This function assumes an FA1.2 token that stores balances in `storage.balances[address].balance`.
 * TODO(keefertaylor): Consider if we can refactor or generalize this for all tokens.
 * 
 * @param holderAddress The address holding the tokens
 * @param tokenAddress The address of the token
 * @param decimals The decimals in teh token
 * @param toolkit A Toolkit for inspecting Tezos smart contracts
 */
export const getTokenBalance = async (holderAddress: string, tokenAddress: string, decimals: number, toolkit: TezosToolkit): Promise<BigNumber> => {
    const tokenContract = await toolkit.contract.at(tokenAddress)
    const tokenStorage: any = await tokenContract.storage()

    // If there is no entry then the balance is implicitly zero
    const holderBalanceObject = await tokenStorage.balances.get(holderAddress)
    if (holderBalanceObject === undefined) {
        return new BigNumber(0)
    }

    const holderBalanceInteger: BigNumber = holderBalanceObject.balance
    return fixedToDecimal(holderBalanceInteger, decimals)
}