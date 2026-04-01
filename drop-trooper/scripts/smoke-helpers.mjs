const DROP_TROOPER_BLAST_TILE_TEXTURE = globalThis.DROP_TROOPER_BLAST_TILE_TEXTURE;
const DROP_TROOPER_BLAST_TILE_ALPHA = globalThis.DROP_TROOPER_BLAST_TILE_ALPHA;
const DROP_TROOPER_BLAST_TILE_DURATION_MS = globalThis.DROP_TROOPER_BLAST_TILE_DURATION_MS;
const DROP_TROOPER_CONE_TILE_ALPHA = globalThis.DROP_TROOPER_CONE_TILE_ALPHA;
function getDropTrooperSmokeTemplateDocument(template) {
  return template?.document || template || null;
}

function isDropTrooperSmokeTemplate(template) {
  const templateDocument = getDropTrooperSmokeTemplateDocument(template);
  if (!templateDocument) return false;
  if (typeof templateDocument.getFlag === "function") {
    return !!templateDocument.getFlag("drop-trooper", "smokeData");
  }
  return !!templateDocument.flags?.["drop-trooper"]?.smokeData;
}

function getDropTrooperActiveSmokeTemplates() {
  if (!canvas?.ready) return [];
  return (canvas.templates?.placeables || []).filter(isDropTrooperSmokeTemplate);
}

function getDropTrooperPixelsPerDistanceUnit() {
  const gridDistance = Number(canvas?.scene?.grid?.distance) || Number(canvas?.grid?.distance) || 5;
  const gridSize = Number(canvas?.scene?.grid?.size) || Number(canvas?.grid?.size) || 100;
  return gridSize / gridDistance;
}

function dropTrooperDistanceUnitsToPixels(distanceUnits) {
  return Math.max(0, Number(distanceUnits) || 0) * getDropTrooperPixelsPerDistanceUnit();
}

function getDropTrooperSmokeRadiusPixels(template) {
  const templateDocument = getDropTrooperSmokeTemplateDocument(template);
  const radiusDistance = Number(templateDocument?.distance)
    || (Number(templateDocument?.getFlag?.("drop-trooper", "smokeData")?.diameter)
      || Number(templateDocument?.flags?.["drop-trooper"]?.smokeData?.diameter)
      || 0) / 2;
  return dropTrooperDistanceUnitsToPixels(radiusDistance);
}


const DROP_TROOPER_SMOKE_TILE_TEXTURE = "tokens/smoke.png";
const DROP_TROOPER_SMOKE_TILE_ALPHA = 0.9;

function getDropTrooperSmokeTileDocumentsForTemplate(template) {
  const templateDocument = getDropTrooperSmokeTemplateDocument(template);
  const scene = templateDocument?.parent || canvas?.scene;
  if (!templateDocument?.id || !scene) return [];

  return (scene.tiles?.contents || []).filter(tileDocument => {
    return tileDocument?.getFlag?.("drop-trooper", "smokeTileFor") === templateDocument.id
      || tileDocument?.flags?.["drop-trooper"]?.smokeTileFor === templateDocument.id;
  });
}

function buildDropTrooperSmokeTileData(template) {
  const templateDocument = getDropTrooperSmokeTemplateDocument(template);
  if (!templateDocument?.id) return null;

  const centerX = Number(templateDocument.x) || 0;
  const centerY = Number(templateDocument.y) || 0;
  const radiusPx = getDropTrooperSmokeRadiusPixels(templateDocument);
  if (!(radiusPx > 0)) return null;

  const diameterPx = Math.max(1, Math.round(radiusPx * 2));

  return {
    x: Math.round(centerX - radiusPx),
    y: Math.round(centerY - radiusPx),
    width: diameterPx,
    height: diameterPx,
    rotation: 0,
    alpha: DROP_TROOPER_SMOKE_TILE_ALPHA,
    overhead: false,
    z: 100,
    texture: {
      src: DROP_TROOPER_SMOKE_TILE_TEXTURE
    },
    flags: {
      "drop-trooper": {
        smokeTile: true,
        smokeTileFor: templateDocument.id
      }
    }
  };
}

