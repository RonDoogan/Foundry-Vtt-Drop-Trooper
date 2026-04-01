# Movement Rewrite Notes — Action-Based Segmented Movement

This pass changes Drop Trooper movement from a freeform x2 allowance into segmented movement:

- tokens move freely up to their speed for the first movement segment
- if a drag would exceed that limit, the move is stopped at the cap
- the moving user is then prompted to spend the other action to move again
- if accepted, the token gets one additional movement segment for that turn
- total movement hard-caps at 2x speed for the turn

Implementation notes:
- movement state now tracks moved distance, unlocked segments, and whether the second segment was spent
- blocked over-cap moves are converted into capped moves using a safe follow-up token update
- movement recording now prefers a pending measured distance captured in `preUpdateToken`
- GM movement remains unrestricted

Known caution:
- because Foundry token drag/update behavior can vary by version and modules, the most important live test is whether the token visibly stops at the first cap before the dialog appears.
