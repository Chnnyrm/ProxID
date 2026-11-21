# ProxID task ledger

Every task, its state, the file it touches, the command that proves it, and what a
human must do that an agent cannot. Written so that someone who has never read the
code can pick this up and know exactly where things stand.

Legend
  [x] done and verified by running something
  [~] written but never executed, or executed but not verified
  [ ] not started
  [!] blocked, waiting on a human or an external fact
  [H] human only, an agent cannot do it

Last updated: 21 November 2026.

---

## Phase 0 - Human prerequisites

### 0.1 Hackathon registration
- [x] [H] Encode project created, named ProxID
- [x] [H] Team added: Kosisochukwu, Chinoyerem
- [x] [H] Idea description pasted
- [x] [H] Checkpoint 1 submitted, due 22 Nov 23:59 UTC
- Proof: project visible on the Encode dashboard with both members listed.

### 0.2 Concordium testnet accounts
- [x] [H] Browser wallet installed
- [x] [H] Network switched to Testnet
- [x] [H] Identity 1 created via Concordium Testnet IDP, nationality NG, mock passport
- [x] [H] Account 1 created: `4nk2Ko3JT5MTxxxHiZo87pdMmRXqvTn8KjRUQV75BLbkb8UWPy`
      Note: the string above was sent with `xxx` in the middle and is INCOMPLETE.
      The exact address must be re-sent before any code depends on it.
- [x] [H] 20,000 testnet CCD claimed on account 1
- [x] [H] Identity 2 created, nationality DK (EU)
- [x] [H] Account 2 created: `3LGnFKnaQpMCsTUd3LhefNJ1Fain5d4A31i3ZTzuRhzE9tLgXW`
      Verified: 50 characters, the correct Concordium address length.
- [ ] [H] 20,000 testnet CCD claimed on account 2
- [ ] [H] EU testnet EUR faucet claimed on account 2 (needs EU nationality proof)
- Proof for account 2: not yet confirmed on a working explorer. `testnet.ccdexplorer.io`
      and `ccdscan.io` did not respond from this machine on 21 Nov; `ccdexplorer.io`
      answered 302. Explorer reachability is still unverified.
- Variables: `CONCORDIUM_ACCOUNT_ADDRESS`, `CONCORDIUM_NETWORK=testnet`

