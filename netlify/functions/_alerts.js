module.exports = {
  reportError
}

async function reportError ({ source, error, context = {} }) {
  const message = error instanceof Error ? error.message : String(error || 'Unknown error')
  console.error(`[alert:${source}]`, { message, context })

  const webhook = process.env.ALERT_WEBHOOK_URL || ''
  if (!webhook) return

  const payload = {
    source,
    message,
    context,
    timestamp: new Date().toISOString(),
    level: 'error'
  }

  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: `films alert: ${source} - ${message}`, ...payload })
    })
  } catch (notifyError) {
    console.error('[alert:notify-failed]', {
      source,
      message: notifyError instanceof Error ? notifyError.message : String(notifyError)
    })
  }
}
