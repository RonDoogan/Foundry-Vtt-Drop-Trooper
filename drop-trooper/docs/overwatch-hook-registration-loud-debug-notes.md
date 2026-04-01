# Overwatch Hook Registration + Loud Debug Patch

This patch adds a dedicated `moveToken`-based overwatch debug module for Foundry V13.

What it adds:
- explicit hook registration logging at `ready`
- loud client notification when the debug hook is active
- `moveToken` console logging for every token move
- armed overwatch candidate logging
- player-facing overwatch prompt when an armed watcher sees a hostile mover with a valid non-AOE weapon in range
- debug notifications for common skip cases

Why:
- the previous overwatch work was not producing a reliable prompt in live testing
- this patch makes hook registration and live trigger behavior visible so failures stop being silent
