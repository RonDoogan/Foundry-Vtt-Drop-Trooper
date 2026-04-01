const DROP_TROOPER_MOVEMENT_FLAG_SCOPE = "drop-trooper";
const DROP_TROOPER_MOVEMENT_FLAG_KEY = "movementOverride";
const DROP_TROOPER_MOVEMENT_STATE_FLAG_KEY = "movementState";
const DROP_TROOPER_MOVEMENT_EPSILON = 0.1;
const DROP_TROOPER_DEFAULT_MOVE_SEGMENTS = 1;
const DROP_TROOPER_MAX_MOVE_SEGMENTS = 2;

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key);
}

function toFiniteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function roundMovementDistance(value) {
  return Math.max(0, Math.round(toFiniteNumber(value, 0) * 10) / 10);
}

function getTokenDocument(tokenOrDocument) {
  if (!tokenOrDocument) return null;
  if (tokenOrDocument.document) return tokenOrDocument.document;
  return tokenOrDocument;
}

function getActiveCombat() {
  const combat = game.combat;
  if (!combat?.started) return null;
  return combat;
}

function getCombatTurnKey(combat = null) {
  const activeCombat = combat || getActiveCombat();
  if (!activeCombat) return "";

  const combatId = String(activeCombat.id || "");
  const round = toFiniteNumber(activeCombat.round, 0);
  const turn = toFiniteNumber(activeCombat.turn, 0);
  return `${combatId}:${round}:${turn}`;
}

function getSceneGridMetrics(tokenDocument) {
  const scene = tokenDocument?.parent || canvas?.scene;
  const gridSize = Math.max(1, toFiniteNumber(scene?.grid?.size, toFiniteNumber(canvas?.grid?.size, 100)));
  const distancePerGrid = Math.max(1, toFiniteNumber(scene?.grid?.distance, 5));
  return { gridSize, distancePerGrid };
}

function createPositionPayload(tokenDocument, change = {}) {
  if (!tokenDocument) return null;

  const currentX = toFiniteNumber(tokenDocument.x, NaN);
  const currentY = toFiniteNumber(tokenDocument.y, NaN);
  const nextX = hasOwn(change, "x") ? toFiniteNumber(change.x, NaN) : currentX;
  const nextY = hasOwn(change, "y") ? toFiniteNumber(change.y, NaN) : currentY;

  if (!Number.isFinite(currentX) || !Number.isFinite(currentY) || !Number.isFinite(nextX) || !Number.isFinite(nextY)) {
    return null;
  }

  return { currentX, currentY, nextX, nextY };
}

function formatMovementLabel(value) {
  return roundMovementDistance(value).toFixed(1).replace(/\.0$/, "");
}

export class MovementService {
  static isRestrictedActorType(actor) {
    const actorType = String(actor?.type || "").trim().toLowerCase();
    return actorType === "trooper" || actorType === "drone";
  }

  static getActorSpeed(actor) {
    if (!actor) return 0;
    const actorType = String(actor.type || "").trim().toLowerCase();
    if (actorType === "drone" || actorType === "trooper") {
      return Math.max(0, toFiniteNumber(actor.system?.combat?.speed, 0));
    }
    return 0;
  }

  static getMovementOverride(tokenOrDocument) {
    const tokenDocument = getTokenDocument(tokenOrDocument);
    if (!tokenDocument?.getFlag) return null;
    const data = tokenDocument.getFlag(DROP_TROOPER_MOVEMENT_FLAG_SCOPE, DROP_TROOPER_MOVEMENT_FLAG_KEY);
    return data && typeof data === "object" ? data : null;
  }

  static getMovementState(tokenOrDocument) {
    const tokenDocument = getTokenDocument(tokenOrDocument);
    if (!tokenDocument?.getFlag) return null;
    const data = tokenDocument.getFlag(DROP_TROOPER_MOVEMENT_FLAG_SCOPE, DROP_TROOPER_MOVEMENT_STATE_FLAG_KEY);
    return data && typeof data === "object" ? data : null;
  }

