import { DropTrooperLogger } from "./logger.mjs";
import { registerDropTrooperUtility } from "./namespace.mjs";

const state = {
  hooks: []
};

export function registerHook(eventName, fn) {
  const id = Hooks.on(eventName, fn);
  state.hooks.push({ eventName, id });
  return id;
}

export function registerOnceHook(eventName, fn) {
  Hooks.once(eventName, fn);
}

export function getRegisteredHooks() {
  return Array.from(state.hooks);
}

export function logRegisteredHooks() {
  DropTrooperLogger.debug("Registered hooks", getRegisteredHooks());
}

registerDropTrooperUtility("registerHook", registerHook);
registerDropTrooperUtility("registerOnceHook", registerOnceHook);
registerDropTrooperUtility("getRegisteredHooks", getRegisteredHooks);
