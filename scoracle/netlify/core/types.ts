export type NetlifyFunctionEvent = {
  httpMethod?: string
  headers?: Record<string, string | undefined>
  body?: string | null
  queryStringParameters?: Record<string, string | undefined> | null
}

export type NetlifyFunctionResult = {
  statusCode: number
  headers: Record<string, string>
  body: string
}