  static getTurnState(tokenOrDocument, combat = null) {
    const tokenDocument = getTokenDocument(tokenOrDocument);
    const turnKey = getCombatTurnKey(combat);
    if (!tokenDocument || !turnKey) {
      return {
        turnKey,
        moved: 0,
        segmentsUnlocked: DROP_TROOPER_DEFAULT_MOVE_SEGMENTS,
        extraSegmentSpent: false,
        updatedAt: 0
      };
    }

    const state = this.getMovementState(tokenDocument);
    if (!state || state.turnKey !== turnKey) {
      return {
        turnKey,
        moved: 0,
        segmentsUnlocked: DROP_TROOPER_DEFAULT_MOVE_SEGMENTS,
        extraSegmentSpent: false,
        updatedAt: 0
      };
    }

    return {
      turnKey,
      moved: roundMovementDistance(state.moved),
      segmentsUnlocked: Math.min(DROP_TROOPER_MAX_MOVE_SEGMENTS, Math.max(DROP_TROOPER_DEFAULT_MOVE_SEGMENTS, Math.trunc(toFiniteNumber(state.segmentsUnlocked, DROP_TROOPER_DEFAULT_MOVE_SEGMENTS)) || DROP_TROOPER_DEFAULT_MOVE_SEGMENTS)),
      extraSegmentSpent: Boolean(state.extraSegmentSpent),
      updatedAt: toFiniteNumber(state.updatedAt, 0)
    };
  }

  static getMovedThisTurn(tokenOrDocument, combat = null) {
    return this.getTurnState(tokenOrDocument, combat).moved;
  }

  static async setTurnState(tokenOrDocument, partial = {}, combat = null) {
    const tokenDocument = getTokenDocument(tokenOrDocument);
    if (!tokenDocument?.setFlag) return null;

    const turnKey = getCombatTurnKey(combat);
    if (!turnKey) {
      return this.clearMovedThisTurn(tokenDocument);
    }

    const current = this.getTurnState(tokenDocument, combat);
    const payload = {
      turnKey,
      moved: roundMovementDistance(partial.moved ?? current.moved),
      segmentsUnlocked: Math.min(DROP_TROOPER_MAX_MOVE_SEGMENTS, Math.max(DROP_TROOPER_DEFAULT_MOVE_SEGMENTS, Math.trunc(toFiniteNumber(partial.segmentsUnlocked, current.segmentsUnlocked)) || current.segmentsUnlocked || DROP_TROOPER_DEFAULT_MOVE_SEGMENTS)),
      extraSegmentSpent: partial.extraSegmentSpent == null ? current.extraSegmentSpent : Boolean(partial.extraSegmentSpent),
      updatedAt: Date.now()
    };

    await tokenDocument.setFlag(DROP_TROOPER_MOVEMENT_FLAG_SCOPE, DROP_TROOPER_MOVEMENT_STATE_FLAG_KEY, payload);
    return payload;
  }

  static async setMovedThisTurn(tokenOrDocument, moved = 0, combat = null) {
    return this.setTurnState(tokenOrDocument, { moved }, combat);
  }

  static async unlockExtraSegment(tokenOrDocument, combat = null) {
    return this.setTurnState(tokenOrDocument, {
      segmentsUnlocked: DROP_TROOPER_MAX_MOVE_SEGMENTS,
      extraSegmentSpent: true
    }, combat);
  }

  static async clearMovedThisTurn(tokenOrDocument) {
    const tokenDocument = getTokenDocument(tokenOrDocument);
    if (!tokenDocument?.unsetFlag) return;
    await tokenDocument.unsetFlag(DROP_TROOPER_MOVEMENT_FLAG_SCOPE, DROP_TROOPER_MOVEMENT_STATE_FLAG_KEY);
  }

  static async allowNextMoveOverride(tokenOrDocument, options = {}) {
    const tokenDocument = getTokenDocument(tokenOrDocument);
    if (!tokenDocument?.setFlag) throw new Error("Token not found.");

    const maxDistance = options.maxDistance == null ? null : Math.max(0, toFiniteNumber(options.maxDistance, 0));
    const payload = {
      active: true,
      maxDistance,
      grantedByUserId: game.user?.id || "",
      grantedByUserName: game.user?.name || "",
      grantedAt: Date.now()
    };

    await tokenDocument.setFlag(DROP_TROOPER_MOVEMENT_FLAG_SCOPE, DROP_TROOPER_MOVEMENT_FLAG_KEY, payload);
    return payload;
  }

  static async clearMoveOverride(tokenOrDocument) {
    const tokenDocument = getTokenDocument(tokenOrDocument);
    if (!tokenDocument?.unsetFlag) return;
    await tokenDocument.unsetFlag(DROP_TROOPER_MOVEMENT_FLAG_SCOPE, DROP_TROOPER_MOVEMENT_FLAG_KEY);
  }

