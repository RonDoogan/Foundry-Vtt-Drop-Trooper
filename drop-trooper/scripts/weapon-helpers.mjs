function getWeaponAmmoState(weapon) {
  const ammoRaw = weapon?.system?.ammo;
  const magSizeRaw = weapon?.system?.magSize;
  const spareAmmoRaw = weapon?.system?.ammoMax;

  const hasAmmoValue = ammoRaw !== undefined && ammoRaw !== null && String(ammoRaw).trim() !== "";
  const hasMagSizeValue = magSizeRaw !== undefined && magSizeRaw !== null && String(magSizeRaw).trim() !== "";
  const hasSpareAmmoValue = spareAmmoRaw !== undefined && spareAmmoRaw !== null && String(spareAmmoRaw).trim() !== "";
  const usesAmmo = hasAmmoValue || hasMagSizeValue || hasSpareAmmoValue;

  const ammo = hasAmmoValue ? Number(ammoRaw) : null;
  const magSize = hasMagSizeValue ? Number(magSizeRaw) : null;
  const spareAmmo = hasSpareAmmoValue ? Number(spareAmmoRaw) : null;

  return {
    usesAmmo,
    ammo,
    magSize,
    spareAmmo,
    hasAmmoValue,
    hasMagSizeValue,
    hasSpareAmmoValue
  };
}

function validateWeaponAmmoState(weapon, ammoState) {
  const weaponName = weapon?.name || "Weapon";

  if (!ammoState?.usesAmmo) return true;

  if (!ammoState.hasAmmoValue || !Number.isFinite(ammoState.ammo)) {
    ui.notifications.warn(`${weaponName}: Ammo Current must be a number.`);
    return false;
  }

  if (!ammoState.hasMagSizeValue || !Number.isFinite(ammoState.magSize)) {
    ui.notifications.warn(`${weaponName}: Magazine Size must be a number.`);
    return false;
  }

  if (!ammoState.hasSpareAmmoValue || !Number.isFinite(ammoState.spareAmmo)) {
    ui.notifications.warn(`${weaponName}: Max Ammo Carried must be a number.`);
    return false;
  }

  return true;
}

function formatWeaponAmmoDisplay(weapon, getAmmoState) {
  const ammoState = typeof getAmmoState === "function" ? getAmmoState(weapon) : getWeaponAmmoState(weapon);

  if (!ammoState.usesAmmo) return "—";

  const current = ammoState.hasAmmoValue && Number.isFinite(ammoState.ammo) ? ammoState.ammo : "?";
  const magSize = ammoState.hasMagSizeValue && Number.isFinite(ammoState.magSize) ? ammoState.magSize : "?";
  const spare = ammoState.hasSpareAmmoValue && Number.isFinite(ammoState.spareAmmo) ? ammoState.spareAmmo : "?";

  return `${current} / ${magSize} (${spare} spare)`;
}

function shouldShowReload(weapon, getAmmoState) {
  const ammoState = typeof getAmmoState === "function" ? getAmmoState(weapon) : getWeaponAmmoState(weapon);
  return !!ammoState.usesAmmo && !!ammoState.hasMagSizeValue;
}

function getAoeType(data) {
  const rawType = String(data?.aoeType ?? "blast").trim().toLowerCase();
  return rawType === "cone" ? "cone" : "blast";
}

function getAoeEffectType(data) {
  const rawType = String(data?.aoeEffect ?? "damage").trim().toLowerCase();
  return rawType === "smoke" ? "smoke" : "damage";
}

function isSmokeWeapon(weapon, getAoeTypeFn, getAoeEffectTypeFn) {
  if (!weapon?.system?.aoeEnabled) return false;
  const aoeType = typeof getAoeTypeFn === "function" ? getAoeTypeFn(weapon.system) : getAoeType(weapon.system);
  const aoeEffectType = typeof getAoeEffectTypeFn === "function" ? getAoeEffectTypeFn(weapon.system) : getAoeEffectType(weapon.system);
  return aoeType === "blast" && aoeEffectType === "smoke";
}

function getWeaponAttackLabel(weapon, isSmokeWeaponFn, getAoeTypeFn) {
  if (!weapon?.system?.aoeEnabled) return "Attack";

  const smoke = typeof isSmokeWeaponFn === "function" ? isSmokeWeaponFn(weapon) : isSmokeWeapon(weapon);
  if (smoke) return "Throw Smoke";

  const aoeType = typeof getAoeTypeFn === "function" ? getAoeTypeFn(weapon.system) : getAoeType(weapon.system);
  return aoeType === "cone" ? "Fire Cone" : "Fire Blast";
}

function getWeaponBlastSoundPath(weapon) {
  const customPath = String(weapon?.system?.blastSoundPath ?? "").trim();
  return customPath || globalThis.DROP_TROOPER_BLAST_SOUND_PATH;
}

function getWeaponBlastImagePath(weapon) {
  const customPath = String(weapon?.system?.blastImagePath ?? "").trim();
  return customPath || globalThis.DROP_TROOPER_BLAST_TILE_TEXTURE;
}

function getWeaponConeSoundPath(weapon) {
  const customPath = String(weapon?.system?.coneSoundPath ?? "").trim();
  return customPath || globalThis.DROP_TROOPER_CONE_SOUND_PATH;
}

function getWeaponConeImagePath(weapon) {
  const customPath = String(weapon?.system?.coneImagePath ?? "").trim();
  return customPath || globalThis.DROP_TROOPER_CONE_TILE_TEXTURE;
}

globalThis.DropTrooperWeaponHelpers = {
  getWeaponAmmoState,
  validateWeaponAmmoState,
  formatWeaponAmmoDisplay,
  shouldShowReload,
  getAoeType,
  getAoeEffectType,
  isSmokeWeapon,
  getWeaponAttackLabel,
  getWeaponBlastSoundPath,
  getWeaponBlastImagePath,
  getWeaponConeSoundPath,
  getWeaponConeImagePath
};
