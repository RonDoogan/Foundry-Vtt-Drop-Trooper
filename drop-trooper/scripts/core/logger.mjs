import { DROP_TROOPER_SYSTEM_TITLE } from "./constants.mjs";

function formatArgs(args = []) {
  return [`${DROP_TROOPER_SYSTEM_TITLE} |`, ...args];
}

export class DropTrooperLogger {
  static debugEnabled() {
    try {
      return !!game?.settings?.get?.("core", "debug");
    } catch {
      return false;
    }
  }

  static info(...args) {
    console.log(...formatArgs(args));
  }

  static warn(...args) {
    console.warn(...formatArgs(args));
  }

  static error(...args) {
    console.error(...formatArgs(args));
  }

  static debug(...args) {
    if (!this.debugEnabled()) return;
    console.debug(...formatArgs(args));
  }
}