  static getRequestedPosition(tokenDocument, change = {}) {
    return createPositionPayload(tokenDocument, change);
  }

  static measureMoveDistance(tokenDocument, change = {}) {
    const position = createPositionPayload(tokenDocument, change);
    if (!position) return 0;

    const dx = position.nextX - position.currentX;
    const dy = position.nextY - position.currentY;
    if (Math.abs(dx) < DROP_TROOPER_MOVEMENT_EPSILON && Math.abs(dy) < DROP_TROOPER_MOVEMENT_EPSILON) {
      return 0;
    }

    const grid = canvas?.grid;
    if (grid?.measurePath) {
      try {
        const result = grid.measurePath([
          { x: position.currentX, y: position.currentY },
          { x: position.nextX, y: position.nextY }
        ]);

        const measuredDistance = toFiniteNumber(result?.distance, NaN);
        if (Number.isFinite(measuredDistance)) return roundMovementDistance(measuredDistance);

        const measuredCost = toFiniteNumber(result?.cost, NaN);
        if (Number.isFinite(measuredCost)) return roundMovementDistance(measuredCost);
      } catch (error) {
        console.warn("Drop Trooper | Falling back to straight-line movement measurement", error);
      }
    }

    const { gridSize, distancePerGrid } = getSceneGridMetrics(tokenDocument);
    const straightLineDistanceInPixels = Math.hypot(dx, dy);
    const straightLineDistanceInGridUnits = straightLineDistanceInPixels / gridSize;
    return roundMovementDistance(straightLineDistanceInGridUnits * distancePerGrid);
  }

  static measureMoveDistanceFromPoints(tokenDocument, fromPoint, toPoint) {
    if (!tokenDocument || !fromPoint || !toPoint) return 0;
    return this.measureMoveDistance(tokenDocument, {
      x: toPoint.x,
      y: toPoint.y,
      _fromX: fromPoint.x,
      _fromY: fromPoint.y
    });
  }

  static buildSyntheticChange(fromPoint, toPoint) {
    return {
      x: toFiniteNumber(toPoint?.x, 0),
      y: toFiniteNumber(toPoint?.y, 0),
      _fromX: toFiniteNumber(fromPoint?.x, 0),
      _fromY: toFiniteNumber(fromPoint?.y, 0)
    };
  }

  static getAllowedDistanceForTurn(tokenDocument, combat = null) {
    const actor = tokenDocument?.actor;
    const speed = this.getActorSpeed(actor);
    const turnState = this.getTurnState(tokenDocument, combat);
    const allowedTotal = speed * turnState.segmentsUnlocked;
    return {
      speed,
      turnState,
      allowedTotal,
      remaining: Math.max(0, allowedTotal - turnState.moved)
    };
  }

  static getCappedDestination(tokenDocument, change = {}, allowedAdditionalDistance = 0) {
    const position = createPositionPayload(tokenDocument, change);
    const allowed = roundMovementDistance(allowedAdditionalDistance);
    if (!position || allowed <= DROP_TROOPER_MOVEMENT_EPSILON) {
      return {
        x: position?.currentX ?? tokenDocument?.x ?? 0,
        y: position?.currentY ?? tokenDocument?.y ?? 0,
        distanceApplied: 0,
        position
      };
    }

    const totalDistance = this.measureMoveDistance(tokenDocument, change);
    if (!Number.isFinite(totalDistance) || totalDistance <= DROP_TROOPER_MOVEMENT_EPSILON) {
      return {
        x: position.currentX,
        y: position.currentY,
        distanceApplied: 0,
        position
      };
    }

    if (allowed >= totalDistance - DROP_TROOPER_MOVEMENT_EPSILON) {
      return {
        x: position.nextX,
        y: position.nextY,
        distanceApplied: totalDistance,
        position
      };
    }

    const ratio = Math.max(0, Math.min(1, allowed / totalDistance));
    const x = position.currentX + ((position.nextX - position.currentX) * ratio);
    const y = position.currentY + ((position.nextY - position.currentY) * ratio);

    return {
      x,
      y,
      distanceApplied: allowed,
      position
    };
  }

