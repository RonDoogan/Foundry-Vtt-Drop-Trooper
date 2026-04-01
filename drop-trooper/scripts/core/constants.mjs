export const DROP_TROOPER_SYSTEM_ID = "drop-trooper";
export const DROP_TROOPER_SYSTEM_TITLE = "Drop Trooper";
export const DROP_TROOPER_VERSION_TAG = "0.1.7-redesign-foundation";

export const DROP_TROOPER_ACTOR_TYPES = Object.freeze({
  TROOPER: "trooper",
  NPC: "npc",
  DRONE: "drone"
});

export const DROP_TROOPER_ITEM_TYPES = Object.freeze({
  WEAPON: "weapon",
  ABILITY: "ability"
});

export const DROP_TROOPER_SOCKET = Object.freeze({
  NAMESPACE: "system.drop-trooper",
  RESPONSE: "response",
  QUEUE_DAMAGE_APPROVAL: "queueDamageApproval",
  DRONE_DEPLOY: "droneDeploy",
  DRONE_RECALL: "droneRecall",
  TOGGLE_OUT_OF_ARMOR: "toggleOutOfArmor",
  PLAY_CRIT_VIDEO: "playCritVideo"
});

export const DROP_TROOPER_FLAGS = Object.freeze({
  MOVEMENT_SCOPE: "drop-trooper",
  MOVEMENT_OVERRIDE: "movementOverride",
  MOVEMENT_STATE: "movementState",
  OUT_OF_ARMOR_STATE: "outOfArmorState",
  ARMOR_SHELL_TILE: "armorShellTile"
});