async function syncDropTrooperSmokeVisualForTemplate(template) {
  if (!game.user?.isGM) return;

  const templateDocument = getDropTrooperSmokeTemplateDocument(template);
  const scene = templateDocument?.parent || canvas?.scene;
  if (!scene || !isDropTrooperSmokeTemplate(templateDocument)) return;

  const existingTileIds = getDropTrooperSmokeTileDocumentsForTemplate(templateDocument)
    .map(tileDocument => tileDocument.id)
    .filter(Boolean);

  if (existingTileIds.length > 0) {
    await scene.deleteEmbeddedDocuments("Tile", existingTileIds);
  }

  const tileData = buildDropTrooperSmokeTileData(templateDocument);
  if (tileData) {
    await scene.createEmbeddedDocuments("Tile", [tileData]);
  }
}

async function deleteDropTrooperSmokeVisualForTemplate(template) {
  if (!game.user?.isGM) return;

  const templateDocument = getDropTrooperSmokeTemplateDocument(template);
  const scene = templateDocument?.parent || canvas?.scene;
  if (!scene || !templateDocument?.id) return;

  const existingTileIds = getDropTrooperSmokeTileDocumentsForTemplate(templateDocument)
    .map(tileDocument => tileDocument.id)
    .filter(Boolean);

  if (existingTileIds.length > 0) {
    await scene.deleteEmbeddedDocuments("Tile", existingTileIds);
  }
}

function queueDropTrooperSmokeVisualSync() {
  window.setTimeout(() => {
    if (!game.user?.isGM || !canvas?.ready) return;

    const smokeTemplates = getDropTrooperActiveSmokeTemplates();
    Promise.all(smokeTemplates.map(template => syncDropTrooperSmokeVisualForTemplate(template))).catch(err => {
      console.warn("Drop Trooper | Failed to sync smoke visuals", err);
    });
  }, 0);
}

function applyDropTrooperSmokeTemplatePresentation(template) {
  const templateObject = template?.object || template;
  if (!templateObject || !isDropTrooperSmokeTemplate(templateObject)) return;

  try {
    if (templateObject.template) {
      templateObject.template.visible = false;
      templateObject.template.alpha = 0;
    }

    if (templateObject.ruler) {
      templateObject.ruler.visible = false;
      templateObject.ruler.alpha = 0;
    }

    if (templateObject.hud?.ruler) {
      templateObject.hud.ruler.visible = false;
      templateObject.hud.ruler.alpha = 0;
    }
  } catch (err) {
    console.warn("Drop Trooper | Failed to hide smoke template presentation", err);
  }
}

function refreshDropTrooperSmokeTemplatePresentation() {
  if (!canvas?.ready) return;

  for (const template of getDropTrooperActiveSmokeTemplates()) {
    applyDropTrooperSmokeTemplatePresentation(template);
  }
}

function queueDropTrooperSmokeTemplatePresentationRefresh() {
  window.setTimeout(() => {
    try {
      refreshDropTrooperSmokeTemplatePresentation();
    } catch (err) {
      console.warn("Drop Trooper | Failed to refresh smoke template presentation", err);
    }
  }, 0);
}


function isDropTrooperBlastVisualTemplate(template) {
  const templateDocument = getDropTrooperSmokeTemplateDocument(template);
  if (!templateDocument) return false;
  if (typeof templateDocument.getFlag === "function") {
    return !!templateDocument.getFlag("drop-trooper", "blastVisual");
  }
  return !!templateDocument.flags?.["drop-trooper"]?.blastVisual;
}

function getDropTrooperBlastVisualData(template) {
  const templateDocument = getDropTrooperSmokeTemplateDocument(template);
  if (!templateDocument) return {};
  if (typeof templateDocument.getFlag === "function") {
    return templateDocument.getFlag("drop-trooper", "blastVisualData") || {};
  }
  return templateDocument.flags?.["drop-trooper"]?.blastVisualData || {};
}

