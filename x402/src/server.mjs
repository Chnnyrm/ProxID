/**
 * x402 facilitator for ProxID.
 *
 * A facilitator verifies a client's signed payment and, when it is valid, submits it to
 * the chain having agreed to pay the network fee. ProxID's agent needs this so it can pay
 * a provider without holding the provider's keys and without the user paying gas.
 *
 * The chain work is done by @x402/concordium. This file is the HTTP surface around it,
 * because the package ships the protocol, not a server.
 *
 * Endpoints, matching the x402 facilitator specification:
 *   GET  /health      liveness, and whether a sponsor key is present
 *   GET  /supported   the schemes and networks this facilitator will serve
 *   POST /verify      check a signed payment without submitting it
 *   POST /settle      submit a signed payment and return the transaction hash
 *
 * Every failure returns a reason a caller can act on. Nothing is reported as settled
 * unless it settled.
 */

import http from 'node:http'
import { ExactConcordiumScheme } from '@x402/concordium/exact/facilitator'
import {
  CONCORDIUM_TESTNET_CAIP2,
  CONCORDIUM_TESTNET_GRPC,
  toConcordiumFacilitatorSigner,
} from '@x402/concordium'

const PORT = Number(process.env.PORT || 8080)

// Taken from the SDK rather than written here, so a change upstream is picked up and a
// typo in a CAIP-2 identifier cannot silently point the facilitator at another network.
const NETWORK = process.env.CONCORDIUM_NETWORK_CAIP2 || CONCORDIUM_TESTNET_CAIP2

const RPC = process.env.CONCORDIUM_GRPC || CONCORDIUM_TESTNET_GRPC
const [NODE_HOST, NODE_PORT_RAW] = RPC.split(':')
const NODE_PORT = Number(NODE_PORT_RAW || 20000)

const SPONSOR_ADDRESS = process.env.X402_SPONSOR_ADDRESS || ''
const SPONSOR_PRIVATE_KEY = process.env.X402_SPONSOR_PRIVATE_KEY || ''

let scheme = null
let initError = null

/**
 * Build the scheme once at boot. If the sponsor key is absent the service still starts
 * and reports honestly instead of pretending to be ready, so a missing variable shows up
 * in /health rather than as a confusing failure during a payment.
 */
function initialise() {
  if (!SPONSOR_ADDRESS || !SPONSOR_PRIVATE_KEY) {
    initError = 'no sponsor credentials: set X402_SPONSOR_ADDRESS and X402_SPONSOR_PRIVATE_KEY'
    return
  }
  try {
    const signer = toConcordiumFacilitatorSigner(SPONSOR_ADDRESS, SPONSOR_PRIVATE_KEY, {
      host: NODE_HOST,
      port: NODE_PORT,
      useTls: true,
      network: NETWORK,
    })
    scheme = new ExactConcordiumScheme({ signer, requireFinalization: true })
  } catch (error) {
    initError = `could not build the sponsor signer: ${error?.message || String(error)}`
  }
}

function send(res, status, body) {
  const payload = JSON.stringify(body, null, 2)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
  })
  res.end(payload)
}

function readJson(req, limitBytes = 262144) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limitBytes) {
        reject(new Error('request body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (chunks.length === 0) {
        reject(new Error('empty request body'))
        return
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new Error('request body is not valid JSON'))
      }
    })
    req.on('error', reject)
  })
}

/** Both /verify and /settle take the same shape: { paymentPayload, paymentRequirements }. */
function parsePaymentRequest(body) {
  const payload = body?.paymentPayload ?? body?.payload
  const requirements = body?.paymentRequirements ?? body?.requirements
  if (!payload) throw new Error('missing paymentPayload')
  if (!requirements) throw new Error('missing paymentRequirements')
  return { payload, requirements }
}

const routes = {
  'GET /health': async (_req, res) => {
    send(res, scheme ? 200 : 503, {
      status: scheme ? 'ready' : 'not_ready',
      network: NETWORK,
      node: `${NODE_HOST}:${NODE_PORT}`,
      sponsorAddress: SPONSOR_ADDRESS || null,
      sponsorKeyPresent: Boolean(SPONSOR_PRIVATE_KEY),
      detail: initError,
    })
  },

  'GET /supported': async (_req, res) => {
    send(res, 200, {
      kinds: scheme ? [{ scheme: 'exact', network: NETWORK, extra: scheme.getExtra(NETWORK) ?? {} }] : [],
      signers: scheme ? { [NETWORK]: scheme.getSigners(NETWORK) } : {},
    })
  },

  'POST /verify': async (req, res) => {
    if (!scheme) return send(res, 503, { isValid: false, invalidReason: initError })
    let parsed
    try {
      parsed = parsePaymentRequest(await readJson(req))
    } catch (error) {
      return send(res, 400, { isValid: false, invalidReason: error.message })
    }
    try {
      const result = await scheme.verify(parsed.payload, parsed.requirements)
      send(res, 200, result)
    } catch (error) {
      send(res, 200, { isValid: false, invalidReason: error?.message || String(error) })
    }
  },

  'POST /settle': async (req, res) => {
    if (!scheme) return send(res, 503, { success: false, errorReason: initError })
    let parsed
    try {
      parsed = parsePaymentRequest(await readJson(req))
    } catch (error) {
      return send(res, 400, { success: false, errorReason: error.message })
    }
    try {
      const result = await scheme.settle(parsed.payload, parsed.requirements)
      // A settle response carries success and the transaction hash. Never upgrade a
      // failure into a success here; the caller decides what to show.
      send(res, 200, result)
    } catch (error) {
      send(res, 200, { success: false, errorReason: error?.message || String(error) })
    }
  },
}

const server = http.createServer(async (req, res) => {
  const path = (req.url || '/').split('?')[0].replace(/\/+$/, '') || '/'
  const key = `${req.method} ${path}`
  const route = routes[key]
  if (!route) {
    const known = Object.keys(routes).join(', ')
    return send(res, 404, { error: `no route for ${key}`, known })
  }
  try {
    await route(req, res)
  } catch (error) {
    if (!res.headersSent) send(res, 500, { error: error?.message || String(error) })
  }
})

initialise()

server.listen(PORT, '0.0.0.0', () => {
  console.log(`x402 facilitator listening on :${PORT}`)
  console.log(`  network  ${NETWORK}`)
  console.log(`  node     ${NODE_HOST}:${NODE_PORT}`)
  console.log(`  sponsor  ${SPONSOR_ADDRESS || 'MISSING'}`)
  if (initError) console.error(`  NOT READY: ${initError}`)
})

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    console.log(`${signal} received, closing`)
    server.close(() => process.exit(0))
  })
}
