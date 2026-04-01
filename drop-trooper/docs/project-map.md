# Drop Trooper Project Map

## Current entrypoint
- `drop-trooper.mjs`

## Existing helper/service files
- `scripts/ability-helpers.mjs`
- `scripts/drone-helpers.mjs`
- `scripts/item-sheet-helpers.mjs`
- `scripts/smoke-helpers.mjs`
- `scripts/weapon-audio.mjs`
- `scripts/weapon-helpers.mjs`
- `scripts/services/ability-service.mjs`
- `scripts/services/damage-service.mjs`
- `scripts/services/movement-service.mjs`
- `scripts/services/roll-service.mjs`

## New foundation files
- `scripts/core/constants.mjs`
- `scripts/core/logger.mjs`
- `scripts/core/namespace.mjs`
- `scripts/core/foundry-guards.mjs`
- `scripts/core/hook-manager.mjs`
- `scripts/core/system-context.mjs`
- `scripts/core/bootstrap-foundation.mjs`

## High-risk zones inside the monolith
- Actor sheet event handling
- Weapon and ability execution
- Cone AOE resolution
- Blast AOE resolution
- GM approval queue and socket routing
- Token movement interception
- Out-of-armor flow
- Combat-follow / control helpers
- NPC blueprint import parsing

## Recommendation

Future extraction should move by workflow, not by file size. The first major rewrite targets should be:

1. damage pipeline
2. attack workflow orchestration
3. chat action dispatch
4. sheet action dispatch
5. NPC importer parsing
