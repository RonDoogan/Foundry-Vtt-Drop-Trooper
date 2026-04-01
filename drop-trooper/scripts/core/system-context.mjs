import { registerDropTrooperUtility } from "./namespace.mjs";
import { toFiniteNumber, toLowerKey } from "./foundry-guards.mjs";

export function getActorType(actor) {
  return toLowerKey(actor?.type);
}

export function getItemType(item) {
  return toLowerKey(item?.type);
}

export function getActorIntegrity(actor) {
  return {
    value: Math.max(0, toFiniteNumber(actor?.system?.armor?.integrity?.value, 0)),
    max: Math.max(0, toFiniteNumber(actor?.system?.armor?.integrity?.max, 0))
  };
}

export function getActorHealth(actor) {
  return {
    value: Math.max(0, toFiniteNumber(actor?.system?.health?.value, 0)),
    max: Math.max(0, toFiniteNumber(actor?.system?.health?.max, 0))
  };
}

export function getWeaponDamageTarget(weapon, fallback = "normal") {
  const raw = String(weapon?.system?.damageTarget ?? fallback).trim().toLowerCase();
  if (["health", "health only", "healthonly"].includes(raw)) return "health";
  return "normal";
}

registerDropTrooperUtility("getActorType", getActorType);
registerDropTrooperUtility("getItemType", getItemType);
registerDropTrooperUtility("getActorIntegrity", getActorIntegrity);
registerDropTrooperUtility("getActorHealth", getActorHealth);
registerDropTrooperUtility("getWeaponDamageTarget", getWeaponDamageTarget);
