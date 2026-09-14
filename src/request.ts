/** Keep the deadline active until the response body has finished, not just headers. */
export class RequestTimeoutError extends Error {
  constructor() {
    super('请求超时，未得到完整结果。')
    this.name = 'RequestTimeoutError'
  }
}

export class ResponseBodyError extends Error {
  readonly status: number
  constructor(status: number) {
    super('响应未包含可读取的 JSON。')
    this.name = 'ResponseBodyError'
    this.status = status
  }
}

export async function fetchJsonWithDeadline<T>(input: RequestInfo | URL, init: RequestInit, timeoutMs: number): Promise<{ response: Response; payload: T }> {
  const controller = new AbortController()
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      (async () => {
        const response = await fetch(input, { ...init, signal: controller.signal })
        let payload: T
        try {
          payload = await response.json() as T
        } catch {
          if (controller.signal.aborted) throw new RequestTimeoutError()
          throw new ResponseBodyError(response.status)
        }
        return { response, payload }
      })(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort()
          reject(new RequestTimeoutError())
        }, timeoutMs)
      }),
    ])
  } finally {
    clearTimeout(timeout)
  }
}
