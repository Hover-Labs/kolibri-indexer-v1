/** Functions for working with S3 buckets. */

import S3Client from './types/s3-client'

const BUCKET_NAME = 'kolibri-data'
/**
 * Put data into a bucket.
 *
 * @param s3Client The S3 client.
 * @param payload Some object to put in the bucket.
 * @param filename The file name of the bucket.
 */
export const putBucket = async (s3Client: S3Client, payload: object, filename: string): Promise<void> => {
    // Stub with a log statement for test mode
    const dataBlob = JSON.stringify(payload, null, 4)

    const dataBuffer = new Buffer(dataBlob, 'binary');
    await s3Client.putObject({
        Bucket: BUCKET_NAME,
        Key: filename,
        Body: dataBuffer,
        ContentType: "application/json",
        ACL: 'public-read'
    }).promise()
}
