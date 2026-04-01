const DEBUG_PREFIX = "Drop Trooper | Overwatch";
const LOCAL_PENDING_PROMPTS = new Set();
const OVERWATCH_SOCKET_NAMESPACE = "system.drop-trooper.overwatch";
const OVERWATCH_SOCKET_ACTION_PROMPT = "prompt";
const PRE_MOVE_TOKEN_CENTERS = new Map();

function log(...args) {
  console.log(DEBUG_PREFIX, ...args);
}

function notify(message, level = "info") {
  try {
    ui?.notifications?.[level]?.(`[OW DEBUG] ${message}`);
  } catch (_) {
    // ignore notification failures
  }
}

function hasReactionState(actor) {
  const combat = actor?.system?.combat || {};
  return {
    hasReaction: Boolean(combat.hasReaction),
    reactionAvailable: Boolean(combat.reactionAvailable),
    overwatch: Boolean(combat.overwatch)
  };
}

function getSceneToken(tokenOrDoc) {
  if (!tokenOrDoc) return null;
  return tokenOrDoc.object || canvas?.tokens?.get(tokenOrDoc.id) || null;
}

function getTokenCenter(tokenOrDoc) {
  const doc = tokenOrDoc?.document || tokenOrDoc;
  const obj = getSceneToken(doc);
  if (obj?.center) return obj.center;
  const x = Number(doc?.x ?? 0) + Number(doc?.width ?? 1) * Number(canvas?.grid?.size ?? 100) / 2;
  const y = Number(doc?.y ?? 0) + Number(doc?.height ?? 1) * Number(canvas?.grid?.size ?? 100) / 2;
  return { x, y };
}

function measureDistance(sourceToken, targetToken) {
  const from = getTokenCenter(sourceToken);
  const to = getTokenCenter(targetToken);
  const grid = canvas?.grid;
  if (grid?.measurePath) {
    try {
      const result = grid.measurePath([from, to]);
      const distance = Number(result?.distance ?? result?.cost);
      if (Number.isFinite(distance)) return distance;
    } catch (error) {
      console.warn(DEBUG_PREFIX, "measurePath failed, using fallback", error);
    }
  }
  const scene = canvas?.scene;
  const gridSize = Math.max(1, Number(scene?.grid?.size ?? canvas?.grid?.size ?? 100));
  const gridDistance = Math.max(1, Number(scene?.grid?.distance ?? 5));
  return (Math.hypot(to.x - from.x, to.y - from.y) / gridSize) * gridDistance;
}

function measureDistanceToPoint(sourceToken, point) {
  const from = getTokenCenter(sourceToken);
  const to = point;
  const grid = canvas?.grid;
  if (grid?.measurePath) {
    try {
      const result = grid.measurePath([from, to]);
      const distance = Number(result?.distance ?? result?.cost);
      if (Number.isFinite(distance)) return distance;
    } catch (error) {
      console.warn(DEBUG_PREFIX, "measurePath failed, using fallback", error);
    }
  }
  const scene = canvas?.scene;
  const gridSize = Math.max(1, Number(scene?.grid?.size ?? canvas?.grid?.size ?? 100));
  const gridDistance = Math.max(1, Number(scene?.grid?.distance ?? 5));
  return (Math.hypot(to.x - from.x, to.y - from.y) / gridSize) * gridDistance;
}

function hasLineOfSightToPoint(sourceDoc, point, targetDoc = null) {
  const from = getTokenCenter(sourceDoc);
  let baseLineOfSight = true;

  try {
    const sightBackend = CONFIG?.Canvas?.polygonBackends?.sight;
    if (sightBackend?.testCollision) {
      const collision = sightBackend.testCollision(from, point, { type: "sight", mode: "any" });
      const blocked = Array.isArray(collision) ? collision.length > 0 : Boolean(collision);
      baseLineOfSight = !blocked;
    }
  } catch (error) {
    console.warn(DEBUG_PREFIX, "Sight collision check failed, falling back", error);
  }

  if (!baseLineOfSight) return false;

  try {
    const sourceObj = getSceneToken(sourceDoc);
    if (sourceObj?.vision?.containsPoint && !sourceObj.vision.containsPoint(point)) {
      return false;
    }
    if (!sourceObj?.vision?.containsPoint && canvas?.visibility?.testVisibility && !canvas.visibility.testVisibility(point, { object: sourceObj || getSceneToken(targetDoc) })) {
      return false;
    }
  } catch (error) {
    console.warn(DEBUG_PREFIX, "Fallback visibility check failed; allowing overwatch", error);
  }

  if (isBlockedByCoverDrawingPoint(sourceDoc, point)) {
    return false;
  }

  return true;
}