### 0.3 Database
- [x] [H] Neon project created, database name `proxid`
- [x] [H] Connection string supplied
- [x] PostGIS extension created on the database
- [x] `SELECT PostGIS_Version()` returns `3.6 USE_GEOS=1 USE_PROJ=1 USE_STATS=1`
- Finding: the **pooler** host fails with asyncpg ("connection was closed in the
      middle of operation"). The **direct** host works. Local work uses the direct
      host. Vercel is serverless and will exhaust direct connections, so the pooled
      host must be made to work before deploy. See task 5.2.
- Variables: `DATABASE_URL`

### 0.4 Organiser questions
- [ ] [H] Ask in Discord whether x402.org's facilitator settles
      `ccd:4221332d34e1694168c2a0c0b3fd0f27` on testnet
- Resolved by other means: the npm package `@x402/concordium` 2.32.0 ships its own
      Facilitator, so we do not need an external one. The question is now optional.
- [x] [H] Prior-work rules: organisers confirmed existing codebases are allowed
      (workshop Q&A). No written answer obtained; treated as settled.

---

## Phase 1 - Research

- [x] Written research crawled and saved: `kss/ProxID-RESEARCH.md`, 1615 lines
- [x] Workshop summaries saved: `kss/ProxID-WORKSHOP-CORRECTIONS.md`
- [x] Verified `@concordium/x402` does NOT exist (npm 404)
- [x] Verified `@x402/concordium` DOES exist at 2.32.0, exports /exact/{client,server,facilitator}
- [x] Verified `demo.veriox.io` has no published API
- [x] Testnet CIS-8004 contract `12802,0`, CIS-8 `12801,0` (from live contract_info)
- [x] Testnet CAIP-2 `ccd:4221332d34e1694168c2a0c0b3fd0f27`
- [ ] Confirm whether the standard is named CIS-804 or CIS-8004. Docs say 8004,
      workshops say 804. Code comments use 8004; user-facing copy avoids the name.
- [ ] Confirm the contract at `12802,0` actually behaves as an agent registry by
      calling a read entrypoint.

---

## Phase 2 - Scaffold

Built and pushed. HEAD `097c998`, 12 commits.

### 2.1 Repository
- [x] `git init` at `kss/ProxID`, branch `main`
- [x] Public GitHub repo `Ksschkw/ProxID`
- [x] `.gitignore` covers node_modules, venv, .env, .env.local, *.pyc, __pycache__, dist, .vercel
- [x] `house-standard.md` copied in and obeyed
- [x] Fork created at `Chnnyrm/ProxID`, public, head `097c998`
      Note: the fork reports `parent: none`, so GitHub treats it as detached and
      there is NO "Sync fork" button. See 6.1 for the manual upstream setup.

### 2.2 Architecture gate
- [x] `python arch_check.py` returns `[OK] architecture clean`
- Checks layers, dependency direction, ASCII only, config placement, no raw SQL in services.
- [x] A test proves the gate fails when broken (house standard 15)

### 2.3 Backend
- [x] FastAPI app imports cleanly
- [x] 40 API paths in the OpenAPI schema
- [x] 75 tests pass
- [x] Red/green evidence for 4 behaviours:
      WKT axis order swapped -> 2 geo tests fail
      exact-amount rule disabled -> 1 x402 test fails
      audit field filtering removed -> 1 test fails
      WebMCP auth gating removed -> 3 registry tests fail
- [ ] PyPI unreachable from this machine, so the venv borrows Gigr's site-packages via
      an uncommitted `_proxid_bootstrap.pth`. `requirements.txt` is the real spec.
      On a networked machine the correct install is
      `pip install -r requirements.txt -r requirements-dev.txt`.
      Verify: a clean venv installs and `python -c "import app.main"` still works.

### 2.4 Frontend
- [x] `npx tsc --noEmit -p tsconfig.app.json` exit 0
- [x] `npm run build` succeeds, 473 kB / 145 kB gzip
- [x] 5 vitest tests pass
- [x] React 18 with react-leaflet 4 (react-leaflet 5 requires React 19)
- [x] Tailwind 3.4 with a config file, tokens as CSS custom properties

### 2.5 Design system
- [x] Soft Sand `#F0E5DB`, Mocha Green `#474329`, Watermelon Pink `#FC75B4` as tokens
- [x] Light and dark themes, toggle persists, prefers-color-scheme fallback
- [x] Contrast computed, not assumed:
      mocha on sand 8.05 | mocha on card #FAF4ED 9.14 | ink on pink 6.87
      sand on mocha 8.05 | sand on card #2A281A 11.95 | pink on card 5.89
- [x] Pink on sand is 2.03:1, so pink is NEVER body text in light mode
- [x] Pink alone fails 3:1 as a focus ring, so the ring is 2px pink + 4px mocha keyline
- [x] Map tiles styled for dark mode, OpenStreetMap only, no paid key

### 2.6 Data model
- [x] Tables: users, jobs, service_listings, job_messages, categories, user_sessions,
      verification_requests, x402_receipts, audit_events, agent_tool_logs, alembic_version
- [x] Added: concordium_account_address, concordium_verified, concordium_zk_proof_ref,
      cis8004_agent_id, x402_tx_hash, agent_account_address, agent_verified
- [x] Dropped every Solana and cNFT column
- [x] Migration begins `CREATE EXTENSION IF NOT EXISTS postgis`

### 2.7 Ported from Gigr
- [x] PostGIS proximity: ST_DWithin on geography with radius * 1000, and spheroid
      distance via ST_DistanceSphere on geometry. Axis order pinned by a test.
- [x] Groq client with multi-key rotation
- [x] Cloudinary and Brevo clients
- [x] Google OAuth, access-token to tokeninfo with an audience check
- [x] react-leaflet map
- [x] WebMCP registry with auth gating; search_providers, get_provider_reputation,
      post_job, accept_job, send_message; fund_escrow and release_escrow replaced by
      initiate_x402_payment and settle_x402_payment
- [x] Agent tool-calling loop and autonomy policy
- [x] Three behaviour changes documented: hotness and text relevance moved into SQL
      (pagination was broken), status transitions are one conditional UPDATE,
      vouch distance boost became verified-human boost

### 2.8 Left behind deliberately
- [x] All Solana, Anchor, cNFT, Underdog, PayPal, Walrus, Aurora code
- [x] Wallet adapters and the payment-rail toggle
- [x] Escrow and milestone payments
- [x] Memory tools

---

## Phase 3 - Database execution

### 3.1 Migration
- [x] `alembic upgrade head` ran against Neon, `0001_initial` applied
- [x] Verified 12 tables exist
- [x] Verified the four Concordium columns exist on `users`
- [x] Verified `postgis_version()` returns 3.6
- Command used:
      DATABASE_URL='postgresql+asyncpg://...@ep-...direct.../proxid?ssl=require' \
      SECRET_KEY='...' .venv/bin/python -m alembic upgrade head

### 3.2 Seed
- [x] `python -m app.scripts.seed_demo` ran, created 38 rows
- [x] Second run created 0, updated 38, proving it is a true no-op
- [x] Seeded: users 5, jobs 4, service_listings 5, job_messages 6, agent_tool_logs 5,
      audit_events 5, verification_requests 1, x402_receipts 2, categories 5
- [x] `Ada (judge demo)` verified, role both
- [x] `Northgate Facilities Ltd` verified provider, the company-backed agent
- [x] `Ifeoma Nwosu` verified FALSE, a provider who fails the check on purpose
- [x] x402 receipts all status `demo`
- [x] Every seeded row carries `is_demo`
- [x] Chain-shaped placeholders are `demo-` prefixed so they cannot parse as addresses
- [x] A test asserts the placeholders are not valid base58 or 64-hex

### 3.3 Not yet done
- [ ] Run the API and confirm `/auth/demo-login` issues a session
- [ ] Load the frontend and confirm the four beats render
- [ ] Confirm the map shows seeded providers at Yaba coordinates
- [ ] Confirm the deliberately-unverified provider is visibly distinguishable

---

## Phase 4 - Concordium integration

Nothing here has run against a network. Every path returns `not_configured`.

### 4.1 x402
- [x] `x402_service.py` written against the real `@x402/concordium` 2.32.0 API
- [x] No facilitator written; the package ships one
- [x] 8 of 9 verification rules enforced locally as testable code
- [ ] Rule 9 (sender signature) delegated to the facilitator and stated as such
- [!] A Node bridge is required: the package is TypeScript, the backend is Python.
      This is the highest-risk piece and is NOT built. See 5.4.
- [ ] Decide whether the bridge is a separate service or runs beside FastAPI
- [ ] Wire `initiate_x402_payment` and `settle_x402_payment` to the bridge
- [ ] Prove one payment end to end on testnet

### 4.2 Identity, Verify and Access
- [x] `identity_service.py` with a narrow adapter interface
- [x] `VerioxIdentityAdapter` reads its paths from configuration, no defaults
- [x] `StubIdentityAdapter` returns not_configured
- [!] Veriox has no published API, so the real paths are unknown. Research the
      integration guide or ask in Discord before implementing.
- [ ] Implement the real Veriox call once its interface is known
- [ ] Prove one verification on testnet
- [ ] Decide what identifier binds a provider profile to a verification. This is
      undocumented and must be designed, not discovered.

### 4.3 Agent registry
- [x] `registry_service.py` generates an agent card with a concordium-badge v1 block
- [x] SHA-256 integrity hash implemented
- [x] The five verification checks written: official contract, status Active, live URL
      matches registered URL, card hash matches on-chain hash, owner matches NFT owner
- [ ] Point at testnet contract `12802,0`, unproven
- [ ] Register one agent end to end and confirm `check_badge` reports valid
- [ ] Decide whether CIS-8 cross-chain binding is usable; it is reported broken on
      testnet. If broken, drop it and use topology A or C.

### 4.4 Audit
- [x] `audit_service.py` append-only and structured
- [x] Off-chain row, random nonce, SHA-256 of (nonce + canonical payload)
- [x] Only the hash would be anchored via `registerData`
- [x] No prompt, output, body, email or name can enter the hash input
- [x] A test proves the field filter fails when removed
- [ ] Anchor one real hash on testnet

### 4.5 Spending safety
- [x] Agent isolated in its own low-balance account
- [x] Per-payment and daily caps
- [x] Deny-by-default recipient allowlist
- [x] Shaped to swap into protocol locks when those leave DevNet
- [ ] Prove a payment over the cap is refused

---

## Phase 5 - Deployment

### 5.1 One Vercel project
- [ ] Decide the topology. Vercel runs Python functions and static output, but the
      x402 package is TypeScript, so the Node bridge needs its own function or host.
- [ ] `vercel.json` for the monorepo
- [ ] Backend as a Python function, frontend as static output
- [ ] Confirm Vercel detects FastAPI correctly, do not assume

### 5.2 Database from serverless
- [!] The Neon pooler host fails with asyncpg locally. Serverless will exhaust the
      direct host. This MUST be fixed before deploy.
- [ ] Options: `?statement_cache_size=0` on the pooled URL, pgBouncer-compatible
      settings, or a different driver. Test against the pooler host specifically.
- [ ] Confirm connection count stays inside the free tier

### 5.3 Environment variables
- [ ] `DATABASE_URL` with the pooled host, once 5.2 is solved
- [ ] `SECRET_KEY` at least 32 characters
- [ ] `CONCORDIUM_ACCOUNT_ADDRESS`
- [ ] `CONCORDIUM_NETWORK=testnet`
- [ ] `GROQ_API_KEY`
- [ ] `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- [ ] `CLOUDINARY_*`
- [ ] `VERIOX_*` once known
- [ ] Confirm nothing secret reaches the frontend bundle

### 5.4 The Node bridge
- [ ] Build it. Highest risk item in the project.
- [ ] Prove it responds locally
- [ ] Prove it deploys
- [ ] Prove one payment through it

---

## Phase 6 - Repository and collaboration

### 6.1 The fork
- [x] `Chnnyrm/ProxID` is public and carries all commits to `097c998`
- [!] GitHub reports `parent: none`, so the fork is detached and has no Sync fork
      button. Chinoyerem must add upstream manually, once:
      ```
      cd ProxID
      git remote add upstream https://github.com/Ksschkw/ProxID.git
      git fetch upstream
      git merge upstream/main
      ```
- [!] Ksschkw has read-only access to the fork (`push: false`), so an agent cannot
      push there. Two options:
      a) she pushes her own branches and opens pull requests to `Ksschkw/ProxID`
      b) she adds Ksschkw as a collaborator, as she did for `Chnnyrm/Reckon`
- [ ] Agree which branch naming convention to use. Recommended: `feat/short-name`
      and `fix/short-name`, never work directly on main.

### 6.2 Working agreement
- [ ] Every change on a branch, never on main
- [ ] Pull request into `Ksschkw/ProxID` main, reviewed before merge
- [ ] Commit author is whoever wrote it. If an agent produces the work at
      Chinoyerem's instruction, the author is Chinoyerem, or Ksschkw with her as
      co-author, agreed case by case and never silently.
- [ ] Before any merge: `python arch_check.py`, `pytest`, `tsc --noEmit`,
      `vitest run`, `npm run build`

### 6.3 README
- [ ] State plainly which parts are ported from a previous project and which are new
- [ ] Document the $0 free-tier setup end to end
- [ ] Document the Judge Demo button and the credentials
- [ ] Include the contrast table
- [ ] Note that protocol-level locks are DevNet only and what we do instead

---

## Phase 7 - Submission (due 9 Dec 23:59 UTC)

- [ ] Description and components
- [ ] Public repo link
- [ ] Demo video, three minutes maximum, direct link not a briefing page
- [ ] CCDExplorer link, `ccdexplorer.io` NOT `ccdscan.io`
- [ ] Path to production, written early because it needs no code
- [ ] Social post tagging Concordium and Encode

Judging criteria, from the programme page:
  1 depth of integration, naming identity, Agent Registry and agent payments
  2 credible path to production
  3 it works
  4 usefulness
Not about transaction counts.

The four beats the workshops say judges want to see:
  a company-backed agent interacting with a consumer-backed agent
  identity or age verified by zero-knowledge proof
  human consent obtained through the Concordium ID app
  receipts and payments anchored on chain

---

## Known risks, ranked

1 **The Node bridge does not exist.** x402 cannot work without it and it is the only
  piece with no code. Start it first.
2 **Veriox has no published API.** Identity has no working integration path. Needs
  research or a question in Discord.
3 **Neon pooler fails with asyncpg.** Works locally on the direct host, will break
  on serverless. Must be solved before deploy.
4 **Nothing has touched Concordium.** Every claim about it is currently unproven.
5 **The registry contract at 12802,0 is unverified** as to what it actually is.
6 PyPI is unreachable here, so the venv is borrowed. A clean install is unproven.

---

## Exact commands

Backend
```
cd /home/ksschkw/kss/ProxID/backend
export DATABASE_URL='postgresql+asyncpg://...@ep-...direct.../proxid?ssl=require'
export SECRET_KEY='...'
.venv/bin/python -m alembic upgrade head
.venv/bin/python -m app.scripts.seed_demo
.venv/bin/python arch_check.py
.venv/bin/python -m pytest -q
.venv/bin/uvicorn app.main:app --reload --port 8000
```

Frontend
```
cd /home/ksschkw/kss/ProxID/frontend
cp .env.example .env.local
npm install
npx tsc --noEmit -p tsconfig.app.json
npx vitest run
npm run build
npm run dev
```

Git
```
git remote add upstream https://github.com/Ksschkw/ProxID.git   # fork only, once
git checkout -b feat/name
git push -u origin feat/name
```
