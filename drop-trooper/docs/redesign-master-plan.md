# Drop Trooper Code Redesign Master Plan

This package is an aggressive **foundation-first redesign pass**.

It does **not** replace the entire game engine in one shot. Doing that blind in a live Foundry system would be more likely to break the game than improve it.

What this pass does:

- adds a formal core namespace (`globalThis.DropTrooper`)
- adds a foundation bootstrap layer
- adds shared constants, guards, logger, hook registry helpers, and system context helpers
- creates a clear place to keep future rewrites out of the main monolith
- keeps the current build bootable while preparing for deeper extraction work

## Why this approach

The current system already works. The real issue is maintainability and blast radius. A complete rewrite of all 455k+ characters of `drop-trooper.mjs` in a single pass would be high-risk and likely produce regressions across:

- actor sheets
- chat card buttons
- AOE workflows
- cone workflows
- movement restriction
- GM approval queue
- drones
- repair and support actions
- NPC importer

## New foundation modules

- `scripts/core/constants.mjs`
- `scripts/core/logger.mjs`
- `scripts/core/namespace.mjs`
- `scripts/core/foundry-guards.mjs`
- `scripts/core/hook-manager.mjs`
- `scripts/core/system-context.mjs`
- `scripts/core/bootstrap-foundation.mjs`

## Intended next rewrites

1. roll builder / roll presentation
2. damage application pipeline
3. AOE workflow runner
4. cone workflow runner
5. GM queue / approval transport
6. actor-sheet action controller
7. NPC importer parser and validator
8. drone state controller
9. item / ability execution controller
10. chat-card action bus

## Important note

This package is a **real structural improvement**, but it is not yet the full under-the-hood rewrite. It is the first pass that makes a larger rewrite possible without flying blind.
