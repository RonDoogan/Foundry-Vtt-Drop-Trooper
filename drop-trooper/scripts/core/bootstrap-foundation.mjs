import { DROP_TROOPER_SYSTEM_ID, DROP_TROOPER_SYSTEM_TITLE, DROP_TROOPER_VERSION_TAG } from "./constants.mjs";
import { DropTrooperLogger } from "./logger.mjs";
import { getDropTrooperNamespace, registerDropTrooperService, registerDropTrooperUtility } from "./namespace.mjs";
import { getRegisteredHooks } from "./hook-manager.mjs";
import * as Guards from "./foundry-guards.mjs";
import * as SystemContext from "./system-context.mjs";

export function bootstrapDropTrooperFoundation() {
  const ns = getDropTrooperNamespace();
  ns.systemId = DROP_TROOPER_SYSTEM_ID;
  ns.title = DROP_TROOPER_SYSTEM_TITLE;
  ns.version = DROP_TROOPER_VERSION_TAG;

  registerDropTrooperService("logger", DropTrooperLogger);
  registerDropTrooperUtility("guards", Guards);
  registerDropTrooperUtility("context", SystemContext);
  registerDropTrooperUtility("getRegisteredHooks", getRegisteredHooks);

  globalThis.__DROP_TROOPER_FOUNDATION__ = {
    version: DROP_TROOPER_VERSION_TAG,
    booted: true,
    bootedAt: new Date().toISOString()
  };

  DropTrooperLogger.info(`Foundation booted (${DROP_TROOPER_VERSION_TAG})`);
  return ns;
}

bootstrapDropTrooperFoundation();