function buildDropTrooperBlastTileData(template) {
  const templateDocument = getDropTrooperSmokeTemplateDocument(template);
  if (!templateDocument?.id) return null;

  const centerX = Number(templateDocument.x) || 0;
  const centerY = Number(templateDocument.y) || 0;
  const radiusPx = dropTrooperDistanceUnitsToPixels(Number(templateDocument.distance) || 0);
  if (!(radiusPx > 0)) return null;

  const diameterPx = Math.max(1, Math.round(radiusPx * 2));

  return {
    x: Math.round(centerX - radiusPx),
    y: Math.round(centerY - radiusPx),
    width: diameterPx,
    height: diameterPx,
    rotation: 0,
    alpha: DROP_TROOPER_BLAST_TILE_ALPHA,
    overhead: false,
    z: 110,
    texture: {
      src: String(getDropTrooperBlastVisualData(templateDocument)?.tileTexture || "").trim() || DROP_TROOPER_BLAST_TILE_TEXTURE
    },
    flags: {
      "drop-trooper": {
        blastTile: true,
        blastTileFor: templateDocument.id
      }
    }
  };
}

function getDropTrooperBlastTileDocumentsForTemplate(template) {
  const templateDocument = getDropTrooperSmokeTemplateDocument(template);
  const scene = templateDocument?.parent || canvas?.scene;
  if (!templateDocument?.id || !scene) return [];

  return (scene.tiles?.contents || []).filter(tileDocument => {
    return tileDocument?.getFlag?.("drop-trooper", "blastTileFor") === templateDocument.id
      || tileDocument?.flags?.["drop-trooper"]?.blastTileFor === templateDocument.id;
  });
}

async function deleteDropTrooperBlastVisualForTemplate(template) {
  if (!game.user?.isGM) return;

  const templateDocument = getDropTrooperSmokeTemplateDocument(template);
  const scene = templateDocument?.parent || canvas?.scene;
  if (!scene || !templateDocument?.id) return;

  const existingTileIds = getDropTrooperBlastTileDocumentsForTemplate(templateDocument)
    .map(tileDocument => tileDocument.id)
    .filter(Boolean);

  if (existingTileIds.length > 0) {
    await scene.deleteEmbeddedDocuments("Tile", existingTileIds);
  }
}

async function createDropTrooperBlastVisualForTemplate(template) {
  if (!game.user?.isGM) return;

  const templateDocument = getDropTrooperSmokeTemplateDocument(template);
  const scene = templateDocument?.parent || canvas?.scene;
  if (!scene || !isDropTrooperBlastVisualTemplate(templateDocument)) return;

  await deleteDropTrooperBlastVisualForTemplate(templateDocument);

  const tileData = buildDropTrooperBlastTileData(templateDocument);
  if (!tileData) return;

  const createdTiles = await scene.createEmbeddedDocuments("Tile", [tileData]);
  const createdTileId = createdTiles?.[0]?.id;
  const durationMs = Math.max(500, Number(getDropTrooperBlastVisualData(templateDocument)?.durationMs) || DROP_TROOPER_BLAST_TILE_DURATION_MS);

  window.setTimeout(async () => {
    try {
      if (!game.user?.isGM) return;
      const activeScene = templateDocument?.parent || canvas?.scene;
      if (!activeScene || !createdTileId) return;
      const tileStillExists = (activeScene.tiles?.contents || []).some(tileDocument => tileDocument.id === createdTileId);
      if (tileStillExists) {
        await activeScene.deleteEmbeddedDocuments("Tile", [createdTileId]);
      }
    } catch (err) {
      console.warn("Drop Trooper | Failed to auto-remove blast visual", err);
    }
  }, durationMs);
}


