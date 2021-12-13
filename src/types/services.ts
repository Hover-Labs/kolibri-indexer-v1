import MetricsClient from "./metrics-client";
import S3Client from './s3-client'
import { HarbingerClient, StableCoinClient } from '@hover-labs/kolibri-js'
import { TezosToolkit } from '@taquito/taquito'

/** A bundle of services available after initialization. */
type Services = {
    s3Client: S3Client,
    metricsClient: MetricsClient,
    harbingerClient: HarbingerClient,
    stableCoinClient: StableCoinClient,
    toolkit: TezosToolkit
}
export default Services