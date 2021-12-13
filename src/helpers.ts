/** Generalized helper functions. */
import * as Sentry from "@sentry/node"
import Services from './types/services'
import * as metrics from 'datadog-metrics'
import { S3 } from 'aws-sdk'
import { ContractGroup, HarbingerClient, Network, StableCoinClient } from "@hover-labs/kolibri-js"
import { TezosToolkit } from "@taquito/taquito"

/**
 * Check if the Stats Watcher is running in test mode.
 */
export const isTestMode = () => {
    // Enable or disable testmode.
    return process.env["TEST"] !== undefined
}

/**
 * Initialize the system
 *
 * Checks env vars and the like.
*/
export const initialize = (nodeUrl: string, network: Network, contracts: ContractGroup): Services => {
    // Initialize a sentry in all cases
    Sentry.init({
        dsn: "https://b69920c2a3154c629a833525689fd268@o68511.ingest.sentry.io/5564252",
    });

    const harbingerClient = new HarbingerClient(nodeUrl, contracts.HARBINGER_NORMALIZER!)
    const stableCoinClient = new StableCoinClient(nodeUrl, network, contracts.OVEN_REGISTRY!, contracts.MINTER!, contracts.OVEN_FACTORY!)
    const toolkit = new TezosToolkit(nodeUrl)


    if (isTestMode()) {
        // Stub S3 and Metrics in test mode
        const s3Client = {
            putObject: (input: any) => {
                console.log(`[TEST_MODE] Putbucket called for file ${input.Key}`)
                return {
                    promise: async (): Promise<void> => {
                        return Promise.resolve()
                    }
                }
            }
        }
        const metricsClient = {
            gauge: (identifier: any, value: any): void => {
                console.log(`[TEST_MODE] Writing Gauge: [${identifier}, ${value}]`)
            },
            increment: function () { }
        }

        return {
            s3Client,
            metricsClient,
            harbingerClient,
            stableCoinClient,
            toolkit
        }
    } else {
        // Set up datadog
        metrics.init({ prefix: `kolibri.` });

        // Set up s3 access
        const AWS_KEY_ID = process.env.AWS_ACCESS_KEY_ID
        const AWS_KEY_SECRET = process.env.AWS_SECRET_ACCESS_KEY

        if (AWS_KEY_ID === undefined || AWS_KEY_SECRET === undefined) {
            throw Error("AWS_KEY_ID or AWS_KEY_SECRET is not currently set!")
        }

        const s3Client = new S3({
            accessKeyId: AWS_KEY_ID,
            secretAccessKey: AWS_KEY_SECRET
        });

        return {
            metricsClient: metrics,
            s3Client,
            harbingerClient,
            stableCoinClient,
            toolkit
        }
    }
}