function getMovementPathSample(oldCenter, newCenter, ratio) {
  return {
    x: oldCenter.x + ((newCenter.x - oldCenter.x) * ratio),
    y: oldCenter.y + ((newCenter.y - oldCenter.y) * ratio)
  };
}

function getFirstVisiblePointDuringMovement(sourceDoc, movedDoc, oldCenter) {
  const newCenter = getTokenCenter(movedDoc);
  const startCenter = oldCenter || newCenter;
  const travel = Math.hypot(newCenter.x - startCenter.x, newCenter.y - startCenter.y);
  const gridSize = Math.max(1, Number(canvas?.grid?.size ?? 100));
  const steps = Math.max(1, Math.min(30, Math.ceil(travel / Math.max(12, gridSize / 3))));

  for (let i = 0; i <= steps; i += 1) {
    const ratio = i / steps;
    const point = getMovementPathSample(startCenter, newCenter, ratio);
    if (hasLineOfSightToPoint(sourceDoc, point, movedDoc)) {
      return { point, ratio, startCenter, endCenter: newCenter, steps };
    }
  }
  return null;
}

function getPreferredOverwatchWeaponForPoint(actor, sourceDoc, point) {
  const preferredId = String(actor?.getFlag?.("drop-trooper", "overwatchWeaponId") || "").trim();
  const weapons = Array.from(actor?.items || [])
    .filter(item => item?.type === "weapon" && !item?.system?.aoeEnabled)
    .sort((a, b) => Number(a?.system?.displayOrder || 0) - Number(b?.system?.displayOrder || 0));

  const orderedWeapons = preferredId
    ? [weapons.find(item => item?.id === preferredId), ...weapons.filter(item => item?.id !== preferredId)]
    : weapons;

  const distance = measureDistanceToPoint(sourceDoc, point);

  for (const weapon of orderedWeapons) {
    if (!weapon) continue;
    const system = weapon.system || {};
    const usesAmmo = Boolean(system.usesAmmo);
    const ammo = Number(system.ammo ?? 0);
    if (usesAmmo && ammo <= 0) continue;

    const longRange = Math.max(0, Number(system.longRange || system.range || 0));
    if (longRange <= 0) continue;
    if (distance <= longRange + 0.1) {
      return { weapon, distance, longRange };
    }
  }

  return null;
}

function hasLineOfSight(sourceDoc, targetDoc) {
  const from = getTokenCenter(sourceDoc);
  const to = getTokenCenter(targetDoc);
  let baseLineOfSight = true;

  try {
    const sightBackend = CONFIG?.Canvas?.polygonBackends?.sight;
    if (sightBackend?.testCollision) {
      const collision = sightBackend.testCollision(from, to, { type: "sight", mode: "any" });
      const blocked = Array.isArray(collision) ? collision.length > 0 : Boolean(collision);
      baseLineOfSight = !blocked;
    }
  } catch (error) {
    console.warn(DEBUG_PREFIX, "Sight collision check failed, falling back", error);
  }

  if (!baseLineOfSight) return false;

  try {
    const sourceObj = getSceneToken(sourceDoc);
    const targetObj = getSceneToken(targetDoc);
    if (sourceObj?.vision?.containsPoint && !sourceObj.vision.containsPoint(to)) {
      return false;
    }
    if (!sourceObj?.vision?.containsPoint && canvas?.visibility?.testVisibility && !canvas.visibility.testVisibility(to, { object: sourceObj || targetObj })) {
      return false;
    }
  } catch (error) {
    console.warn(DEBUG_PREFIX, "Fallback visibility check failed; allowing overwatch", error);
  }

  if (isBlockedByCoverDrawing(sourceDoc, targetDoc)) {
    log("Skipping watcher: blocked by cover drawing", {
      watcher: sourceDoc?.name || sourceDoc?.actor?.name,
      moved: targetDoc?.name || targetDoc?.actor?.name,
      watcherCenter: from,
      movedCenter: to
    });
    return false;
  }

  return true;
}