function isDropTrooperConeVisualTemplate(template) {
  const templateDocument = getDropTrooperSmokeTemplateDocument(template);
  if (!templateDocument) return false;
  if (typeof templateDocument.getFlag === "function") {
    return !!templateDocument.getFlag("drop-trooper", "coneVisual");
  }
  return !!templateDocument.flags?.["drop-trooper"]?.coneVisual;
}

function getDropTrooperConeVisualData(template) {
  const templateDocument = getDropTrooperSmokeTemplateDocument(template);
  if (!templateDocument) return {};
  if (typeof templateDocument.getFlag === "function") {
    return templateDocument.getFlag("drop-trooper", "coneVisualData") || {};
  }
  return templateDocument.flags?.["drop-trooper"]?.coneVisualData || {};
}

function buildDropTrooperConeTileData(template) {
  const templateDocument = getDropTrooperSmokeTemplateDocument(template);
  if (!templateDocument?.id) return null;

  const visualData = getDropTrooperConeVisualData(templateDocument);
  const tileTexture = String(visualData?.tileTexture || "").trim();
  if (!tileTexture) return null;

  const originX = Number(templateDocument.x) || 0;
  const originY = Number(templateDocument.y) || 0;
  const distancePx = dropTrooperDistanceUnitsToPixels(Number(templateDocument.distance) || 0);
  if (!(distancePx > 0)) return null;

  const angleDeg = Math.max(1, Number(templateDocument.angle) || 60);
  const halfAngleRad = (angleDeg / 2) * (Math.PI / 180);
  const endWidthPx = Math.max(1, Math.round(2 * distancePx * Math.tan(halfAngleRad)));
  const widthPx = Math.max(1, Math.round(distancePx));
  const normalizedDirection = ((Number(templateDocument.direction) || 0) % 360 + 360) % 360;

  return {
    x: Math.round(originX),
    y: Math.round(originY - (endWidthPx / 2)),
    width: widthPx,
    height: endWidthPx,
    rotation: normalizedDirection,
    alpha: DROP_TROOPER_CONE_TILE_ALPHA,
    overhead: false,
    z: 110,
    texture: {
      src: tileTexture
    },
    flags: {
      "drop-trooper": {
        coneTile: true,
        coneTileFor: templateDocument.id
      }
    }
  };
}

function getDropTrooperConeTileDocumentsForTemplate(template) {
  const templateDocument = getDropTrooperSmokeTemplateDocument(template);
  const scene = templateDocument?.parent || canvas?.scene;
  if (!templateDocument?.id || !scene) return [];

  return (scene.tiles?.contents || []).filter(tileDocument => {
    return tileDocument?.getFlag?.("drop-trooper", "coneTileFor") === templateDocument.id
      || tileDocument?.flags?.["drop-trooper"]?.coneTileFor === templateDocument.id;
  });
}

async function deleteDropTrooperConeVisualForTemplate(template) {
  if (!game.user?.isGM) return;

  const templateDocument = getDropTrooperSmokeTemplateDocument(template);
  const scene = templateDocument?.parent || canvas?.scene;
  if (!scene || !templateDocument?.id) return;

  const existingTileIds = getDropTrooperConeTileDocumentsForTemplate(templateDocument)
    .map(tileDocument => tileDocument.id)
    .filter(Boolean);

  if (existingTileIds.length > 0) {
    await scene.deleteEmbeddedDocuments("Tile", existingTileIds);
  }
}

async function createDropTrooperConeVisualForTemplate(template) {
  if (!game.user?.isGM) return;

  const templateDocument = getDropTrooperSmokeTemplateDocument(template);
  const scene = templateDocument?.parent || canvas?.scene;
  if (!scene || !templateDocument?.id) return;

  await deleteDropTrooperConeVisualForTemplate(templateDocument);
}

function getDropTrooperSmokeWallDocumentsForTemplate(template) {
  const templateDocument = getDropTrooperSmokeTemplateDocument(template);
  const scene = templateDocument?.parent || canvas?.scene;
  if (!templateDocument?.id || !scene) return [];

  return (scene.walls?.contents || []).filter(wallDocument => {
    return wallDocument?.getFlag?.("drop-trooper", "smokeWallFor") === templateDocument.id
      || wallDocument?.flags?.["drop-trooper"]?.smokeWallFor === templateDocument.id;
  });
}

