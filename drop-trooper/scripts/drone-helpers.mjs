function isDropTrooperDroneActor(actor) {
  return String(actor?.type || "") === "drone";
}

function getDropTrooperDroneCurrentControllerActorId(actor) {
  return String(actor?.system?.control?.controllerActorId || "").trim();
}

function getDropTrooperDroneNextControllerActorId(actor, changed = {}) {
  if (foundry.utils.hasProperty(changed, "system.control.controllerActorId")) {
    return String(foundry.utils.getProperty(changed, "system.control.controllerActorId") || "").trim();
  }
  return getDropTrooperDroneCurrentControllerActorId(actor);
}

function getDropTrooperDroneCurrentIntegrity(actor) {
  const value = Number(actor?.system?.armor?.integrity?.value);
  return Number.isFinite(value) ? value : 0;
}

function getDropTrooperDroneNextIntegrity(actor, changed = {}) {
  if (foundry.utils.hasProperty(changed, "system.armor.integrity.value")) {
    const value = Number(foundry.utils.getProperty(changed, "system.armor.integrity.value"));
    return Number.isFinite(value) ? value : 0;
  }
  return getDropTrooperDroneCurrentIntegrity(actor);
}

function getDropTrooperDroneCurrentDeployed(actor) {
  return Boolean(actor?.system?.combat?.deployed);
}

function getDropTrooperDroneNextDeployed(actor, changed = {}) {
  if (foundry.utils.hasProperty(changed, "system.combat.deployed")) {
    return Boolean(foundry.utils.getProperty(changed, "system.combat.deployed"));
  }
  return getDropTrooperDroneCurrentDeployed(actor);
}

function getDropTrooperDroneCurrentActionsPerTurn(actor) {
  const value = Number(actor?.system?.combat?.actionsPerTurn);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
}

function getDropTrooperDroneNextActionsPerTurn(actor, changed = {}) {
  if (foundry.utils.hasProperty(changed, "system.combat.actionsPerTurn")) {
    const value = Number(foundry.utils.getProperty(changed, "system.combat.actionsPerTurn"));
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
  }
  return getDropTrooperDroneCurrentActionsPerTurn(actor);
}

function findDropTrooperActiveDroneConflict(controllerActorId, excludedActorId = null) {
  const controllerId = String(controllerActorId || "").trim();
  if (!controllerId) return null;

  for (const candidate of game.actors?.contents || []) {
    if (!isDropTrooperDroneActor(candidate)) continue;
    if (excludedActorId && candidate.id === excludedActorId) continue;

    const candidateControllerId = getDropTrooperDroneCurrentControllerActorId(candidate);
    if (candidateControllerId !== controllerId) continue;
    if (!getDropTrooperDroneCurrentDeployed(candidate)) continue;
    if (getDropTrooperDroneCurrentIntegrity(candidate) <= 0) continue;

    return candidate;
  }

  return null;
}

function getDropTrooperSocketRequestId() {
  return randomID();
}

function getDropTrooperUserById(userId) {
  const id = String(userId || "").trim();
  if (!id) return null;
  return game.users?.get(id) || null;
}

function getDropTrooperFirstActiveGmUser() {
  const active = (game.users?.contents || []).find(user => user?.isGM && user?.active);
  if (active) return active;
  return (game.users?.contents || []).find(user => user?.isGM) || null;
}