function getActiveCoverDrawings() {
  const coverModule = game.modules?.get?.("drop-trooper-cover");
  if (!coverModule?.active) return [];
  if (!game.settings?.get?.("drop-trooper-cover", "enableOcclusion")) return [];
  return (canvas?.drawings?.placeables || []).filter(d => Boolean(d?.document?.getFlag?.("drop-trooper-cover", "coverWall")));
}

function isBlockedByCoverDrawing(sourceDoc, targetDoc) {
  const drawings = getActiveCoverDrawings();
  if (!drawings.length) return false;

  const origin = getTokenCenter(sourceDoc);
  const target = getTokenCenter(targetDoc);
  return drawings.some(drawing => rayBlockedByCoverDrawing(origin, target, drawing));
}

function isBlockedByCoverDrawingPoint(sourceDoc, point) {
  const drawings = getActiveCoverDrawings();
  if (!drawings.length) return false;
  const origin = getTokenCenter(sourceDoc);
  return drawings.some(drawing => rayBlockedByCoverDrawing(origin, point, drawing));
}

function rayBlockedByCoverDrawing(origin, target, drawing) {
  const doc = drawing?.document;
  if (!doc) return false;

  const x = Number(doc.x ?? drawing.x ?? 0);
  const y = Number(doc.y ?? drawing.y ?? 0);
  const rotation = Number(doc.rotation ?? drawing.rotation ?? 0) * (Math.PI / 180);
  const shape = doc.shape ?? drawing.shape ?? {};
  const type = shape.type ?? shape.shape?.type;

  if (type === "r") {
    const width = Number(shape.width ?? 0);
    const height = Number(shape.height ?? 0);
    return segmentIntersectsRotatedRectangle(origin, target, x, y, width, height, rotation);
  }

  if (type === "p" || type === "f") {
    const points = Array.isArray(shape.points) ? shape.points : [];
    const worldPoints = [];
    for (let i = 0; i < points.length - 1; i += 2) {
      worldPoints.push({ x: x + Number(points[i]), y: y + Number(points[i + 1]) });
    }
    const strokeWidth = Number(shape.strokeWidth ?? doc.strokeWidth ?? 0);
    return segmentIntersectsPolylineThick(origin, target, worldPoints, strokeWidth);
  }

  return false;
}

function segmentIntersectsRotatedRectangle(a, b, x, y, width, height, rotation = 0) {
  const cx = x + width / 2;
  const cy = y + height / 2;
  const localA = rotatePointAround(a, { x: cx, y: cy }, -rotation);
  const localB = rotatePointAround(b, { x: cx, y: cy }, -rotation);
  const minThickness = Math.max(16, Math.round((canvas?.grid?.size ?? 100) * 0.18));
  const effectiveWidth = Math.max(width, minThickness);
  const effectiveHeight = Math.max(height, minThickness);
  const rect = new PIXI.Rectangle(
    cx - effectiveWidth / 2,
    cy - effectiveHeight / 2,
    effectiveWidth,
    effectiveHeight
  );
  return segmentIntersectsRectangle(localA, localB, rect);
}

function segmentIntersectsRectangle(a, b, rect) {
  if (rect.contains(a.x, a.y)) return true;
  if (rect.contains(b.x, b.y)) return true;

  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  if (rect.contains(mid.x, mid.y)) return true;

  const xMin = rect.x;
  const xMax = rect.x + rect.width;
  const yMin = rect.y;
  const yMax = rect.y + rect.height;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let t0 = 0;
  let t1 = 1;

  const clip = (p, q) => {
    if (Math.abs(p) < 0.0001) return q >= 0;
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };

  if (clip(-dx, a.x - xMin) && clip(dx, xMax - a.x) && clip(-dy, a.y - yMin) && clip(dy, yMax - a.y)) {
    return t1 >= t0;
  }

  const corners = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height }
  ];
  const edges = [
    [corners[0], corners[1]],
    [corners[1], corners[2]],
    [corners[2], corners[3]],
    [corners[3], corners[0]]
  ];
  return edges.some(([c, d]) => segmentsIntersect(a, b, c, d));
}

