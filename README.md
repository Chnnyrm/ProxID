# ProxID

A hyper-local services marketplace where every provider is a verified human, and the
AI agent that runs the work is a registered, accountable on-chain identity.

Hiring someone local starts with a stranger and a leap of faith. ProxID fixes the
stranger part.

Built for the Concordium Trusted Agents Hackathon, on Concordium testnet.

Live demo: add the URL once it is deployed.
Judge demo: press **Launch Judge Demo** on the landing page. No account, no wallet.

---

## What it does

A person posts a job and nearby providers are matched by real geography, using
PostGIS distance queries rather than a city-wide list.

Every provider on the map carries a zero-knowledge proof that a verified individual
stands behind the account. The proof answers one question, is this a verified human,
and reveals nothing else. No name, no date of birth, no documents, not to the
platform and not to the person hiring.

The AI agent that helps run the job has an identity of its own. It is registered in
the Concordium agent registry, owned by an identity-verified account, and publishes
an agent card whose hash is anchored on chain. Anyone can fetch that card, confirm
the owner, and confirm it has not changed since registration, without trusting our
server. The agent holds a scoped credential rather than borrowing the user's
identity, so delegating work never exposes a master identity.

Work is paid through x402 on Concordium. The agent pays per request, gaslessly,
with a sponsor covering the network fee. Before acting on someone's behalf, the
person approves the exact request in the Concordium ID app, and the app checks the
prompt text against an on-chain anchor so the request cannot be altered in transit.

Verifications, consents and payments are anchored on chain as hashes. The records
themselves stay off chain, so no personal data reaches a public ledger and it can
still be erased. Deleting the off-chain row and its nonce makes the on-chain hash
unmatchable, which is what makes the design GDPR-compatible.

## The three Concordium components

| Component | What it does here |
| --- | --- |
| Verify and Access | proves a provider is a verified human, without revealing who |
| Agent Registry | registers the agent, binds it to a verified owner, anchors its card |
| x402 payments | lets an agent pay per request without holding the gas token |

## The demo

The Judge Demo seeds a neighbourhood and lets a reviewer walk four beats:

1. **A consumer-backed agent** posts a job and sees nearby verified providers.
2. **A company-backed agent** accepts it. Both are verified, both have their own
   on-chain identity.
3. **A proof is requested and approved.** Age over 18, proven without revealing a
   date of birth.
4. **The agent pays, and the receipt is anchored.** Payment settles, and a hash goes
   on chain while the record stays off chain.

The seed deliberately includes **one provider who fails verification**, so the check
is visibly doing work rather than passing everything.

## Architecture

```
frontend/   React 18, Vite, TypeScript, Tailwind, react-leaflet
backend/    FastAPI, SQLAlchemy async, PostGIS
            app/api     routers, no business logic
            app/services business logic, no database driver
            app/crud    every query that touches the database
            app/core    configuration, gateways, database
```

Dependencies point inward. Services never import a database driver. Every outbound
call goes through a gateway so it can be replaced and tested.

## Stack, all free tier

| Piece | Choice | Why |
| --- | --- | --- |
| Database | Neon Postgres with PostGIS | free tier, includes PostGIS |
| Maps | react-leaflet with OpenStreetMap | no API key, no billing |
| Identity | Concordium Verify and Access | zero-knowledge, no document storage |
| Registry | Concordium Agent Registry | on-chain agent identity |
| Payments | x402 with `@x402/concordium` | sponsored fees, no gas token needed |
| LLM | Groq | free tier, fast tool calling |

## Run it locally

Prerequisites: Node 20 or newer, Python 3.12, Docker or a PostGIS database.

**Database.** Create a Neon or Supabase project, then in the SQL editor:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
SELECT PostGIS_Version();
```

The second line must return a version. Use the **direct** connection host, not the
pooler, when running migrations locally.

**Backend.**

```bash
cd backend
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
cp .env.example .env          # then set DATABASE_URL and a SECRET_KEY of 32+ chars
alembic upgrade head
python -m app.scripts.seed_demo
uvicorn app.main:app --reload --port 8000
```

**Frontend.**

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Open the app and press **Launch Judge Demo**.

**Checks.**

```bash
cd backend  && python arch_check.py && python -m pytest -q
cd frontend && npx tsc --noEmit -p tsconfig.app.json && npx vitest run && npm run build
```

## Design system

Three colours carry everything.

| Token | Value | Used for |
| --- | --- | --- |
| Soft Sand | `#F0E5DB` | page canvas in light mode, text in dark mode |
| Mocha Green | `#474329` | text and borders in light, base surface in dark |
| Watermelon Pink | `#FC75B4` | the one loud accent: CTAs, active pins, badges, focus |

Contrast is computed, not assumed. Measured WCAG ratios:

```
mocha on sand            8.05:1
mocha on card #FAF4ED    9.14:1
ink on pink              6.87:1
sand on mocha            8.05:1
sand on card #2A281A    11.95:1
pink on card             5.89:1
pink on sand             2.03:1   fails for text
```

Two consequences of that last line. Pink is never body text in light mode; buttons
use ink on pink. And pink alone fails the 3:1 needed for a focus ring, so the ring is
2px pink around a 4px mocha keyline.

## Payments and spending safety

Concordium's protocol-level spending locks are DevNet only. The workaround until they
ship is what a careful operator would do anyway: the agent holds its own low-balance
account, with a per-payment cap, a daily cap, and a deny-by-default recipient
allowlist. The interface is shaped so protocol locks drop in without a rewrite.

Eight of the nine x402 validation rules are enforced here as testable code. The ninth,
the sender signature, belongs to the facilitator, and we say so rather than claiming a
check we cannot perform.


## Licence

MIT.
