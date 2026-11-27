# ProxID x402 Facilitator and Client Service

A facilitator verifies a client's signed payment and, if it is valid, submits it to the
chain having agreed to pay the network fee. ProxID needs one so proxidAI can pay a
provider without holding the provider's keys, and so the person does not pay gas.

No public facilitator exists for Concordium, which is why this is here.

## The Dual-Account Architecture (Design Decision)

Two funded accounts, and neither belongs to a user:

    sponsor     3LGnFKnaQpMCsTUd3LhefNJ1Fain5d4A31i3ZTzuRhzE9tLgXW   pays the network fee
    payer       4EuBPU3CKVWkWxHxUtq9fhazzuCx9dWFkdL5TjUTwkAwZ3bj98   sends the payment

Both are operated by ProxID's backend and are already set in the Render environment.
A user never holds a key. The agent spends on the person's behalf after they consent, and
the person sees a price, an approval, and a receipt.

This is the architectural decision that makes the product usable: if a person had to
manage a wallet, none of them would.

## Why a container on Render, and not a serverless function

The facilitator talks gRPC to a Concordium node on port 20000, over a connection it wants
to keep. Serverless platforms are built around short HTTP requests, and Cloudflare Workers
cannot speak HTTP/2 gRPC at all: they can open a socket and then have no protocol to use
on it. A plain container on Render has none of those limits.

## Endpoints

    GET  /health      liveness, sponsor and payer presence
    GET  /supported   the schemes and networks this facilitator serves
    POST /pay         client signs payment requirements and returns signed payload
    POST /verify      check a signed payment without submitting it
    POST /settle      submit it and return the transaction hash

/verify and /settle both take `{ paymentPayload, paymentRequirements }`.
/pay takes `{ requirements, payerPrivateKeyEnv? }`.

## Environment

    X402_SPONSOR_ADDRESS       the sponsor account, base58check
    X402_SPONSOR_PRIVATE_KEY   its Ed25519 private key, hex
    X402_PAYER_ADDRESS         the backend payer account, base58check
    X402_PAYER_PRIVATE_KEY     its Ed25519 private key, hex
    CONCORDIUM_NETWORK_CAIP2   defaults to testnet
    CONCORDIUM_GRPC            defaults to grpc.testnet.concordium.com:20000
    PORT                       injected by Render

Without credentials the service starts, reports `not_ready` with the reason, and refuses
to sign or settle. It never reports a payment as settled unless it settled on chain.
Private keys are never logged, echoed, or included in responses.

## Check it

    npm run check

Boots the real server with no credentials and asserts it reports itself as not ready
rather than crashing or claiming to be able to settle.