function segmentIntersectsPolylineThick(a, b, points, strokeWidth = 0) {
  if (points.length < 2) return false;
  const minThickness = Math.max(18, Math.round((canvas?.grid?.size ?? 100) * 0.22));
  const effectiveThickness = Math.max(minThickness, Number(strokeWidth) || 0);
  const blockRadius = effectiveThickness / 2;

  for (let i = 0; i < points.length - 1; i++) {
    const c = points[i];
    const d = points[i + 1];
    if (segmentsIntersect(a, b, c, d)) return true;
    if (segmentDistance(a, b, c, d) <= blockRadius) return true;
  }
  return false;
}

function segmentDistance(a, b, c, d) {
  if (segmentsIntersect(a, b, c, d)) return 0;
  return Math.min(
    pointToSegmentDistance(a, c, d),
    pointToSegmentDistance(b, c, d),
    pointToSegmentDistance(c, a, b),
    pointToSegmentDistance(d, a, b)
  );
}

function pointToSegmentDistance(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) < 0.0001 && Math.abs(dy) < 0.0001) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, (((p.x - a.x) * dx) + ((p.y - a.y) * dy)) / ((dx * dx) + (dy * dy))));
  const projX = a.x + (t * dx);
  const projY = a.y + (t * dy);
  return Math.hypot(p.x - projX, p.y - projY);
}

function rotatePointAround(point, origin, radians) {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  return {
    x: origin.x + (dx * cos) - (dy * sin),
    y: origin.y + (dx * sin) + (dy * cos)
  };
}

function segmentsIntersect(a, b, c, d) {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(a, c, b)) return true;
  if (o2 === 0 && onSegment(a, d, b)) return true;
  if (o3 === 0 && onSegment(c, a, d)) return true;
  if (o4 === 0 && onSegment(c, b, d)) return true;
  return false;
}

function orientation(p, q, r) {
  const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
  if (Math.abs(val) < 0.0001) return 0;
  return val > 0 ? 1 : 2;
}

function onSegment(p, q, r) {
  return (
    q.x <= Math.max(p.x, r.x) + 0.0001 &&
    q.x + 0.0001 >= Math.min(p.x, r.x) &&
    q.y <= Math.max(p.y, r.y) + 0.0001 &&
    q.y + 0.0001 >= Math.min(p.y, r.y)
  );
}

function areHostile(sourceDoc, targetDoc) {
  const a = Number(sourceDoc?.disposition ?? 0);
  const b = Number(targetDoc?.disposition ?? 0);
  if (a !== 0 && b !== 0) return a !== b;
  const sourceActorId = String(sourceDoc?.actor?.id || sourceDoc?.actorId || "");
  const targetActorId = String(targetDoc?.actor?.id || targetDoc?.actorId || "");
  return sourceActorId && targetActorId && sourceActorId !== targetActorId;
}

function getPreferredOverwatchWeapon(actor, sourceDoc, targetDoc) {
  const preferredId = String(actor?.getFlag?.("drop-trooper", "overwatchWeaponId") || "").trim();
  const weapons = Array.from(actor?.items || [])
    .filter(item => item?.type === "weapon" && !item?.system?.aoeEnabled)
    .sort((a, b) => Number(a?.system?.displayOrder || 0) - Number(b?.system?.displayOrder || 0));

  const orderedWeapons = preferredId
    ? [weapons.find(item => item?.id === preferredId), ...weapons.filter(item => item?.id !== preferredId)]
    : weapons;

  const distance = measureDistance(sourceDoc, targetDoc);

  for (const weapon of orderedWeapons) {
    if (!weapon) continue;
    const system = weapon.system || {};
    const usesAmmo = Boolean(system.usesAmmo);
    const ammo = Number(system.ammo ?? 0);
    if (usesAmmo && ammo <= 0) continue;

    const longRange = Math.max(0, Number(system.longRange || system.range || 0));
    if (longRange <= 0) continue;
    if (distance <= longRange + 0.1) {
      return { weapon, distance, longRange };
    }
  }

  return null;
}

function getActiveOwners(actor) {
  return (game.users?.filter(user => user.active && actor?.testUserPermission?.(user, "OWNER")) || []);
}

function getPreferredPromptExecutor(actor) {
  const owners = getActiveOwners(actor);
  const playerOwner = owners.find(user => !user.isGM);
  if (playerOwner) return playerOwner;
  return owners.find(user => user.isGM) || game.users?.activeGM || null;
}

