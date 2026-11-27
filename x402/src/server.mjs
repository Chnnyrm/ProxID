/**
 * x402 facilitator and client service for ProxID.
 *
 * A facilitator verifies a client's signed payment and, when it is valid, submits it to
 * the chain having agreed to pay the network fee. ProxID's agent needs this so it can pay
 * a provider without holding the provider's keys and without the user paying gas.
 *
 * DESIGN DECISION: Two funded accounts, and neither belongs to a user:
 *   sponsor: 3LGnFKnaQpMCsTUd3LhefNJ1Fain5d4A31i3ZTzuRhzE9tLgXW   pays the network fee
 *   payer:   4EuBPU3CKVWkWxHxUtq9fhazzuCx9dWFkdL5TjUTwkAwZ3bj98   sends the payment
 * Both are operated by ProxID's backend and are already set in the Render environment.
 * A user never holds a key. The agent spends on the person's behalf after they consent,
 * and the person sees a price, an approval, and a receipt.
 * This is the design decision that makes the product usable: if a person had to manage
 * a wallet, none of them would.
 *
 * The chain work is done by @x402/concordium. This file provides the HTTP surface:
 *   GET  /health      liveness, sponsor and payer presence
 *   GET  /supported   the schemes and networks this facilitator will serve
 *   POST /pay         client signs payment requirements and returns signed payload
 *   POST /verify      check a signed payment without submitting it
 *   POST /settle      submit a signed payment and return the transaction hash
 *
 * Pure ASCII only.
 */

import http from 'node:http'
import { ExactConcordiumScheme } from '@x402/concordium/exact/facilitator'
import { ExactConcordiumScheme as ClientScheme } from '@x402/concordium/exact/client'
import { AccountAddress, buildBasicAccountSigner } from '@concordium/web-sdk'
import {
  CONCORDIUM_TESTNET_CAIP2,
  CONCORDIUM_TESTNET_GRPC,
  toConcordiumFacilitatorSigner,
} from '@x402/concordium'

const PORT = Number(process.env.PORT || 8080)

const NETWORK = process.env.CONCORDIUM_NETWORK_CAIP2 || CONCORDIUM_TESTNET_CAIP2

const RPC = process.env.CONCORDIUM_GRPC || CONCORDIUM_TESTNET_GRPC
const [NODE_HOST, NODE_PORT_RAW] = RPC.split(':')
const NODE_PORT = Number(NODE_PORT_RAW || 20000)

const SPONSOR_ADDRESS = process.env.X402_SPONSOR_ADDRESS || ''
const SPONSOR_PRIVATE_KEY = process.env.X402_SPONSOR_PRIVATE_KEY || ''

const PAYER_ADDRESS = process.env.X402_PAYER_ADDRESS || ''
const PAYER_PRIVATE_KEY = process.env.X402_PAYER_PRIVATE_KEY || ''

let scheme = null
let initError = null

/**
 * Build the facilitator scheme at boot. If the sponsor key is absent the service still starts
 * and reports honestly in /health.
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
  let payload = body?.paymentPayload ?? body?.payload
  const requirements = body?.paymentRequirements ?? body?.requirements
  if (!payload) throw new Error('missing paymentPayload')
  if (!requirements) throw new Error('missing paymentRequirements')
  if (!payload.accepted && requirements) {
    if (payload.signedTransaction || payload.sender) {
      payload = {
        x402Version: Number(requirements.x402Version || 2),
        accepted: requirements,
        payload,
      }
    } else {
      payload = {
        ...payload,
        accepted: requirements,
      }
    }
  }
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
      payerAddress: PAYER_ADDRESS || null,
      payerKeyPresent: Boolean(PAYER_PRIVATE_KEY),
      detail: initError,
    })
  },

  'GET /supported': async (_req, res) => {
    send(res, 200, {
      kinds: scheme ? [{ scheme: 'exact', network: NETWORK, extra: scheme.getExtra(NETWORK) ?? {} }] : [],
      signers: scheme ? { [NETWORK]: scheme.getSigners(NETWORK) } : {},
    })
  },

  /**
   * POST /pay
   * Accepts { requirements, payerPrivateKeyEnv? } and returns a signed payment payload.
   * Uses @x402/concordium/exact/client to sign transactions on the payer's behalf.
   *
   * Never logs a private key, never returns a private key, never echoes a private key.
   * /pay returns the signed payload only; it does not settle.
   */
  'POST /pay': async (req, res) => {
    let body
    try {
      body = await readJson(req)
    } catch (error) {
      return send(res, 400, { error: error.message })
    }

    const payerAddress = body?.payerAddress || PAYER_ADDRESS
    const keyEnvName = body?.payerPrivateKeyEnv || 'X402_PAYER_PRIVATE_KEY'
    const payerPrivateKey = body?.payerPrivateKey || process.env[keyEnvName] || PAYER_PRIVATE_KEY

    if (!payerAddress || !payerPrivateKey) {
      const missing = []
      if (!payerAddress) missing.push('X402_PAYER_ADDRESS')
      if (!payerPrivateKey) missing.push(keyEnvName)
      return send(res, 503, {
        error: `missing payer credentials: set ${missing.join(' and ')}`,
      })
    }

    const requirements = body?.requirements ?? body?.paymentRequirements
    if (!requirements) {
      return send(res, 400, { error: 'missing requirements in request body' })
    }

    // Enrich requirements if feePayer or network was omitted
    if (!requirements.network) {
      requirements.network = NETWORK
    }
    if (!requirements.extra) {
      requirements.extra = {}
    }
    if (!requirements.extra.feePayer && SPONSOR_ADDRESS) {
      requirements.extra.feePayer = SPONSOR_ADDRESS
    }
    if (!requirements.maxTimeoutSeconds || requirements.maxTimeoutSeconds <= 5) {
      requirements.maxTimeoutSeconds = 60
    }

    try {
      const clientSigner = {
        accountAddress: AccountAddress.fromBase58(payerAddress),
        signer: buildBasicAccountSigner(payerPrivateKey),
      }
      const client = new ClientScheme(clientSigner, {
        grpcUrl: `${NODE_HOST}:${NODE_PORT}`,
        useTls: true,
      })
      const version = Number(requirements.x402Version || 2)
      const created = await client.createPaymentPayload(version, requirements)

      const paymentPayload = {
        x402Version: version,
        accepted: {
          scheme: requirements.scheme || 'exact',
          network: requirements.network,
        },
        payload: created.payload,
      }

      send(res, 200, {
        x402Version: version,
        accepted: paymentPayload.accepted,
        payload: paymentPayload.payload,
        paymentPayload,
      })
    } catch (error) {
      const safeMessage = error?.message?.replace(/[0-9a-fA-F]{64}/g, '[REDACTED]') || String(error)
      send(res, 500, { error: `payment signing failed: ${safeMessage}` })
    }
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
  console.log(`  payer    ${PAYER_ADDRESS || 'MISSING'}`)
  if (initError) console.error(`  NOT READY: ${initError}`)
})

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    console.log(`${signal} received, closing`)
    server.close(() => process.exit(0))
  })
}
