# Weapon Range Bands

Added per-weapon numeric range bands for direct and blast attacks.

## Rules
- Short range: no attack penalty
- Medium range: -2 dice to the attack pool
- Long range: -4 dice to the attack pool
- Beyond long range: shot is blocked as out of range
- Cone weapons ignore range-band penalties

## What changed
- Added `shortRange`, `mediumRange`, and `longRange` to weapon data defaults
- Added range-band fields to the weapon item sheet
- Applied range-band penalties to direct attacks
- Applied range-band penalties to blast aiming attacks
- Added range-band info to attack chat cards
- Preserved cone weapons without range-band penalties

## Default values
- Short: 20
- Medium: 40
- Long: 60