function buildDropTrooperSmokeWallData(template) {
  const templateDocument = getDropTrooperSmokeTemplateDocument(template);
  if (!templateDocument?.id) return [];

  const centerX = Number(templateDocument.x) || 0;
  const centerY = Number(templateDocument.y) || 0;
  const radiusPx = getDropTrooperSmokeRadiusPixels(templateDocument);
  if (!(radiusPx > 0)) return [];

  const circumference = 2 * Math.PI * radiusPx;
  const segmentCount = Math.max(12, Math.min(32, Math.ceil(circumference / 140)));
  const points = [];

  for (let i = 0; i < segmentCount; i += 1) {
    const angle = (Math.PI * 2 * i) / segmentCount;
    points.push({
      x: Math.round(centerX + (Math.cos(angle) * radiusPx)),
      y: Math.round(centerY + (Math.sin(angle) * radiusPx))
    });
  }

  const moveNone = CONST.WALL_MOVEMENT_TYPES?.NONE ?? 0;
  const senseNormal = CONST.WALL_SENSE_TYPES?.NORMAL ?? 20;
  const senseNone = CONST.WALL_SENSE_TYPES?.NONE ?? 0;
  const directionBoth = CONST.WALL_DIRECTIONS?.BOTH ?? 0;
  const doorNone = CONST.WALL_DOOR_TYPES?.NONE ?? 0;

  return points.map((startPoint, index) => {
    const endPoint = points[(index + 1) % points.length];
    return {
      c: [startPoint.x, startPoint.y, endPoint.x, endPoint.y],
      move: moveNone,
      sight: senseNormal,
      light: senseNormal,
      sound: senseNone,
      dir: directionBoth,
      door: doorNone,
      threshold: {
        attenuation: false
      },
      flags: {
        "drop-trooper": {
          smokeWall: true,
          smokeWallFor: templateDocument.id
        }
      }
    };
  });
}

async function syncDropTrooperSmokeWallsForTemplate(template) {
  if (!game.user?.isGM) return;

  const templateDocument = getDropTrooperSmokeTemplateDocument(template);
  const scene = templateDocument?.parent || canvas?.scene;
  if (!scene || !isDropTrooperSmokeTemplate(templateDocument)) return;

  const existingWallIds = getDropTrooperSmokeWallDocumentsForTemplate(templateDocument)
    .map(wallDocument => wallDocument.id)
    .filter(Boolean);

  if (existingWallIds.length > 0) {
    await scene.deleteEmbeddedDocuments("Wall", existingWallIds);
  }

  const wallData = buildDropTrooperSmokeWallData(templateDocument);
  if (wallData.length > 0) {
    await scene.createEmbeddedDocuments("Wall", wallData);
  }
}

async function deleteDropTrooperSmokeWallsForTemplate(template) {
  if (!game.user?.isGM) return;

  const templateDocument = getDropTrooperSmokeTemplateDocument(template);
  const scene = templateDocument?.parent || canvas?.scene;
  if (!scene || !templateDocument?.id) return;

  const existingWallIds = getDropTrooperSmokeWallDocumentsForTemplate(templateDocument)
    .map(wallDocument => wallDocument.id)
    .filter(Boolean);

  if (existingWallIds.length > 0) {
    await scene.deleteEmbeddedDocuments("Wall", existingWallIds);
  }
}

function queueDropTrooperSmokeWallSync() {
  window.setTimeout(() => {
    if (!game.user?.isGM || !canvas?.ready) return;

    const smokeTemplates = getDropTrooperActiveSmokeTemplates();
    Promise.all(smokeTemplates.map(template => syncDropTrooperSmokeWallsForTemplate(template))).catch(err => {
      console.warn("Drop Trooper | Failed to sync smoke walls", err);
    });
  }, 0);
}