  static evaluateMove(tokenDocument, change = {}, options = {}) {
    const actor = tokenDocument?.actor;
    const combat = getActiveCombat();
    const baseAllowed = { allowed: true, distance: 0, speed: 0, movedThisTurn: 0, remaining: 0, totalAttempted: 0, segmentsUnlocked: DROP_TROOPER_DEFAULT_MOVE_SEGMENTS, maxAllowed: 0, requiresSpendPrompt: false, blockedAtHardCap: false };
    if (!actor || !this.isRestrictedActorType(actor)) return baseAllowed;

    if (!combat) {
      const distance = (!hasOwn(change, "x") && !hasOwn(change, "y")) ? 0 : this.measureMoveDistance(tokenDocument, change);
      return {
        allowed: true,
        distance,
        speed: this.getActorSpeed(actor),
        movedThisTurn: 0,
        remaining: 0,
        totalAttempted: distance,
        segmentsUnlocked: DROP_TROOPER_DEFAULT_MOVE_SEGMENTS,
        maxAllowed: 0,
        requiresSpendPrompt: false,
        blockedAtHardCap: false
      };
    }

    if (!hasOwn(change, "x") && !hasOwn(change, "y")) {
      const allowance = this.getAllowedDistanceForTurn(tokenDocument);
      return {
        allowed: true,
        distance: 0,
        speed: allowance.speed,
        movedThisTurn: allowance.turnState.moved,
        remaining: allowance.remaining,
        totalAttempted: allowance.turnState.moved,
        segmentsUnlocked: allowance.turnState.segmentsUnlocked,
        maxAllowed: allowance.allowedTotal,
        requiresSpendPrompt: false,
        blockedAtHardCap: false
      };
    }

    if (game.user?.isGM || options?.dropTrooperIgnoreMoveLimit || options?.teleport === true) {
      const distance = this.measureMoveDistance(tokenDocument, change);
      const allowance = this.getAllowedDistanceForTurn(tokenDocument);
      return {
        allowed: true,
        distance,
        speed: allowance.speed,
        movedThisTurn: allowance.turnState.moved,
        remaining: allowance.remaining,
        totalAttempted: allowance.turnState.moved + distance,
        segmentsUnlocked: allowance.turnState.segmentsUnlocked,
        maxAllowed: allowance.allowedTotal,
        requiresSpendPrompt: false,
        blockedAtHardCap: false
      };
    }

    const allowance = this.getAllowedDistanceForTurn(tokenDocument);
    const distance = this.measureMoveDistance(tokenDocument, change);
    const totalAttempted = roundMovementDistance(allowance.turnState.moved + Math.max(0, distance));

    if (!Number.isFinite(distance) || totalAttempted <= allowance.allowedTotal + DROP_TROOPER_MOVEMENT_EPSILON) {
      return {
        allowed: true,
        distance,
        speed: allowance.speed,
        movedThisTurn: allowance.turnState.moved,
        remaining: allowance.remaining,
        totalAttempted,
        segmentsUnlocked: allowance.turnState.segmentsUnlocked,
        maxAllowed: allowance.allowedTotal,
        requiresSpendPrompt: false,
        blockedAtHardCap: false
      };
    }

    const remaining = Math.max(0, allowance.allowedTotal - allowance.turnState.moved);
    const capped = this.getCappedDestination(tokenDocument, change, remaining);
    const requiresSpendPrompt = allowance.turnState.segmentsUnlocked < DROP_TROOPER_MAX_MOVE_SEGMENTS;

    return {
      allowed: false,
      distance,
      speed: allowance.speed,
      movedThisTurn: allowance.turnState.moved,
      remaining,
      totalAttempted,
      segmentsUnlocked: allowance.turnState.segmentsUnlocked,
      maxAllowed: allowance.allowedTotal,
      requiresSpendPrompt,
      blockedAtHardCap: !requiresSpendPrompt,
      cappedDestination: capped,
      turnState: allowance.turnState
    };
  }

  static buildPendingMovePayload(tokenDocument, change = {}, evaluation = null) {
    const position = createPositionPayload(tokenDocument, change);
    const derived = evaluation || this.evaluateMove(tokenDocument, change, {});
    return {
      fromX: position?.currentX ?? toFiniteNumber(tokenDocument?.x, 0),
      fromY: position?.currentY ?? toFiniteNumber(tokenDocument?.y, 0),
      toX: position?.nextX ?? toFiniteNumber(tokenDocument?.x, 0),
      toY: position?.nextY ?? toFiniteNumber(tokenDocument?.y, 0),
      distance: roundMovementDistance(derived?.distance),
      measuredAt: Date.now()
    };
  }

