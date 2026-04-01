# GM Queue Hardening Notes

This pass hardens the GM approval queue without changing gameplay rules.

## What changed

- Added request-id based dedupe for GM approval chat messages.
- Added queue-safe failure handling so player approval locks are cleared if message creation fails.
- Added per-request resolution locks so the same approval cannot be applied/rejected twice by rapid clicks.
- Added shared approval message update helpers to reduce repeated update logic.
- Added a top-level failure catch in approval resolution so unexpected errors mark the request as failed and release the requester correctly.

## What this is meant to improve

- Fewer duplicate GM approval entries.
- Less chance of players getting stuck in a pending-approval state after a queue failure.
- Less chance of double-apply or double-reject on the same approval.
- More consistent queue cleanup when something goes wrong.

## What to test

- Direct damage approval from a player-owned attacker onto a non-owned target.
- Blast and cone attacks that queue multiple approvals.
- Repair Kit approval.
- Command Dice approval.
- Drone deploy / recall approval.
- Armor exit / return approval.
- Reject path and apply path both decrement the player's pending state correctly.
- Rapid double-click on Apply or Reject should not resolve the same request twice.
