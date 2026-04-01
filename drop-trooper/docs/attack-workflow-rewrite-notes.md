# Attack Workflow Rewrite Notes

This pass centralizes the per-target damage pipeline for Drop Trooper attacks.

## What changed

- Added `scripts/services/attack-workflow-service.mjs`
- Direct attacks now use the shared target-damage resolver
- Blast and cone zone target resolution now use the same shared target-damage resolver through `_resolveBlastEntries`

## What this gains

- One place for defense -> damage dice -> armor tier -> damage application flow
- Reduced duplication between direct attacks and AOE target resolution
- Consistent handling for pending GM approval damage payloads
- Lower risk of one attack mode diverging from another

## What was intentionally left alone

- Core game rules
- Chat card presentation outside the reused damage data
- Ammo rules
- Push rules
- FX and measured template behavior