async function fireOverwatchAttack(actor, weapon, targetDoc) {
  const targetObj = getSceneToken(targetDoc);
  if (!targetObj) throw new Error("Target token not found on canvas.");

  const previousTargets = Array.from(game.user?.targets || []).map(t => t.id);
  try {
    for (const token of canvas?.tokens?.placeables || []) {
      if (game.user?.targets?.has(token)) token.setTarget(false, { user: game.user, releaseOthers: false });
    }
    targetObj.setTarget(true, { user: game.user, releaseOthers: true, groupSelection: false });

    const sheet = actor.sheet;
    if (!sheet || typeof sheet._onWeaponSingleAttack !== "function") {
      throw new Error(`${actor.name} does not have an attack-capable sheet.`);
    }

    log("Firing overwatch attack", { actor: actor.name, weapon: weapon.name, target: targetDoc.name, executor: game.user?.name });
    await sheet._onWeaponSingleAttack(weapon);
    await actor.update({
      "system.combat.reactionAvailable": false,
      "system.combat.overwatch": false
    });
  } finally {
    for (const token of canvas?.tokens?.placeables || []) {
      if (game.user?.targets?.has(token)) token.setTarget(false, { user: game.user, releaseOthers: false });
    }
    for (const tokenId of previousTargets) {
      const token = canvas?.tokens?.get(tokenId);
      if (token) token.setTarget(true, { user: game.user, releaseOthers: false, groupSelection: false });
    }
  }
}

async function promptOverwatch(actor, weaponData, movedDoc) {
  const promptKey = `${actor.id}:${movedDoc.id}`;
  if (LOCAL_PENDING_PROMPTS.has(promptKey)) {
    log("Prompt already pending", promptKey);
    return;
  }
  LOCAL_PENDING_PROMPTS.add(promptKey);

  const actorName = actor.name || "Trooper";
  const targetName = movedDoc.name || movedDoc.actor?.name || "Target";
  notify(`${actorName} sees ${targetName} move.`, "info");
  log("Prompting overwatch", { actor: actorName, target: targetName, weapon: weaponData.weapon.name, distance: weaponData.distance, executor: game.user?.name });

  try {
    const result = await foundry.applications.api.DialogV2.wait({
      window: { title: `${actorName}: Overwatch` },
      content: `
        <p><strong>${targetName}</strong> moved within range of <strong>${actorName}</strong>.</p>
        <p>Use <strong>${weaponData.weapon.name}</strong> for Overwatch?</p>
        <p><em>Distance:</em> ${Math.round(weaponData.distance * 10) / 10} ft</p>
      `,
      buttons: [
        {
          action: "yes",
          label: "Yes, Fire Overwatch",
          default: true,
          callback: async () => "yes"
        },
        {
          action: "no",
          label: "No, Stay Armed",
          callback: async () => "no"
        }
      ],
      close: () => "no"
    });

    if (result !== "yes") {
      log("Overwatch declined; staying armed", { actor: actorName, target: targetName, executor: game.user?.name });
      return;
    }

    await fireOverwatchAttack(actor, weaponData.weapon, movedDoc);
  } catch (error) {
    console.error(DEBUG_PREFIX, "Prompt/attack failed", error);
    notify(`${actorName} overwatch failed: ${error.message}`, "error");
  } finally {
    LOCAL_PENDING_PROMPTS.delete(promptKey);
  }
}

