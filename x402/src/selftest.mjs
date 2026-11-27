/**
 * Proves the service can start and answer, without a sponsor key and without a network.
 *
 * Three production outages in this project came from code that imported locally and
 * failed on the platform. This does the opposite: it boots the real server with no
 * credentials and asserts it reports itself as not ready rather than crashing or lying.
 */

import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const PORT = 8099

function fail(message) {
  console.error(`[FAIL] ${message}`)
  process.exit(1)
}

const child = spawn(process.execPath, [path.join(here, 'server.mjs')], {
  env: { ...process.env, PORT: String(PORT), X402_SPONSOR_ADDRESS: '', X402_SPONSOR_PRIVATE_KEY: '' },
  stdio: ['ignore', 'pipe', 'pipe'],
})

let booted = false
child.stdout.on('data', (d) => { if (String(d).includes('listening')) booted = true })
child.stderr.on('data', (d) => process.stderr.write(d))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

try {
  for (let i = 0; i < 50 && !booted; i += 1) await sleep(100)
  if (!booted) fail('the server did not report that it was listening')
  console.log('[OK] server boots with no credentials')

  const health = await fetch(`http://127.0.0.1:${PORT}/health`)
  const body = await health.json()
  if (health.status !== 503) fail(`/health must be 503 without a sponsor key, got ${health.status}`)
  if (body.status !== 'not_ready') fail(`/health must say not_ready, got ${body.status}`)
  if (!body.detail) fail('/health must explain what is missing')
  console.log(`[OK] /health is honest: ${body.detail}`)

  const supported = await fetch(`http://127.0.0.1:${PORT}/supported`)
  const kinds = (await supported.json()).kinds
  if (Array.isArray(kinds) && kinds.length > 0) fail('/supported must list no schemes without a signer')
  console.log('[OK] /supported claims nothing it cannot do')

  const settle = await fetch(`http://127.0.0.1:${PORT}/settle`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ paymentPayload: {}, paymentRequirements: {} }),
  })
  if (settle.status !== 503) fail(`/settle must be 503 without a signer, got ${settle.status}`)
  console.log('[OK] /settle refuses rather than pretending')

  const missing = await fetch(`http://127.0.0.1:${PORT}/nope`)
  if (missing.status !== 404) fail(`unknown routes must 404, got ${missing.status}`)
  console.log('[OK] unknown routes are 404 with the known list')

  console.log('\n[OK] facilitator selftest passed')
} finally {
  child.kill('SIGTERM')
}
