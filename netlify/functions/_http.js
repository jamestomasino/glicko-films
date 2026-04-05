module.exports = {
  jsonResponse,
  noStoreJsonResponse,
  withErrorHandling
}

function jsonResponse (statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...extraHeaders
    },
    body: JSON.stringify(body)
  }
}

function noStoreJsonResponse (statusCode, body, extraHeaders = {}) {
  return jsonResponse(statusCode, body, {
    'cache-control': 'no-store',
    ...extraHeaders
  })
}

function withErrorHandling (fn, {
  source = 'function',
  message = 'Internal server error.',
  noStore = false,
  onError = null
} = {}) {
  return async (event, context) => {
    try {
      return await fn(event, context)
    } catch (error) {
      const details = error instanceof Error ? { message: error.message } : { message: String(error) }
      console.error(`${source} failed`, details)
      if (typeof onError === 'function') {
        try {
          await onError(error, event, context)
        } catch (hookError) {
          const hookMessage = hookError instanceof Error ? hookError.message : String(hookError)
          console.error(`${source} error-hook failed`, { message: hookMessage })
        }
      }
      return noStore
        ? noStoreJsonResponse(500, { error: message })
        : jsonResponse(500, { error: message })
    }
  }
}
