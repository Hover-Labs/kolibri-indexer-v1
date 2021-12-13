import BigNumber from 'bignumber.js'
import { Network } from '@hover-labs/kolibri-js'

/** Data about a peg on a dex */
type PegData = {
    // The name of the DEX. Used for logging and metrics gathering.
    exchangeName: string

    // The network the data came from
    network: Network

    // The raw price of kUSD on the exchange in dollars. Ex. 1.01
    rawPrice: BigNumber

    // The percentage off peg, as an integer number. Ex. 1.23% off peg would be 1.23.
    pegPercent: BigNumber
}

export default PegData