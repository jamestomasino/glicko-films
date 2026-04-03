const fs = require('node:fs')
const path = require('node:path')
const { connectLambda, getStore } = require('@netlify/blobs')

const STORE_NAME = 'film-images'

exports.handler = async (event) => {
  try {
    // In Lambda compatibility mode, initialize Blobs context from the event.
    try {
      connectLambda(event)
    } catch {
      // No-op: explicit token/site fallback may still be available.
    }

    const key = normalizeKey(event.queryStringParameters?.key)
    if (!key) {
      return {
        statusCode: 400,
        body: 'Missing or invalid image key.'
      }
    }

    const store = resolveStore()
    const data = await store.get(key, { type: 'arrayBuffer' })
    if (!data) {
      return {
        statusCode: 404,
        body: 'Image not found.'
      }
    }

    const buffer = Buffer.from(data)
    return {
      statusCode: 200,
      isBase64Encoded: true,
      headers: {
        'content-type': contentTypeFromKey(key),
        'cache-control': 'public, max-age=31536000, immutable'
      },
      body: buffer.toString('base64')
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: `Failed to fetch image: ${error.message}`
    }
  }
}

function normalizeKey (rawKey) {
  if (!rawKey || typeof rawKey !== 'string') return null
  const key = rawKey.trim()
  if (!key || key.includes('..') || key.startsWith('/')) return null
  return key
}

function contentTypeFromKey (key) {
  if (key.endsWith('.png')) return 'image/png'
  if (key.endsWith('.webp')) return 'image/webp'
  if (key.endsWith('.avif')) return 'image/avif'
  return 'image/jpeg'
}

function resolveStore () {
  const token = process.env.NETLIFY_BLOBS_TOKEN
  const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID || readSiteIDFromState()

  if (token && siteID) {
    return getStore({
      name: STORE_NAME,
      token,
      siteID
    })
  }

  return getStore(STORE_NAME)
}

function readSiteIDFromState () {
  try {
    const statePath = path.resolve('.netlify/state.json')
    if (!fs.existsSync(statePath)) return null
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'))
    return state.siteId || null
  } catch {
    return null
  }
}
