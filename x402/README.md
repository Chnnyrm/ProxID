# ProxID x402 facilitator

A facilitator verifies a client's signed payment and, if it is valid, submits it to the
chain having agreed to pay the network fee. ProxID needs one so proxidAI can pay a
provider without holding the provider's keys, and so the person does not pay gas.

No public facilitator exists for Concordium, which is why this is here.

## Why a container on Render, and not a serverless function

The facilitator talks gRPC to a Concordium node on port 20000, over a connection it wants
to keep. Serverless platforms are built around short HTTP requests, and Cloudflare Workers
cannot speak HTTP/2 gRPC at all: they can open a socket and then have no protocol to use
on it. A plain container on Render has none of those limits.

## Endpoints

    GET  /health      liveness, and whether a sponsor key is present
    GET  /supported   the schemes and networks this facilitator serves
    POST /verify      check a signed payment without submitting it
    POST /settle      submit it and return the transaction hash

/verify and /settle both take `{ paymentPayload, paymentRequirements }`.

## Environment

    X402_SPONSOR_ADDRESS       the sponsor account, base58check
    X402_SPONSOR_PRIVATE_KEY   its Ed25519 private key, hex
    CONCORDIUM_NETWORK_CAIP2   defaults to testnet
    CONCORDIUM_GRPC            defaults to grpc.testnet.concordium.com:20000
    PORT                       injected by Render

Without the two sponsor variables the service starts, reports `not_ready` with the reason,
and refuses to settle. It never reports a payment as settled unless it settled.

## Deploy

    Render -> New -> Blueprint -> this repository
    render.yaml is read automatically
    set the two sponsor variables in the dashboard

Then point an uptime monitor at `/health` every ten minutes, so the free instance does not
sleep during judging.

## Check it

    npm run check

Boots the real server with no credentials and asserts it reports itself as not ready
rather than crashing or claiming to be able to settle. Add this to any CI for the
directory.

## What is still missing

The client side. The agent needs to obtain a payment payload and present it, which is the
`exact/client` export of the same package. Nothing in ProxID calls this yet; the backend
has no code path that reaches `/settle`.
