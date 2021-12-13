import BigNumber from "bignumber.js"

/**
 * The locator for an oven object. Knows the oven and owner address.
 */
export type OvenLocator = {
    ovenAddress: string
    ovenOwner: string
}

/**
 * The data about the oven.
 */
export type OvenData = {
    baker: string | null,
    balance: BigNumber,
    borrowedTokens: BigNumber,
    stabilityFees: BigNumber,
    isLiquidated: boolean
    outstandingTokens: BigNumber
}

/** And oven is the union of both a locator and the data. */
export type Oven = OvenLocator & OvenData
