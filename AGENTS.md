# Rules for any agent working in this directory

You are working in `/home/ksschkw/kss`. Two projects live here:

```
ProxID/   the project you are building. Write here.
Gigr/     a finished, submitted project. REFERENCE ONLY. Never write here.
```

## The reference project

`Gigr/` is a shipped product in the same domain, by the same author, that the owner
is happy with. Read it constantly. It is the answer to most design and structure
questions:

```
Gigr/frontend/src/pages/          the page inventory and how each page is built
Gigr/frontend/src/components/     real components, not sketches
Gigr/frontend/src/store/          state management patterns
Gigr/backend/app/services/        service patterns
Gigr/backend/app/crud/            query patterns
Gigr/house-standard.md            the engineering standard, binding, also in ProxID/
```

When you are unsure how something should look or behave, open the corresponding
Gigr file and match it. ProxID is Gigr minus Solana, PayPal, Walrus and Aurora, plus
Concordium. Treat Gigr as the specification for everything except the parts the owner
has explicitly asked to change.

**Hard rule: `Gigr/` is read-only.** Do not modify, delete, move or format anything
inside it. If you believe a change is needed there, stop and ask.

## Never assume. Ask.

The owner has lost hackathons to assumed requirements. Every unknown must be a
question, not a guess. Specifically:

- If a design decision is not written down, ask. Do not pick a colour, a layout, a
  label or a flow because it seems reasonable.
- If an API or a contract's shape is unknown, say so and ask. Do not invent a
  request body, an endpoint, a field name or a status code.
- If a package, version or command cannot be verified by actually running it, say
  that you could not verify it. Do not state it as fact.
- If two documents disagree, say which two and ask which wins. Do not silently
  choose.
- If you are about to write the phrase "I assumed", replace it with a question
  before writing the code.

State your confidence when reporting. "Verified by running X" and "believed but not
verified" are different claims and must be labelled as such.

## When you are blocked on something only a human can do

Stop and output a numbered checklist: what to do, the direct link, which environment
variable it fills, and how to check it worked. Do not fabricate credentials and do
not stub a live integration and call it done.

## Commits and branches

- Author: `Chnnyrm <jkenzy09@gmail.com>` for work she directs, unless told otherwise
- Work on a branch, never directly on main
- Push to `Chnnyrm/ProxID`, then a pull request into `Ksschkw/ProxID` main
- No force-push, no rewriting published history
- Before proposing a merge: `python arch_check.py`, `pytest`, `tsc --noEmit`,
  `vitest run`, `npm run build`

## Before you write any code

Read, in this order:

1 `PROXID-HANDOFF.md`  what the project is and where it stands
2 `ProxID/TASKS.md`    every task and its state, Phase 8 is the rebuild brief
3 `ProxID/house-standard.md`  the binding engineering standard
4 The relevant file in `Gigr/`  how it was done the last time

Do not begin with an opinion. Begin with those four.