function isDropTrooperGridPositionOccupied(scene, x, y, width = 1, height = 1, excludedActorId = null) {
  if (!scene) return false;
  const gridSize = Number(canvas?.grid?.size) || 100;
  const candidate = {
    x: Number(x) || 0,
    y: Number(y) || 0,
    width: Math.max(1, Number(width) || 1),
    height: Math.max(1, Number(height) || 1)
  };

  const candidateRight = candidate.x + (candidate.width * gridSize);
  const candidateBottom = candidate.y + (candidate.height * gridSize);

  for (const tokenDoc of scene.tokens || []) {
    const tokenActorId = String(tokenDoc?.actorId || "").trim();
    if (excludedActorId && tokenActorId === String(excludedActorId)) continue;

    const tokenX = Number(tokenDoc?.x) || 0;
    const tokenY = Number(tokenDoc?.y) || 0;
    const tokenWidth = Math.max(1, Number(tokenDoc?.width) || 1);
    const tokenHeight = Math.max(1, Number(tokenDoc?.height) || 1);
    const tokenRight = tokenX + (tokenWidth * gridSize);
    const tokenBottom = tokenY + (tokenHeight * gridSize);

    const overlaps = candidate.x < tokenRight
      && candidateRight > tokenX
      && candidate.y < tokenBottom
      && candidateBottom > tokenY;

    if (overlaps) return true;
  }

  return false;
}

function getDropTrooperNearestOpenDroneSpawnPosition(sourceTokenDocument, droneTokenDocument, scene = canvas?.scene) {
  const gridSize = Number(canvas?.grid?.size) || 100;
  const startX = Number(sourceTokenDocument?.x) || 0;
  const startY = Number(sourceTokenDocument?.y) || 0;
  const droneWidth = Math.max(1, Number(droneTokenDocument?.width) || 1);
  const droneHeight = Math.max(1, Number(droneTokenDocument?.height) || 1);
  const excludedActorId = String(sourceTokenDocument?.actorId || "").trim() || null;

  for (let radius = 1; radius <= 3; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;

        const candidateX = startX + (dx * gridSize);
        const candidateY = startY + (dy * gridSize);
        if (candidateX < 0 || candidateY < 0) continue;

        if (!isDropTrooperGridPositionOccupied(scene, candidateX, candidateY, droneWidth, droneHeight, excludedActorId)) {
          return { x: candidateX, y: candidateY };
        }
      }
    }
  }

  return { x: startX, y: startY };
}

function parseDropTrooperAssignedDroneIds(actor) {
  const raw = String(actor?.system?.drone?.assignedActorId || "");
  return raw
    .split(/[\n,;]/)
    .map(entry => String(entry || "").trim())
    .filter(Boolean);
}

function getDropTrooperAssignedDroneActors(actor) {
  const seen = new Set();
  return parseDropTrooperAssignedDroneIds(actor)
    .map(actorId => game.actors?.get(actorId) || null)
    .filter(candidate => {
      if (!candidate || String(candidate.type || "") !== "drone") return false;
      if (seen.has(candidate.id)) return false;
      seen.add(candidate.id);
      return true;
    });
}

function getDropTrooperAssignedDroneActor(actor, preferredActorId = null) {
  const assignedDrones = getDropTrooperAssignedDroneActors(actor);
  if (!assignedDrones.length) return null;

  const preferredId = String(preferredActorId || "").trim();
  if (preferredId) {
    const preferred = assignedDrones.find(candidate => candidate.id === preferredId);
    if (preferred) return preferred;
  }

  const activeDrone = assignedDrones.find(candidate => getDropTrooperDroneCurrentDeployed(candidate));
  return activeDrone || assignedDrones[0] || null;
}



globalThis.DropTrooperDroneHelpers = {
  isDropTrooperDroneActor,
  getDropTrooperDroneCurrentControllerActorId,
  getDropTrooperDroneNextControllerActorId,
  getDropTrooperDroneCurrentIntegrity,
  getDropTrooperDroneNextIntegrity,
  getDropTrooperDroneCurrentDeployed,
  getDropTrooperDroneNextDeployed,
  getDropTrooperDroneCurrentActionsPerTurn,
  getDropTrooperDroneNextActionsPerTurn,
  findDropTrooperActiveDroneConflict,
  getDropTrooperSocketRequestId,
  getDropTrooperFirstActiveGmUser,
  isDropTrooperGridPositionOccupied,
  getDropTrooperNearestOpenDroneSpawnPosition,
  parseDropTrooperAssignedDroneIds,
  getDropTrooperAssignedDroneActors,
  getDropTrooperAssignedDroneActor
};