  static async recordMovementIfNeeded(tokenDocument, change = {}, userId = null, options = {}) {
    if (!tokenDocument?.actor || !this.isRestrictedActorType(tokenDocument.actor)) return;
    if (userId && game.user?.id && userId !== game.user.id) return;
    if (!hasOwn(change, "x") && !hasOwn(change, "y")) return;
    if (game.user?.isGM) return;

    const combat = getActiveCombat();
    if (!combat) return;

    const pending = options?.dropTrooperPendingMove;
    let distance = roundMovementDistance(pending?.distance);
    if (!Number.isFinite(distance) || distance <= DROP_TROOPER_MOVEMENT_EPSILON) {
      distance = this.measureMoveDistance(tokenDocument, change);
    }
    if (!Number.isFinite(distance) || distance <= DROP_TROOPER_MOVEMENT_EPSILON) return;

    const turnState = this.getTurnState(tokenDocument, combat);
    const totalMoved = roundMovementDistance(turnState.moved + distance);

    try {
      await this.setTurnState(tokenDocument, { moved: totalMoved }, combat);
    } catch (error) {
      console.warn("Drop Trooper | Failed to record moved distance for turn", error);
    }
  }

  static async consumeOverrideIfNeeded() {
    return;
  }

  static async spendExtraSegmentForTurn(tokenDocument) {
    const combat = getActiveCombat();
    await this.unlockExtraSegment(tokenDocument, combat);
    return this.getTurnState(tokenDocument, combat);
  }

  static async applyCappedMove(tokenDocument, cappedDestination, meta = {}) {
    const safeX = toFiniteNumber(cappedDestination?.x, tokenDocument?.x ?? 0);
    const safeY = toFiniteNumber(cappedDestination?.y, tokenDocument?.y ?? 0);
    const distanceApplied = roundMovementDistance(cappedDestination?.distanceApplied);

    await tokenDocument.update(
      { x: safeX, y: safeY },
      {
        dropTrooperIgnoreMoveLimit: true,
        dropTrooperPendingMove: {
          fromX: toFiniteNumber(tokenDocument?.x, 0),
          fromY: toFiniteNumber(tokenDocument?.y, 0),
          toX: safeX,
          toY: safeY,
          distance: distanceApplied,
          capped: true,
          meta
        }
      }
    );
  }

  static async promptSpendMoveAction(tokenDocument, evaluation) {
    if (!tokenDocument || !evaluation?.requiresSpendPrompt) return false;
    if (game.user?.isGM) return false;

    const actor = tokenDocument.actor;
    const tokenName = tokenDocument.name || actor?.name || "Token";
    const speedLabel = formatMovementLabel(evaluation.speed);

    return new Promise(resolve => {
      const dialog = new foundry.applications.api.DialogV2({
        window: {
          title: `${tokenName}: Move Again?`
        },
        content: `
          <p><strong>${tokenName}</strong> reached their speed limit of <strong>${speedLabel}</strong>.</p>
          <p>Spend the other action to move up to <strong>${speedLabel}</strong> more this turn?</p>
          <p><em>This unlocks a total movement cap of ${formatMovementLabel((evaluation.speed || 0) * DROP_TROOPER_MAX_MOVE_SEGMENTS)} for this turn.</em></p>
        `,
        buttons: [
          {
            action: "confirm",
            label: "Spend Action and Move Again",
            default: true,
            callback: async () => {
              try {
                await this.spendExtraSegmentForTurn(tokenDocument);
                ui.notifications.info(`${tokenName}: second move unlocked for this turn.`);
                resolve(true);
              } catch (error) {
                console.error("Drop Trooper | Failed to unlock second move segment", error);
                ui.notifications.error(`${tokenName}: could not unlock the second move.`);
                resolve(false);
              }
            }
          },
          {
            action: "cancel",
            label: "Stay Put",
            callback: () => resolve(false)
          }
        ],
        close: () => resolve(false)
      });

      dialog.render(true);
    });
  }