function isDropTrooperPointInsideSmoke(point, smokeTemplates = getDropTrooperActiveSmokeTemplates()) {
  if (!point || !smokeTemplates.length) return false;

  return smokeTemplates.some(template => {
    const center = { x: Number(template.document?.x) || 0, y: Number(template.document?.y) || 0 };
    const radiusFeet = Number(template.document?.distance) || Number(template.document?.getFlag("drop-trooper", "smokeData")?.diameter) / 2 || 0;
    const radiusPx = dropTrooperDistanceUnitsToPixels(radiusFeet);
    const dx = Number(point.x) - center.x;
    const dy = Number(point.y) - center.y;
    return ((dx * dx) + (dy * dy)) <= (radiusPx * radiusPx);
  });
}

function doesDropTrooperSegmentIntersectSmoke(startPoint, endPoint, smokeTemplates = getDropTrooperActiveSmokeTemplates()) {
  if (!startPoint || !endPoint || !smokeTemplates.length) return false;

  const ax = Number(startPoint.x) || 0;
  const ay = Number(startPoint.y) || 0;
  const bx = Number(endPoint.x) || 0;
  const by = Number(endPoint.y) || 0;
  const abx = bx - ax;
  const aby = by - ay;
  const abLenSq = (abx * abx) + (aby * aby);

  return smokeTemplates.some(template => {
    const cx = Number(template.document?.x) || 0;
    const cy = Number(template.document?.y) || 0;
    const radiusFeet = Number(template.document?.distance) || Number(template.document?.getFlag("drop-trooper", "smokeData")?.diameter) / 2 || 0;
    const radiusPx = dropTrooperDistanceUnitsToPixels(radiusFeet);

    if (abLenSq <= 0) {
      const dx = ax - cx;
      const dy = ay - cy;
      return ((dx * dx) + (dy * dy)) <= (radiusPx * radiusPx);
    }

    const t = Math.max(0, Math.min(1, (((cx - ax) * abx) + ((cy - ay) * aby)) / abLenSq));
    const closestX = ax + (abx * t);
    const closestY = ay + (aby * t);
    const dx = closestX - cx;
    const dy = closestY - cy;
    return ((dx * dx) + (dy * dy)) <= (radiusPx * radiusPx);
  });
}

function isDropTrooperSmokeBlockingSightBetweenPoints(startPoint, endPoint, smokeTemplates = getDropTrooperActiveSmokeTemplates()) {
  if (!startPoint || !endPoint || !smokeTemplates.length) return false;
  if (isDropTrooperPointInsideSmoke(startPoint, smokeTemplates)) return true;
  if (isDropTrooperPointInsideSmoke(endPoint, smokeTemplates)) return true;
  return doesDropTrooperSegmentIntersectSmoke(startPoint, endPoint, smokeTemplates);
}

function getDropTrooperSmokeObserverTokens() {
  if (!canvas?.ready || !game.user || game.user.isGM) return [];

  const ownerLevel = CONST.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? CONST.DOCUMENT_PERMISSION_LEVELS?.OWNER ?? 3;
  const ownedTokens = (canvas.tokens?.placeables || []).filter(token => {
    if (!token?.actor || !token.center) return false;
    if (token.document?.hidden) return false;
    if (typeof token.actor.testUserPermission === "function") {
      return token.actor.testUserPermission(game.user, ownerLevel);
    }
    return token.actor.isOwner === true;
  });

  const controlledOwned = ownedTokens.filter(token => token.controlled);
  return controlledOwned.length ? controlledOwned : ownedTokens;
}

