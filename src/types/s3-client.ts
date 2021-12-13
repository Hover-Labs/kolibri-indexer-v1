/** A facade for an aws.S3 that allows mocking in test mode  */

type S3Client = {
    putObject: (payload: any) => any
}
export default S3Client