async function handleMoveToken(document, change, options, userId) {
  const combat = game.combat;
  const movedByUser = game.users?.get?.(userId) || game.users?.find?.(user => String(user?.id || "") === String(userId || "")) || null;
  log("updateToken overwatch hook fired", {
    movedToken: document?.name,
    user: movedByUser?.name || userId || null,
    change,
    options,
    currentUser: game.user?.name,
    currentUserIsGM: Boolean(game.user?.isGM)
  });

  if (!Object.prototype.hasOwnProperty.call(change || {}, "x") && !Object.prototype.hasOwnProperty.call(change || {}, "y")) {
    return;
  }

  if (!combat?.started) {
    log("Skipping overwatch: no active combat.");
    return;
  }

  if (!document?.actor) {
    log("Skipping overwatch: moved token has no actor.");
    return;
  }

  const allSceneTokens = canvas?.scene?.tokens?.contents || [];
  const armedTokens = allSceneTokens.filter(tokenDoc => {
    if (!tokenDoc?.actor) return false;
    if (tokenDoc.id === document.id) return false;
    const state = hasReactionState(tokenDoc.actor);
    return state.hasReaction && state.reactionAvailable && state.overwatch;
  });

  log("Armed overwatch candidates", armedTokens.map(t => ({ token: t.name, actor: t.actor?.name })));
  if (!armedTokens.length) {
    return;
  }

  for (const watcherDoc of armedTokens) {
    const watcherActor = watcherDoc.actor;

    if (!areHostile(watcherDoc, document)) {
      log("Skipping watcher: target not hostile", {
        watcher: watcherActor?.name,
        moved: document.name,
        watcherDisposition: watcherDoc?.disposition,
        movedDisposition: document?.disposition
      });
      continue;
    }

    const oldCenter = PRE_MOVE_TOKEN_CENTERS.get(String(document.id || "")) || null;
    const firstVisible = getFirstVisiblePointDuringMovement(watcherDoc, document, oldCenter);
    if (!firstVisible) {
      log("Skipping watcher: no visibility during movement", {
        watcher: watcherActor?.name,
        moved: document.name,
        watcherCenter: getTokenCenter(watcherDoc),
        movedStart: oldCenter,
        movedEnd: getTokenCenter(document)
      });
      continue;
    }

    const weaponData = getPreferredOverwatchWeaponForPoint(watcherActor, watcherDoc, firstVisible.point)
      || getPreferredOverwatchWeapon(watcherActor, watcherDoc, document);
    if (!weaponData) {
      log("Skipping watcher: no valid non-AOE weapon in range at first visible point", {
        watcher: watcherActor?.name,
        moved: document.name,
        firstVisiblePoint: firstVisible.point
      });
      continue;
    }
    weaponData.watcherTokenId = watcherDoc.id;
    weaponData.firstVisiblePoint = firstVisible.point;
    weaponData.firstVisibleRatio = firstVisible.ratio;

    const preferredExecutor = getPreferredPromptExecutor(watcherActor);
    const activeGm = game.users?.activeGM || null;
    const executor = preferredExecutor || activeGm;

    log("Overwatch player prompt routing", {
      watcher: watcherActor?.name,
      moved: document.name,
      currentUser: game.user?.name,
      currentUserId: game.user?.id || null,
      preferredExecutor: preferredExecutor?.name || null,
      preferredExecutorId: preferredExecutor?.id || null,
      preferredExecutorIsGM: Boolean(preferredExecutor?.isGM),
      activeGm: activeGm?.name || null,
      activeGmId: activeGm?.id || null,
      executor: executor?.name || null,
      executorId: executor?.id || null,
      executorIsGM: Boolean(executor?.isGM)
    });

    if (!executor?.id) {
      log("Skipping watcher: no prompt executor available", { watcher: watcherActor?.name, moved: document.name });
      continue;
    }

    if (String(executor.id) !== String(game.user?.id || "")) {
      log("Skipping watcher on this client", {
        watcher: watcherActor?.name,
        moved: document.name,
        currentUser: game.user?.name,
        currentUserId: game.user?.id || null,
        executor: executor?.name || null,
        executorId: executor?.id || null,
        executorIsGM: Boolean(executor?.isGM)
      });
      continue;
    }

    log("Executing Overwatch prompt on this client", {
      watcher: watcherActor?.name,
      moved: document.name,
      currentUser: game.user?.name,
      weapon: weaponData?.weapon?.name || null
    });
    await promptOverwatch(watcherActor, weaponData, document);
  }
}

Hooks.once("ready", () => {
  log("Registering overwatch hook on updateToken.");
});

Hooks.on("preUpdateToken", (document, change) => {
  if (!Object.prototype.hasOwnProperty.call(change || {}, "x") && !Object.prototype.hasOwnProperty.call(change || {}, "y")) {
    return;
  }
  PRE_MOVE_TOKEN_CENTERS.set(String(document.id || ""), getTokenCenter(document));
});

Hooks.on("updateToken", (document, change, options, userId) => {
  handleMoveToken(document, change, options, userId).catch(error => {
    console.error(DEBUG_PREFIX, "updateToken handler failed", error);
    notify(`updateToken handler failed: ${error.message}`, "error");
  }).finally(() => {
    PRE_MOVE_TOKEN_CENTERS.delete(String(document?.id || ""));
  });
});