function shouldDropTrooperSmokeOccludeToken(targetToken, observerTokens, smokeTemplates) {
  if (!targetToken?.actor || !targetToken.center) return false;
  if (!observerTokens?.length || !smokeTemplates?.length) return false;
  if (targetToken.document?.hidden) return false;

  const ownerLevel = CONST.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? CONST.DOCUMENT_PERMISSION_LEVELS?.OWNER ?? 3;
  if (typeof targetToken.actor.testUserPermission === "function" && targetToken.actor.testUserPermission(game.user, ownerLevel)) {
    return false;
  }
  if (targetToken.actor.isOwner === true) return false;

  return observerTokens.every(observer => {
    if (!observer?.center) return true;
    if (observer.id === targetToken.id) return false;
    return isDropTrooperSmokeBlockingSightBetweenPoints(observer.center, targetToken.center, smokeTemplates);
  });
}

function applyDropTrooperSmokeOcclusionToToken(token, occluded) {
  if (!token) return;

  const baseAlpha = Number.isFinite(Number(token.document?.alpha))
    ? Number(token.document.alpha)
    : 1;

  token.alpha = occluded ? 0 : baseAlpha;
  token._dropTrooperSmokeOccluded = occluded;
}

function refreshDropTrooperSmokeOcclusion() {
  if (!canvas?.ready || !canvas.tokens) return;

  const smokeTemplates = getDropTrooperActiveSmokeTemplates();
  const observerTokens = getDropTrooperSmokeObserverTokens();
  const shouldApply = !game.user?.isGM && smokeTemplates.length > 0 && observerTokens.length > 0;

  for (const token of canvas.tokens.placeables || []) {
    if (!token) continue;

    const occluded = shouldApply
      ? shouldDropTrooperSmokeOccludeToken(token, observerTokens, smokeTemplates)
      : false;

    applyDropTrooperSmokeOcclusionToToken(token, occluded);
  }
}

function queueDropTrooperSmokeOcclusionRefresh() {
  window.setTimeout(() => {
    try {
      refreshDropTrooperSmokeOcclusion();
    } catch (err) {
      console.warn("Drop Trooper | Failed to refresh smoke occlusion", err);
    }
  }, 0);
}


globalThis.DropTrooperSmokeHelpers = {
  getDropTrooperSmokeTemplateDocument,
  isDropTrooperSmokeTemplate,
  getDropTrooperActiveSmokeTemplates,
  getDropTrooperPixelsPerDistanceUnit,
  dropTrooperDistanceUnitsToPixels,
  getDropTrooperSmokeRadiusPixels,
  getDropTrooperSmokeTileDocumentsForTemplate,
  buildDropTrooperSmokeTileData,
  syncDropTrooperSmokeVisualForTemplate,
  deleteDropTrooperSmokeVisualForTemplate,
  queueDropTrooperSmokeVisualSync,
  applyDropTrooperSmokeTemplatePresentation,
  refreshDropTrooperSmokeTemplatePresentation,
  queueDropTrooperSmokeTemplatePresentationRefresh,
  isDropTrooperBlastVisualTemplate,
  getDropTrooperBlastVisualData,
  buildDropTrooperBlastTileData,
  getDropTrooperBlastTileDocumentsForTemplate,
  deleteDropTrooperBlastVisualForTemplate,
  createDropTrooperBlastVisualForTemplate,
  isDropTrooperConeVisualTemplate,
  getDropTrooperConeVisualData,
  buildDropTrooperConeTileData,
  getDropTrooperConeTileDocumentsForTemplate,
  deleteDropTrooperConeVisualForTemplate,
  createDropTrooperConeVisualForTemplate,
  getDropTrooperSmokeWallDocumentsForTemplate,
  buildDropTrooperSmokeWallData,
  syncDropTrooperSmokeWallsForTemplate,
  deleteDropTrooperSmokeWallsForTemplate,
  queueDropTrooperSmokeWallSync,
  isDropTrooperPointInsideSmoke,
  doesDropTrooperSegmentIntersectSmoke,
  isDropTrooperSmokeBlockingSightBetweenPoints,
  getDropTrooperSmokeObserverTokens,
  shouldDropTrooperSmokeOccludeToken,
  applyDropTrooperSmokeOcclusionToToken,
  refreshDropTrooperSmokeOcclusion,
  queueDropTrooperSmokeOcclusionRefresh
};
