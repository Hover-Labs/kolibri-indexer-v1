/** Helpers for working with ovens */

import {HarbingerClient, Network, OvenClient, StableCoinClient} from "@hover-labs/kolibri-js"
import axios from 'axios'
import {Oven, OvenLocator, SerializableOven} from './types/oven-data'
import {putBucket} from "./s3-bucket-util"
import S3Client from './types/s3-client'
import BigNumber from 'bignumber.js'
import {InMemorySigner} from '@taquito/signer'

/**
 * Put OvenLocators into a bucket.
 *
 * @param s3Client an S3 client
 * @param ovenList The list of all ovens
 * @param network The network the ovens are on.
 */
export const putOvenLocatorsIntoBucket = async (s3Client: S3Client, ovenList: Array<Oven>, network: Network): Promise<void> => {
    // Reduce all ovens to an array of locators
    const ovenLocators: Array<OvenLocator> = ovenList.map((oven: Oven) => {
        return {
            ovenAddress: oven.ovenAddress,
            ovenOwner: oven.ovenOwner
        }
    })

    const payload = {
        ovenData: ovenLocators
    }
    const filename = `${network}/oven-key-data.json`
    return await putBucket(s3Client, payload, filename)
}

/**
 * Retrieve all active ovens and dump them.
 *
 * @param network The network to run on
 * @param ovenRegistryBigMapID The big map ID of the oven registry.
*  @param stableCoinClient A stablecoin client.
* @param harbingerClient a Harbinger client
 * @param nodeUrl The URL of the tezos node
*/
export const getAllOvenData = async (
    network: Network,
    ovenRegistryBigMapID: number,
    stableCoinClient: StableCoinClient,
    harbingerClient: HarbingerClient,
    nodeUrl: string
): Promise<Array<Oven>> => {
    let domain = ''
    switch (network) {
        case Network.Edo2Net:
            domain = 'api.edo.tzstats.com'
            break
        case Network.Florence:
            domain = 'api.florence.tzstats.com'
            break
        case Network.Granada:
            domain = 'api.granada.tzstats.com'
            break
        case Network.Mainnet:
            domain = 'api.tzstats.com'
            break
    }

    // Retrieve all oven locators.
    let ovenLocators: Array<OvenLocator> = []
    let offset = 0
    const pageSize = 100
    while (true) {
        const response = await axios.get(`https://${domain}/explorer/bigmap/${ovenRegistryBigMapID}/values?limit=100&offset=${offset}`)
        ovenLocators = ovenLocators.concat(response.data.map((data: any) => {
            return {
                ovenAddress: data.key,
                ovenOwner: data.value
            }
        }))

        if (response.data.length !== pageSize) {
            break
        }

        offset += pageSize
    }

    // Load data for all locators
    const ovenPromises: Array<Promise<Oven>> = ovenLocators.map((ovenLocator: OvenLocator) => {
        return ovenFromLocator(ovenLocator, nodeUrl, stableCoinClient, harbingerClient)
    })
    return Promise.all(ovenPromises)
}

/**
 * Retrieve all data about an oven from a locator.
 *
 * @param ovenLocator The Oven to investigate
 * @param nodeUrl The tezos node url
 * @param stableCoinClient A stablecoin client
 * @param harbingerClient A harbinger client
 * @returns
 */
const ovenFromLocator = async (ovenLocator: OvenLocator, nodeUrl: string, stableCoinClient: StableCoinClient, harbingerClient: HarbingerClient): Promise<Oven> => {
    // This key is meaningless, but we need a signer for OvenClient.
    const signer = await InMemorySigner.fromSecretKey('edsk3aeocSRnxdWVFm3ShaALUeCTy4PgL6JdeGvzbLjX5jn8D9ZXw5')
    const ovenClient = new OvenClient(
        nodeUrl,
        signer,
        ovenLocator.ovenAddress,
        stableCoinClient,
        harbingerClient
    )
    const values = await Promise.all([
        ovenClient.getBaker(),
        ovenClient.getBalance(),
        ovenClient.getBorrowedTokens(),
        ovenClient.getStabilityFees(),
        ovenClient.isLiquidated(),
    ])

    return {
        ovenAddress: ovenLocator.ovenAddress,
        ovenOwner: ovenLocator.ovenOwner,

        baker: values[0],
        balance: values[1],
        borrowedTokens: values[2],
        stabilityFees: values[3],
        isLiquidated: values[4],
        outstandingTokens: values[2].plus(values[3]) // borrowedTokens + stabilityFees
    }
}

/**
 * Calculate the total value of all ovens in a list.
 */
export const xtzValueOfOvensInList = (ovenList: Array<Oven>): BigNumber => {
    return ovenList.reduce((accumulated: BigNumber, oven: Oven) => {
        return oven.balance.plus(accumulated)
    }, new BigNumber(0))
}

/**
 * Calculate the total tokens borrowed from ovens in a list
 */
export const borrowedkUSDFromOvensInList = (ovenList: Array<Oven>): BigNumber => {
    return ovenList.reduce((accumulated: BigNumber, oven: Oven) => {
        return oven.outstandingTokens.plus(accumulated)
    }, new BigNumber(0))
}

/**
 * Create safe serializable versions of oven data
 */
export const toSerializableOvenData = (ovenList: Array<Oven>): Array<SerializableOven> => {
    return ovenList.map((oven: Oven) => {
        return {
            ovenAddress: oven.ovenAddress,
            ovenOwner: oven.ovenOwner,

            baker: oven.baker,
            balance: oven.balance.toFixed(),
            borrowedTokens: oven.borrowedTokens.toFixed(18),
            stabilityFees: oven.stabilityFees.toFixed(18),
            isLiquidated: oven.isLiquidated,
            outstandingTokens: oven.outstandingTokens.toFixed(18)
        }
    })
}
