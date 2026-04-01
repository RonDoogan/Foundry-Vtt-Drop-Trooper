function toFiniteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeDamageTarget(value, fallback = "normal") {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

  const map = {
    normal: "normal",
    standard: "normal",
    armor: "normal",
    integrity: "normal",
    health: "health",
    "health only": "health",
    healthonly: "health",
    bypass: "health",
    "bypass armor": "health",
    internal: "health",
    direct: "health"
  };

  return map[raw] || fallback;
}

export class DamageService {
  static getAttackDamageModifiers(successes, baseDamage) {
    const safeSuccesses = Math.max(0, toFiniteNumber(successes, 0));
    const safeBaseDamage = Math.max(0, toFiniteNumber(baseDamage, 0));

    let damageDice = 0;
    let multiplier = 1;

    if (safeSuccesses === 1) {
      damageDice = safeBaseDamage;
    } else if (safeSuccesses === 2) {
      damageDice = safeBaseDamage + 1;
    } else if (safeSuccesses === 3) {
      damageDice = safeBaseDamage;
      multiplier = 2;
    } else if (safeSuccesses >= 4) {
      damageDice = safeBaseDamage;
      multiplier = 2;
    }

    return { damageDice, multiplier };
  }

  static getTierRank(tier) {
    const map = {
      light: 1,
      medium: 2,
      heavy: 3,
      ultra: 4
    };

    return map[String(tier ?? "").trim().toLowerCase()] ?? 2;
  }

  static getTierMultiplier(weaponTier, armorTier) {
    const weaponRank = this.getTierRank(weaponTier);
    const armorRank = this.getTierRank(armorTier);
    const diff = weaponRank - armorRank;

    if (diff >= 2) return 4;
    if (diff === 1) return 2;
    if (diff === 0) return 1;
    if (diff === -1) return 0.5;
    return 0.25;
  }

  static getTierInteractionLabel(weaponTier, armorTier) {
    const weaponRank = this.getTierRank(weaponTier);
    const armorRank = this.getTierRank(armorTier);
    const diff = weaponRank - armorRank;

    if (diff >= 2) return "Weapon is 2+ tiers above armor (x4)";
    if (diff === 1) return "Weapon is 1 tier above armor (x2)";
    if (diff === 0) return "Weapon matches armor tier (x1)";
    if (diff === -1) return "Weapon is 1 tier below armor (x0.5)";
    return "Weapon is 2+ tiers below armor (x0.25)";
  }

  static calculateScaledDamage(rawDamage, attackMultiplier = 1, tierMultiplier = 1) {
    const safeRawDamage = Math.max(0, toFiniteNumber(rawDamage, 0));
    const safeAttackMultiplier = Math.max(0, toFiniteNumber(attackMultiplier, 1));
    const safeTierMultiplier = Math.max(0, toFiniteNumber(tierMultiplier, 1));
    return Math.floor(safeRawDamage * safeAttackMultiplier * safeTierMultiplier);
  }

  static computeDamageFromRoll(options = {}) {
    const preDefenseDamageDice = Math.max(0, toFiniteNumber(options.preDefenseDamageDice, 0));
    const defenseSuccesses = Math.max(0, toFiniteNumber(options.defenseSuccesses, 0));
    const rawDamageTotal = Math.max(0, toFiniteNumber(options.rawDamageTotal, 0));
    const attackMultiplier = Math.max(0, toFiniteNumber(options.attackMultiplier, 1));
    const weaponTier = options.weaponTier ?? "Medium";
    const armorTier = options.armorTier ?? "Medium";

    const cancelledDice = Math.min(defenseSuccesses, preDefenseDamageDice);
    const finalDamageDice = Math.max(0, preDefenseDamageDice - cancelledDice);
    const tierMultiplier = this.getTierMultiplier(weaponTier, armorTier);
    const tierLabel = this.getTierInteractionLabel(weaponTier, armorTier);
    const finalAppliedDamage = this.calculateScaledDamage(rawDamageTotal, attackMultiplier, tierMultiplier);

    return {
      preDefenseDamageDice,
      defenseSuccesses,
      cancelledDice,
      finalDamageDice,
      rawDamageTotal,
      attackMultiplier,
      weaponTier,
      armorTier,
      tierMultiplier,
      tierLabel,
      finalAppliedDamage
    };
  }

  static previewDamageApplication(targetActor, damage, options = {}) {
    const currentIntegrity = Math.max(0, toFiniteNumber(targetActor?.system?.armor?.integrity?.value, 0));
    const tracksHealth = foundry.utils.hasProperty(targetActor, "system.health.value");
    const currentHealth = tracksHealth ? Math.max(0, toFiniteNumber(targetActor?.system?.health?.value, 0)) : 0;
    const safeDamage = Math.max(0, toFiniteNumber(damage, 0));
    const damageTarget = normalizeDamageTarget(options?.damageTarget, "normal");

    let integrityDamage = 0;
    let healthDamage = 0;
    let newIntegrity = currentIntegrity;
    let newHealth = currentHealth;

    if (damageTarget === "health") {
      healthDamage = tracksHealth ? Math.min(currentHealth, safeDamage) : 0;
      newHealth = tracksHealth ? Math.max(0, currentHealth - healthDamage) : 0;
    } else {
      integrityDamage = Math.min(currentIntegrity, safeDamage);
      const remainingAfterIntegrity = Math.max(0, safeDamage - currentIntegrity);
      healthDamage = tracksHealth ? Math.min(currentHealth, remainingAfterIntegrity) : 0;
      newIntegrity = Math.max(0, currentIntegrity - integrityDamage);
      newHealth = tracksHealth ? Math.max(0, currentHealth - healthDamage) : 0;
    }

    return {
      integrityDamage,
      healthDamage,
      newIntegrity,
      newHealth,
      tracksHealth,
      damageTarget,
      totalDamage: safeDamage,
      currentIntegrity,
      currentHealth
    };
  }
}

export { normalizeDamageTarget as normalizeDropTrooperDamageTarget };
