// Proves whether the deployment can reach the Concordium node the x402 facilitator
// needs. Vercel functions are Lambda-backed and normally allow outbound TCP on any
// port, but the facilitator is worthless if port 20000 is blocked, so this measures it
// rather than assuming. Deploy as api/netprobe.mjs and GET /api/netprobe.
//
// Remove once the answer is recorded. It is a diagnostic, not a feature.

import net from 'node:net'
import tls from 'node:tls'

const HOST = 'grpc.testnet.concordium.com'
const PORT = 20000

function tcp() {
  return new Promise((resolve) => {
    const started = Date.now()
    const socket = net.createConnection({ host: HOST, port: PORT })
    const done = (ok, detail) => {
      socket.destroy()
      resolve({ ok, ms: Date.now() - started, detail })
    }
    socket.setTimeout(10000, () => done(false, 'timeout after 10s'))
    socket.on('connect', () => done(true, 'tcp connected'))
    socket.on('error', (err) => done(false, `${err.code || err.name}: ${err.message}`))
  })
}

function handshake() {
  return new Promise((resolve) => {
    const started = Date.now()
    const socket = tls.connect({ host: HOST, port: PORT, servername: HOST, rejectUnauthorized: false })
    const done = (ok, detail) => {
      socket.destroy()
      resolve({ ok, ms: Date.now() - started, detail })
    }
    socket.setTimeout(15000, () => done(false, 'tls timeout after 15s'))
    socket.on('secureConnect', () => {
      const cert = socket.getPeerCertificate()
      done(true, `tls ok, subject ${cert.subject?.CN || 'unknown'}`)
    })
    socket.on('error', (err) => done(false, `${err.code || err.name}: ${err.message}`))
  })
}

export default async function handler() {
  const tcpResult = await tcp()
  const tlsResult = tcpResult.ok ? await handshake() : { ok: false, detail: 'skipped, tcp failed' }
  return new Response(
    JSON.stringify(
      {
        host: HOST,
        port: PORT,
        reachable: tcpResult.ok && tlsResult.ok,
        tcp: tcpResult,
        tls: tlsResult,
        verdict: tcpResult.ok && tlsResult.ok
          ? 'the facilitator can reach Concordium from this deployment'
          : 'the facilitator CANNOT reach Concordium from this deployment; x402 needs another host',
      },
      null,
      2,
    ),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )
}
