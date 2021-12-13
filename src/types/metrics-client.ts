/** A facade for datadog metrics which allows mocking in testmode */

type MetricsClient = {
    gauge: (identifier: string, value: any, tags: Array<any>) => void,
    increment: (s: string, n: number, a: Array<any>) => void
}

export default MetricsClient