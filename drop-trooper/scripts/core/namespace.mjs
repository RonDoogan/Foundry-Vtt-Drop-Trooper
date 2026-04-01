import { DROP_TROOPER_SYSTEM_ID, DROP_TROOPER_SYSTEM_TITLE } from "./constants.mjs";

export function getDropTrooperNamespace() {
  if (!globalThis.DropTrooper) {
    globalThis.DropTrooper = {
      systemId: DROP_TROOPER_SYSTEM_ID,
      title: DROP_TROOPER_SYSTEM_TITLE,
      services: {},
      registries: {},
      state: {},
      utils: {}
    };
  }
  return globalThis.DropTrooper;
}

export function registerDropTrooperService(name, value) {
  const ns = getDropTrooperNamespace();
  ns.services[name] = value;
  return value;
}

export function registerDropTrooperUtility(name, value) {
  const ns = getDropTrooperNamespace();
  ns.utils[name] = value;
  return value;
}
