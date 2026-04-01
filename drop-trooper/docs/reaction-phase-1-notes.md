# Reaction System Phase 1

This pass adds the base reaction data model and minimal sheet support.

## Added actor combat fields

- `hasReaction`
- `reactionAvailable`
- `overwatch`

## Defaults

- Troopers: reactions enabled by default
- NPCs: reactions disabled by default
- Drones: reactions disabled by default

## Included in this pass

- Trooper and NPC sheet controls for reaction state
- GM-side migration to populate missing reaction fields on existing actors
- Turn-start reaction reset for the active combatant

## Not included yet

- HUD overwatch button
- movement-triggered overwatch prompts
- brace / return fire prompts