  static queueCappedMoveAndPrompt(tokenDocument, evaluation) {
    if (!tokenDocument || !evaluation?.cappedDestination) return;

    const tokenId = tokenDocument.id;
    const tokenName = tokenDocument.name || tokenDocument.actor?.name || "Token";
    const remainingLabel = formatMovementLabel(evaluation.remaining);
    const hardCapLabel = formatMovementLabel(evaluation.maxAllowed);

    setTimeout(async () => {
      const liveDocument = canvas?.tokens?.get(tokenId)?.document || tokenDocument;
      if (!liveDocument) return;

      try {
        await this.applyCappedMove(liveDocument, evaluation.cappedDestination, {
          reason: evaluation.requiresSpendPrompt ? "segment-cap" : "hard-cap"
        });
      } catch (error) {
        console.error("Drop Trooper | Failed to apply capped movement", error);
        ui.notifications.error(`${tokenName}: movement cap could not be applied.`);
        return;
      }

      if (evaluation.requiresSpendPrompt) {
        if (evaluation.remaining > DROP_TROOPER_MOVEMENT_EPSILON) {
          ui.notifications.info(`${tokenName} stopped at ${remainingLabel} remaining movement for this action.`);
        } else {
          ui.notifications.info(`${tokenName} reached the end of their current move action.`);
        }
        await this.promptSpendMoveAction(liveDocument, evaluation);
        return;
      }

      ui.notifications.warn(`${tokenName} is already at the hard movement cap for this turn (${hardCapLabel}).`);
    }, 0);
  }
}

export function registerDropTrooperMovementHooks() {
  Hooks.on("preUpdateToken", (tokenDocument, change, options, userId) => {
    if (userId && game.user?.id && userId !== game.user.id) return true;

    const result = MovementService.evaluateMove(tokenDocument, change, options);
    if (result.allowed) {
      if (options && !options.dropTrooperPendingMove) {
        options.dropTrooperPendingMove = MovementService.buildPendingMovePayload(tokenDocument, change, result);
      }
      return true;
    }

    MovementService.queueCappedMoveAndPrompt(tokenDocument, result);
    return false;
  });

  Hooks.on("updateToken", async (tokenDocument, change, options, userId) => {
    await MovementService.recordMovementIfNeeded(tokenDocument, change, userId, options);
    await MovementService.consumeOverrideIfNeeded(tokenDocument, change, userId);
  });

  Hooks.on("deleteCombat", async () => {
    const tokens = canvas?.tokens?.placeables || [];
    for (const token of tokens) {
      try {
        await MovementService.clearMovedThisTurn(token);
      } catch (error) {
        console.warn("Drop Trooper | Failed clearing movement state after combat deletion", error);
      }
    }
  });
}

export function createDropTrooperMovementApi() {
  return {
    async allowNextMoveOverrideForControlled(options = {}) {
      const controlled = canvas?.tokens?.controlled || [];
      if (!controlled.length) throw new Error("Select at least one token.");
      const results = [];
      for (const token of controlled) {
        const tokenDocument = getTokenDocument(token);
        if (!MovementService.isRestrictedActorType(tokenDocument?.actor)) continue;
        results.push(await MovementService.allowNextMoveOverride(tokenDocument, options));
      }
      return results;
    },
    async clearMoveOverrideForControlled() {
      const controlled = canvas?.tokens?.controlled || [];
      for (const token of controlled) {
        await MovementService.clearMoveOverride(token);
      }
      return true;
    },
    async clearMovedThisTurnForControlled() {
      const controlled = canvas?.tokens?.controlled || [];
      for (const token of controlled) {
        await MovementService.clearMovedThisTurn(token);
      }
      return true;
    },
    async allowNextMoveOverride(tokenOrDocument, options = {}) {
      return MovementService.allowNextMoveOverride(tokenOrDocument, options);
    },
    async clearMoveOverride(tokenOrDocument) {
      return MovementService.clearMoveOverride(tokenOrDocument);
    },
    async clearMovedThisTurn(tokenOrDocument) {
      return MovementService.clearMovedThisTurn(tokenOrDocument);
    },
    async unlockExtraSegment(tokenOrDocument) {
      return MovementService.spendExtraSegmentForTurn(tokenOrDocument);
    },
    evaluateMove(tokenOrDocument, change = {}, options = {}) {
      return MovementService.evaluateMove(getTokenDocument(tokenOrDocument), change, options);
    },
    measureMoveDistance(tokenOrDocument, change = {}) {
      return MovementService.measureMoveDistance(getTokenDocument(tokenOrDocument), change);
    },
    getActorSpeed(actor) {
      return MovementService.getActorSpeed(actor);
    },
    getMovedThisTurn(tokenOrDocument) {
      return MovementService.getMovedThisTurn(getTokenDocument(tokenOrDocument));
    },
    getTurnState(tokenOrDocument) {
      return MovementService.getTurnState(getTokenDocument(tokenOrDocument));
    }
  };
}
