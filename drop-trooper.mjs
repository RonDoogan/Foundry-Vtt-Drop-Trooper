import { AbilityService } from "./scripts/services/ability-service.mjs";

const DROP_TROOPER_DEFEATED_STATUS_ID = "dropTrooperDefeated";
const DROP_TROOPER_DEFEATED_STATUS_NAME = "Drop Trooper Defeated";
const DROP_TROOPER_DEFEATED_STATUS_ICON = "systems/drop-trooper/assets/defeated-red-x.svg";
const DROP_TROOPER_DEFEAT_SOUND_CANDIDATES = ["Sounds/Spaha.mp3", "sounds/Spaha.mp3"];

class DropTrooperSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["drop-trooper", "sheet", "actor"],
      width: 900,
      height: 900,
      resizable: true
    });
  }

  get template() {
    if (this.actor.type === "npc") {
      return "systems/drop-trooper/templates/actor/npc-sheet.hbs";
    }

    return "systems/drop-trooper/templates/actor/trooper-sheet.hbs";
  }

  getData() {
    const data = super.getData();
    data.system = this.actor.system;
    data.weapons = this.actor.items
      .filter(item => item.type === "weapon")
      .map(item => ({
        _id: item.id,
        name: item.name,
        type: item.type,
        system: item.system,
        ammoDisplay: this._formatWeaponAmmoDisplay(item),
        reloadVisible: this._shouldShowReload(item),
        attackLabel: this._getWeaponAttackLabel(item)
      }));
    data.abilities = this.actor.items
      .filter(item => item.type === "ability")
      .map(item => ({
        _id: item.id,
        name: item.name,
        type: item.type,
        system: item.system,
        abilityModeLabel: this._getAbilityModeLabel(item),
        linkedSkillLabel: this._getAbilityLinkedSkillLabel(item),
        poolDisplay: this._getAbilityPoolDisplay(item),
        resetVisible: this._shouldShowAbilityReset(item)
      }));
    return data;
  }

  activateListeners(html) {
  super.activateListeners(html);

  html.find(".roll-shoot").click(this._onRollShoot.bind(this));
  html.find(".roll-defense").click(this._onRollDefense.bind(this));
  html.find(".brace-roll").click(this._onBrace.bind(this));
  html.find(".roll-damage").click(this._onRollDamage.bind(this));
  html.find(".roll-skill").click(this._onRollSkill.bind(this));
  html.find(".roll-attribute").click(this._onRollAttribute.bind(this));
  html.find(".micro-missile-test").click(this._onMicroMissileTest.bind(this));
  html.find(".weapon-attack").click(this._onWeaponAttack.bind(this));
  html.find(".weapon-delete").click(this._onWeaponDelete.bind(this));
  html.find(".weapon-edit").click(this._onWeaponEdit.bind(this));
  html.find(".weapon-reload").click(this._onWeaponReload.bind(this));
  html.find(".weapon-create").click(this._onWeaponCreate.bind(this));
  html.find(".npc-blueprint-export").click(this._onNpcBlueprintExport.bind(this));
  html.find(".ability-create").click(this._onAbilityCreate.bind(this));
  html.find(".ability-use").click(this._onAbilityUse.bind(this));
  html.find(".ability-edit").click(this._onAbilityEdit.bind(this));
  html.find(".ability-delete").click(this._onAbilityDelete.bind(this));
  html.find(".ability-reset").click(this._onAbilityReset.bind(this));

  // ✅ ADD THIS LINE
  html.find(".nano-repair").click(this._onNanoRepair.bind(this));
}


  _getSkillLabel(skillKey) {
    const labelMap = {
      shooting: "Shooting",
      heavyWeapons: "Heavy Weapons",
      melee: "Melee",
      maneuvering: "Maneuvering",
      recon: "Recon",
      sensors: "Sensors",
      electronics: "Electronics",
      engineering: "Engineering",
      droneControl: "Drone Control",
      command: "Command",
      discipline: "Discipline",
      survival: "Survival",
      defense: "Defense",
      strength: "Strength",
      agility: "Agility",
      perception: "Perception",
      tech: "Tech",
      will: "Will"
    };

    return labelMap[skillKey] || "—";
  }

  _getAbilityModeLabel(ability) {
    return ability.system?.abilityType === "special" ? "Special" : "Skill";
  }

  _getAbilityLinkedSkillLabel(ability) {
    if (ability.system?.abilityType !== "skill") return "—";
    return this._getSkillLabel(ability.system?.linkedSkill);
  }

  _getAbilityPoolDisplay(ability) {
    const current = Number(ability.system?.pool?.value) || 0;
    const max = Number(ability.system?.pool?.max) || 0;
    if (max <= 0) return "—";
    return `${current} / ${max}`;
  }

  _shouldShowAbilityReset(ability) {
    return (Number(ability.system?.pool?.max) || 0) > 0;
  }

  _getPendingRollBonus(actor = this.actor) {
    const raw = actor.getFlag("drop-trooper", "pendingRollBonus");
    const dice = Number(raw?.dice) || 0;
    if (dice <= 0) return null;

    return {
      dice,
      source: raw?.source || "Bonus Dice"
    };
  }

  _getPendingRollPenalty(actor = this.actor) {
    const raw = actor.getFlag("drop-trooper", "pendingRollPenalty");
    const dice = Number(raw?.dice) || 0;
    if (dice <= 0) return null;

    return {
      dice,
      source: raw?.source || "Penalty Dice"
    };
  }

  _getPendingRollModifiers(actor = this.actor) {
    const pendingBonus = this._getPendingRollBonus(actor);
    const pendingPenalty = this._getPendingRollPenalty(actor);

    return {
      pendingBonus,
      pendingPenalty,
      bonusDice: pendingBonus?.dice || 0,
      penaltyDice: pendingPenalty?.dice || 0
    };
  }

  _getAdjustedRollData(baseDice, actor = this.actor) {
    const modifierData = this._getPendingRollModifiers(actor);
    const base = Number(baseDice) || 0;

    return {
      baseDice: base,
      totalDice: Math.max(0, base + modifierData.bonusDice - modifierData.penaltyDice),
      pendingBonus: modifierData.pendingBonus,
      pendingPenalty: modifierData.pendingPenalty,
      bonusDice: modifierData.bonusDice,
      penaltyDice: modifierData.penaltyDice
    };
  }

  async _consumePendingRollBonus(actor = this.actor) {
    await actor.unsetFlag("drop-trooper", "pendingRollBonus");
  }

  async _consumePendingRollPenalty(actor = this.actor) {
    await actor.unsetFlag("drop-trooper", "pendingRollPenalty");
  }

  async _consumePendingRollModifiers(actor = this.actor, modifierData = null) {
    const data = modifierData || this._getPendingRollModifiers(actor);

    if (data?.bonusDice > 0) {
      await this._consumePendingRollBonus(actor);
    }

    if (data?.penaltyDice > 0) {
      await this._consumePendingRollPenalty(actor);
    }
  }

  async _setPendingRollBonus(actor, dice, source = "Bonus Dice") {
    await actor.setFlag("drop-trooper", "pendingRollBonus", {
      dice,
      source
    });
  }

  async _setPendingRollPenalty(actor, dice, source = "Penalty Dice") {
    await actor.setFlag("drop-trooper", "pendingRollPenalty", {
      dice,
      source
    });
  }

  _getPendingDefenseBrace(actor = this.actor) {
    const raw = actor.getFlag("drop-trooper", "pendingDefenseBrace");
    const multiplier = Number(raw?.multiplier) || 0;
    if (multiplier <= 1) return null;

    return {
      multiplier,
      source: raw?.source || "Brace"
    };
  }

  _getAdjustedDefenseRollData(actor = this.actor) {
    const baseDefense = Number(actor.system.skills?.defense) || 0;
    const rollData = this._getAdjustedRollData(baseDefense, actor);
    const pendingBrace = this._getPendingDefenseBrace(actor);
    const braceMultiplier = pendingBrace?.multiplier || 1;
    const preBraceDice = rollData.totalDice;

    return {
      ...rollData,
      pendingBrace,
      braceMultiplier,
      preBraceDice,
      totalDice: Math.max(0, preBraceDice * braceMultiplier)
    };
  }

  async _setPendingDefenseBrace(actor, multiplier = 2, source = "Brace") {
    await actor.setFlag("drop-trooper", "pendingDefenseBrace", {
      multiplier,
      source
    });
  }

  async _consumePendingDefenseBrace(actor = this.actor) {
    await actor.unsetFlag("drop-trooper", "pendingDefenseBrace");
  }

  async _consumePendingDefenseEffects(actor = this.actor, defenseData = null) {
    const data = defenseData || this._getAdjustedDefenseRollData(actor);

    if (data?.bonusDice > 0 || data?.penaltyDice > 0) {
      await this._consumePendingRollModifiers(actor, data);
    }

    if ((data?.braceMultiplier || 1) > 1) {
      await this._consumePendingDefenseBrace(actor);
    }
  }


  _getPendingAttackAim(actor = this.actor) {
    const raw = actor.getFlag("drop-trooper", "pendingAttackAim");
    const dice = Number(raw?.dice) || 0;
    if (dice <= 0) return null;

    return {
      dice,
      source: raw?.source || "Aim"
    };
  }

  _getAdjustedAttackRollData(baseDice, actor = this.actor) {
    const rollData = this._getAdjustedRollData(baseDice, actor);
    const pendingAim = this._getPendingAttackAim(actor);
    const aimDice = pendingAim?.dice || 0;

    return {
      ...rollData,
      pendingAim,
      aimDice,
      totalDice: Math.max(0, rollData.totalDice + aimDice)
    };
  }

  async _setPendingAttackAim(actor, dice = 2, source = "Aim") {
    await actor.setFlag("drop-trooper", "pendingAttackAim", {
      dice,
      source
    });
  }

  async _consumePendingAttackAim(actor = this.actor) {
    await actor.unsetFlag("drop-trooper", "pendingAttackAim");
  }

  async _consumePendingAttackEffects(actor = this.actor, attackData = null) {
    const data = attackData || this._getAdjustedAttackRollData(0, actor);

    if (data?.bonusDice > 0 || data?.penaltyDice > 0) {
      await this._consumePendingRollModifiers(actor, data);
    }

    if ((data?.aimDice || 0) > 0) {
      await this._consumePendingAttackAim(actor);
    }
  }

  _getSceneActorChoices(excludeSelf = true) {
    if (!canvas?.ready) return [];

    const seen = new Set();
    const choices = [];

    for (const token of canvas.tokens.placeables) {
      const actor = token.actor;
      if (!actor) continue;
      if (excludeSelf && actor.id === this.actor.id) continue;
      if (seen.has(actor.id)) continue;

      seen.add(actor.id);
      choices.push({
        actor,
        label: token.name || actor.name
      });
    }

    return choices;
  }

  _getWeaponAmmoState(weapon) {
    const ammoRaw = weapon.system?.ammo;
    const magSizeRaw = weapon.system?.magSize;
    const spareAmmoRaw = weapon.system?.ammoMax;

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

  _validateWeaponAmmoState(weapon, ammoState) {
    const weaponName = weapon.name || "Weapon";

    if (!ammoState.usesAmmo) return true;

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

  _formatWeaponAmmoDisplay(weapon) {
    const ammoState = this._getWeaponAmmoState(weapon);

    if (!ammoState.usesAmmo) return "—";

    const current = ammoState.hasAmmoValue && Number.isFinite(ammoState.ammo) ? ammoState.ammo : "?";
    const magSize = ammoState.hasMagSizeValue && Number.isFinite(ammoState.magSize) ? ammoState.magSize : "?";
    const spare = ammoState.hasSpareAmmoValue && Number.isFinite(ammoState.spareAmmo) ? ammoState.spareAmmo : "?";

    return `${current} / ${magSize} (${spare} spare)`;
  }

  _shouldShowReload(weapon) {
    const ammoState = this._getWeaponAmmoState(weapon);
    return ammoState.usesAmmo && ammoState.hasMagSizeValue;
  }

  _getWeaponAttackLabel(weapon) {
    if (!weapon.system?.aoeEnabled) return "Attack";

    if (this._isSmokeWeapon(weapon)) {
      return "Throw Smoke";
    }

    return this._getAoeType(weapon.system) === "cone" ? "Fire Cone" : "Fire Blast";
  }

  _getAoeType(data) {
    const rawType = String(data?.aoeType ?? "blast").trim().toLowerCase();
    return rawType === "cone" ? "cone" : "blast";
  }

  _getAoeEffectType(data) {
    const rawType = String(data?.aoeEffect ?? "damage").trim().toLowerCase();
    return rawType === "smoke" ? "smoke" : "damage";
  }

  _isSmokeWeapon(weapon) {
    if (!weapon?.system?.aoeEnabled) return false;
    return this._getAoeType(weapon.system) === "blast" && this._getAoeEffectType(weapon.system) === "smoke";
  }

  _getNumericValue(rawValue, defaultValue = 0) {
    if (rawValue === "" || rawValue === null || rawValue === undefined) return defaultValue;
    const parsed = Number(rawValue);
    return Number.isFinite(parsed) ? parsed : defaultValue;
  }

  _normalizeDirection(direction) {
    return ((Number(direction) % 360) + 360) % 360;
  }

  _getPointDirectionDegrees(origin, point) {
    const dx = point.x - origin.x;
    const dy = point.y - origin.y;
    return this._normalizeDirection(Math.atan2(dy, dx) * (180 / Math.PI));
  }

  _getAngleDifference(a, b) {
    let diff = Math.abs(this._normalizeDirection(a) - this._normalizeDirection(b));
    if (diff > 180) diff = 360 - diff;
    return diff;
  }

  _getActorTokenOnCanvas() {
    if (!canvas?.ready) return null;

    const controlled = canvas.tokens.controlled.find(token => token.actor?.id === this.actor.id);
    if (controlled) return controlled;

    return canvas.tokens.placeables.find(token => token.actor?.id === this.actor.id) || null;
  }

  _formatRangeBand(start, end) {
    if (end <= 0 || end <= start) return "Disabled";
    return `${start}–${end} ft`;
  }

  _buildDiceHtml(dieResults, successOnSix = true) {
    let diceHtml = "";

    for (let d of dieResults) {
      const isSuccess = successOnSix && d === 6;
      const dieClass = isSuccess ? "dt-die-pill success" : "dt-die-pill";
      diceHtml += `<span class="${dieClass}">${d}</span>`;
    }

    return diceHtml;
  }

  _formatMultiplier(multiplier) {
    if (Number.isInteger(multiplier)) return String(multiplier);
    return multiplier.toFixed(2).replace(/\.00$/, "");
  }

  async _showDice3D(formula) {
    if (!game?.dice3d) return;
    try {
      const roll = await new Roll(formula).evaluate();
      await game.dice3d.showForRoll(roll, game.user, true, null, false);
    } catch (err) {
      console.warn("Drop Trooper | Dice So Nice preview failed", err);
    }
  }

  async _rollVisibleDicePool(dicePool) {
    if (dicePool <= 0) {
      return {
        dieResults: [],
        successes: 0
      };
    }

    const roll = await new Roll(`${dicePool}d6`).evaluate();

    if (game?.dice3d) {
      try {
        await game.dice3d.showForRoll(roll, game.user, true, null, false);
      } catch (err) {
        console.warn("Drop Trooper | Dice So Nice visible roll failed", err);
      }
    }

    const dieResults = roll.dice[0]?.results?.map(r => r.result) ?? [];
    const successes = dieResults.filter(d => d === 6).length;

    return {
      dieResults,
      successes
    };
  }


  async _rollDicePool(dicePool) {
    if (dicePool <= 0) {
      return {
        dieResults: [],
        successes: 0
      };
    }

    const roll = await new Roll(`${dicePool}d6`).evaluate();
    const dieResults = roll.dice[0]?.results?.map(r => r.result) ?? [];
    const successes = dieResults.filter(d => d === 6).length;

    return {
      dieResults,
      successes
    };
  }

  async _rollDamageDice(diceCount) {
    if (diceCount <= 0) {
      return {
        dieResults: [],
        total: 0
      };
    }

    const roll = await new Roll(`${diceCount}d6`).evaluate();
    const dieResults = roll.dice[0]?.results?.map(r => r.result) ?? [];
    const total = dieResults.reduce((sum, d) => sum + d, 0);

    return {
      dieResults,
      total
    };
  }

  async _rollPool(label, dicePool, type = "skill", options = {}) {
    const baseDice = Number(options.baseDice ?? dicePool) || 0;
    const bonusDice = Number(options.bonusDice ?? 0) || 0;
    const penaltyDice = Number(options.penaltyDice ?? 0) || 0;
    const defenseMultiplier = Number(options.defenseMultiplier ?? 1) || 1;
    const preMultiplierDice = Number(options.preMultiplierDice ?? Math.max(0, baseDice + bonusDice - penaltyDice)) || 0;
    const totalDice = Math.max(0, dicePool);

    const result = await this._rollVisibleDicePool(totalDice);
    const diceHtml = this._buildDiceHtml(result.dieResults, true);

    const subtitleMap = {
      skill: "Skill Roll",
      defense: "Defense Roll",
      attribute: "Attribute Roll"
    };

    const content = `
      <div class="dt-chat-card">
        <div class="dt-chat-header">
          <div class="dt-chat-title">${this.actor.name}</div>
          <div class="dt-chat-subtitle">${subtitleMap[type] || "Roll"}</div>
        </div>
        <div class="dt-chat-body">
          <div class="dt-chat-section">
            <div class="dt-chat-grid">
              <div class="dt-chat-line">
                <span class="dt-chat-small">${label}</span><br>
                <span class="dt-chat-strong">${totalDice}d6</span>
              </div>
              <div class="dt-chat-line">
                <span class="dt-chat-small">Successes</span><br>
                <span class="dt-chat-strong">${result.successes}</span>
              </div>
              ${totalDice <= 0 ? `
              <div class="dt-chat-line">
                <span class="dt-chat-small">Result</span><br>
                <span class="dt-chat-strong">Automatic Fail (0 dice)</span>
              </div>` : ""}
              ${(bonusDice > 0 || penaltyDice > 0) ? `
              <div class="dt-chat-line">
                <span class="dt-chat-small">Base Dice</span><br>
                <span class="dt-chat-strong">${baseDice}d6</span>
              </div>` : ""}
              ${bonusDice > 0 ? `
              <div class="dt-chat-line">
                <span class="dt-chat-small">${options.bonusSource || "Bonus Dice"}</span><br>
                <span class="dt-chat-strong">+${bonusDice}d6</span>
              </div>` : ""}
              ${penaltyDice > 0 ? `
              <div class="dt-chat-line">
                <span class="dt-chat-small">${options.penaltySource || "Penalty Dice"}</span><br>
                <span class="dt-chat-strong">-${penaltyDice}d6</span>
              </div>` : ""}
              ${defenseMultiplier > 1 ? `
              <div class="dt-chat-line">
                <span class="dt-chat-small">${options.defenseMultiplierSource || "Brace"}</span><br>
                <span class="dt-chat-strong">${preMultiplierDice}d6 × ${defenseMultiplier}</span>
              </div>` : ""}
            </div>
            <div class="dt-chat-dice-row">${diceHtml}</div>
          </div>
        </div>
      </div>
    `;

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content
    });

    if (options.consumeBonus || options.consumePenalty) {
      await this._consumePendingRollModifiers(this.actor, { bonusDice, penaltyDice });
    }

    if (options.consumeBrace && defenseMultiplier > 1) {
      await this._consumePendingDefenseBrace(this.actor);
    }

    return true;
  }

  _getAttackOutcome(successes) {
    if (successes <= 0) return "Miss";
    if (successes === 1) return "Hit";
    if (successes === 2) return "Accurate Hit (+1 damage die)";
    if (successes === 3) return "Critical Hit (damage x2)";
    return "Epic Hit (damage x2 + epic effect)";
  }

  _getOutcomeClass(successes) {
    if (successes <= 0) return "miss";
    if (successes === 1 || successes === 2) return "hit";
    if (successes === 3) return "crit";
    return "epic";
  }

  _getAttackDamageModifiers(successes, baseDamage) {
    let damageDice = 0;
    let multiplier = 1;

    if (successes === 1) {
      damageDice = baseDamage;
    } else if (successes === 2) {
      damageDice = baseDamage + 1;
    } else if (successes === 3) {
      damageDice = baseDamage;
      multiplier = 2;
    } else if (successes >= 4) {
      damageDice = baseDamage;
      multiplier = 2;
    }

    return { damageDice, multiplier };
  }

  _getTierRank(tier) {
    const map = {
      light: 1,
      medium: 2,
      heavy: 3,
      ultra: 4
    };

    return map[String(tier ?? "").trim().toLowerCase()] ?? 2;
  }

  _getTierMultiplier(weaponTier, armorTier) {
    const weaponRank = this._getTierRank(weaponTier);
    const armorRank = this._getTierRank(armorTier);
    const diff = weaponRank - armorRank;

    if (diff >= 2) return 4;
    if (diff === 1) return 2;
    if (diff === 0) return 1;
    if (diff === -1) return 0.5;
    return 0.25;
  }

  _getTierInteractionLabel(weaponTier, armorTier) {
    const weaponRank = this._getTierRank(weaponTier);
    const armorRank = this._getTierRank(armorTier);
    const diff = weaponRank - armorRank;

    if (diff >= 2) return "Weapon is 2+ tiers above armor (x4)";
    if (diff === 1) return "Weapon is 1 tier above armor (x2)";
    if (diff === 0) return "Weapon matches armor tier (x1)";
    if (diff === -1) return "Weapon is 1 tier below armor (x0.5)";
    return "Weapon is 2+ tiers below armor (x0.25)";
  }

  async _applyDamageToActor(targetActor, damage) {
    const currentIntegrity = Number(targetActor.system.armor?.integrity?.value) || 0;
    const currentHealth = Number(targetActor.system.health?.value) || 0;

    const integrityDamage = Math.min(currentIntegrity, damage);
    const remainingAfterIntegrity = Math.max(0, damage - currentIntegrity);
    const healthDamage = Math.min(currentHealth, remainingAfterIntegrity);

    const newIntegrity = Math.max(0, currentIntegrity - integrityDamage);
    const newHealth = Math.max(0, currentHealth - healthDamage);

    await targetActor.update({
      "system.armor.integrity.value": newIntegrity,
      "system.health.value": newHealth
    });

    return {
      integrityDamage,
      healthDamage,
      newIntegrity,
      newHealth
    };
  }

  async _promptForCanvasPoint(message = "Click a point on the map.") {
    if (!canvas?.ready) {
      ui.notifications.warn("Canvas is not ready.");
      return null;
    }

    ui.notifications.info(message);

    return await new Promise((resolve) => {
      const stage = canvas.stage;

      stage.once("pointerdown", (event) => {
        const local = event.data.getLocalPosition(stage);
        resolve({ x: local.x, y: local.y });
      });
    });
  }

  async _createBlastTemplate(point, radius = 100) {
    if (!canvas?.scene) return;

    const existingTemplates = canvas.templates.placeables;
    const existingIds = existingTemplates.map(t => t.id);

    if (existingIds.length > 0) {
      await canvas.scene.deleteEmbeddedDocuments("MeasuredTemplate", existingIds);
    }

    const templateData = {
      t: "circle",
      user: game.user.id,
      x: point.x,
      y: point.y,
      direction: 0,
      distance: radius,
      fillColor: "#ff6600"
    };

    const createdTemplates = await canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [templateData]);

    if (createdTemplates.length > 0) {
      const newTemplateId = createdTemplates[0].id;

      setTimeout(async () => {
        try {
          if (!canvas?.scene) return;

          const templateStillExists = canvas.templates.placeables.some(t => t.id === newTemplateId);

          if (templateStillExists) {
            await canvas.scene.deleteEmbeddedDocuments("MeasuredTemplate", [newTemplateId]);
          }
        } catch (err) {
          console.warn("Drop Trooper | Failed to auto-remove blast template", err);
        }
      }, 4000);
    }
  }

  async _createConeTemplate(origin, direction = 0, distance = 20, angle = 60) {
    if (!canvas?.scene) return;

    const existingTemplates = canvas.templates.placeables;
    const existingIds = existingTemplates.map(t => t.id);

    if (existingIds.length > 0) {
      await canvas.scene.deleteEmbeddedDocuments("MeasuredTemplate", existingIds);
    }

    const templateData = {
      t: "cone",
      user: game.user.id,
      x: origin.x,
      y: origin.y,
      direction: this._normalizeDirection(direction),
      distance,
      angle,
      fillColor: "#33cc88"
    };

    const createdTemplates = await canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [templateData]);

    if (createdTemplates.length > 0) {
      const newTemplateId = createdTemplates[0].id;

      setTimeout(async () => {
        try {
          if (!canvas?.scene) return;

          const templateStillExists = canvas.templates.placeables.some(t => t.id === newTemplateId);

          if (templateStillExists) {
            await canvas.scene.deleteEmbeddedDocuments("MeasuredTemplate", [newTemplateId]);
          }
        } catch (err) {
          console.warn("Drop Trooper | Failed to auto-remove cone template", err);
        }
      }, 4000);
    }
  }


  async _createSmokeTemplate(point, diameter = 30, durationRounds = 3) {
    if (!canvas?.scene) return null;

    const safeDiameter = Math.max(1, this._getNumericValue(diameter, 30));
    const safeDuration = Math.max(1, Math.floor(this._getNumericValue(durationRounds, 3)));
    const radius = safeDiameter / 2;
    const combatId = game.combat?.id || null;
    const createdRound = Number(game.combat?.round) || 0;
    const removeAtRound = combatId ? createdRound + safeDuration : null;

    const templateData = {
      t: "circle",
      user: game.user.id,
      x: point.x,
      y: point.y,
      direction: 0,
      distance: radius,
      fillColor: "#8e99a8",
      flags: {
        "drop-trooper": {
          smokeTemplate: true,
          smokeData: {
            diameter: safeDiameter,
            durationRounds: safeDuration,
            createdRound,
            removeAtRound,
            combatId
          }
        }
      }
    };

    const createdTemplates = await canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [templateData]);
    return createdTemplates?.[0] || null;
  }

  async _removeExpiredSmokeTemplates(combat = game.combat) {
    if (!game.user?.isGM) return;
    if (!combat || !canvas?.scene) return;

    const currentRound = Number(combat.round) || 0;
    const templates = canvas.templates?.placeables || [];
    const expiredIds = [];

    for (const template of templates) {
      const smokeData = template.document?.getFlag("drop-trooper", "smokeData");
      if (!smokeData) continue;
      if (smokeData.combatId && smokeData.combatId !== combat.id) continue;

      const removeAtRound = Number(smokeData.removeAtRound);
      if (Number.isFinite(removeAtRound) && currentRound >= removeAtRound) {
        expiredIds.push(template.id);
      }
    }

    if (expiredIds.length > 0) {
      await canvas.scene.deleteEmbeddedDocuments("MeasuredTemplate", expiredIds);
    }
  }

  _getBlastZones(point, killRadius = 30, heavyRadius = 60, fragRadius = 100) {
    const zones = {
      kill: [],
      heavy: [],
      frag: []
    };

    for (const token of canvas.tokens.placeables) {
      if (!token.actor) continue;

      const distance = canvas.grid.measureDistance(point, token.center);

      if (distance <= killRadius) {
        zones.kill.push({ token, distance });
      } else if (distance <= heavyRadius) {
        zones.heavy.push({ token, distance });
      } else if (distance <= fragRadius) {
        zones.frag.push({ token, distance });
      }
    }

    return zones;
  }

  _getConeZones(sourceToken, direction, coneAngle = 60, killRange = 0, heavyRange = 0, fragRange = 0, coneRange = 0) {
    const zones = {
      kill: [],
      heavy: [],
      frag: []
    };

    const origin = sourceToken.center;
    const maxRange = Math.max(
      this._getNumericValue(coneRange, 0),
      this._getNumericValue(killRange, 0),
      this._getNumericValue(heavyRange, 0),
      this._getNumericValue(fragRange, 0)
    );

    if (maxRange <= 0) return zones;

    for (const token of canvas.tokens.placeables) {
      if (!token.actor) continue;
      if (token.id === sourceToken.id) continue;

      const distance = canvas.grid.measureDistance(origin, token.center);
      if (distance <= 0 || distance > maxRange) continue;

      const tokenDirection = this._getPointDirectionDegrees(origin, token.center);
      const angleDiff = this._getAngleDifference(direction, tokenDirection);

      if (angleDiff > coneAngle / 2) continue;

      if (killRange > 0 && distance <= killRange) {
        zones.kill.push({ token, distance });
      } else if (heavyRange > 0 && distance <= heavyRange) {
        zones.heavy.push({ token, distance });
      } else if (fragRange > 0 && distance <= fragRange) {
        zones.frag.push({ token, distance });
      }
    }

    return zones;
  }

  _formatBlastZoneList(entries) {
    if (!entries.length) {
      return `<div class="dt-chat-small">None</div>`;
    }

    return entries
      .map(entry => {
        return `
          <div class="dt-chat-line">
            <span class="dt-chat-strong">${entry.token.name}</span>
            <span class="dt-chat-small">(${Math.round(entry.distance)} ft)</span>
          </div>
        `;
      })
      .join("");
  }

  async _resolveBlastEntries(entries, zoneLabel, zoneDamageDice, weaponTier) {
    if (!entries.length) {
      return `
        <div class="dt-chat-section">
          <h4>${zoneLabel} Resolution</h4>
          <div class="dt-chat-small">No targets affected.</div>
        </div>
      `;
    }

    let html = `
      <div class="dt-chat-section">
        <h4>${zoneLabel} Resolution</h4>
    `;

    for (const entry of entries) {
      const targetToken = entry.token;
      const targetActor = targetToken.actor;

      if (!targetActor) continue;

      const beforeIntegrity = Number(targetActor.system.armor?.integrity?.value) || 0;
      const beforeHealth = Number(targetActor.system.health?.value) || 0;

      const defenseData = this._getAdjustedDefenseRollData(targetActor);
      const defensePool = defenseData.totalDice;
      const defenseResult = await this._rollDicePool(defensePool);
      if (defenseData.bonusDice > 0 || defenseData.penaltyDice > 0 || defenseData.braceMultiplier > 1) {
        await this._consumePendingDefenseEffects(targetActor, defenseData);
      }

      const cancelledDice = Math.min(defenseResult.successes, zoneDamageDice);
      const finalDamageDice = Math.max(0, zoneDamageDice - cancelledDice);

      const damageRoll = await this._rollDamageDice(finalDamageDice);

      const armorTier = targetActor.system.armor?.tier || "Medium";
      const tierMultiplier = this._getTierMultiplier(weaponTier, armorTier);

      const finalAppliedDamage = Math.floor(damageRoll.total * tierMultiplier);
      const applicationResult = await this._applyDamageToActor(targetActor, finalAppliedDamage);

      html += `
        <div class="dt-chat-line dt-chat-target-break">
          <span class="dt-chat-strong">${targetToken.name}</span>
          <span class="dt-chat-small">(${Math.round(entry.distance)} ft)</span>
        </div>

        <div class="dt-chat-grid dt-chat-grid--compact">
          <div class="dt-chat-line">
            <span class="dt-chat-small">Defense</span><br>
            <span class="dt-chat-strong">${defensePool}d6 → ${defenseResult.successes} success${defenseResult.successes === 1 ? "" : "es"}${defenseData.braceMultiplier > 1 ? ` • ${defenseData.pendingBrace?.source || "Brace"} x${defenseData.braceMultiplier}` : ""}</span>
          </div>
          <div class="dt-chat-line">
            <span class="dt-chat-small">Damage Dice</span><br>
            <span class="dt-chat-strong">${zoneDamageDice}d6 → ${finalDamageDice}d6</span>
          </div>
          <div class="dt-chat-line">
            <span class="dt-chat-small">Raw Damage</span><br>
            <span class="dt-chat-strong">${damageRoll.total}</span>
          </div>
          <div class="dt-chat-line">
            <span class="dt-chat-small">Armor</span><br>
            <span class="dt-chat-strong">${armorTier} (x${this._formatMultiplier(tierMultiplier)})</span>
          </div>
          <div class="dt-chat-line">
            <span class="dt-chat-small">Applied</span><br>
            <span class="dt-chat-final">${finalAppliedDamage}</span>
          </div>
        </div>

        <div class="dt-chat-grid dt-chat-grid--compact">
          <div class="dt-chat-line">
            <span class="dt-chat-small">Integrity</span><br>
            <span class="dt-chat-strong">${beforeIntegrity} → ${applicationResult.newIntegrity}</span>
          </div>
          <div class="dt-chat-line">
            <span class="dt-chat-small">Health</span><br>
            <span class="dt-chat-strong">${beforeHealth} → ${applicationResult.newHealth}</span>
          </div>
        </div>
      `;
    }

    html += `</div>`;
    return html;
  }

  async _onMicroMissileTest(event) {
    const rollData = this._getAdjustedAttackRollData(Number(this.actor.system.skills?.heavyWeapons) || 0, this.actor);
    const baseAttackPool = rollData.baseDice;
    const pendingBonus = rollData.pendingBonus;
    const pendingPenalty = rollData.pendingPenalty;
    const pendingAim = rollData.pendingAim;
    const bonusDice = rollData.bonusDice;
    const penaltyDice = rollData.penaltyDice;
    const aimDice = rollData.aimDice;
    const attackPool = rollData.totalDice;
    const weaponTier = this.actor.system.weapon?.tier || "Medium";
    const weaponName = this.actor.system.weapon?.name || "AOE Weapon";

    const weaponData = this.actor.system.weapon ?? {};
    const blastRadius = weaponData.blastRadius === "" || weaponData.blastRadius === null || weaponData.blastRadius === undefined ? 100 : Number(weaponData.blastRadius);
    const killRadius = weaponData.killRadius === "" || weaponData.killRadius === null || weaponData.killRadius === undefined ? 30 : Number(weaponData.killRadius);
    const heavyRadius = weaponData.heavyRadius === "" || weaponData.heavyRadius === null || weaponData.heavyRadius === undefined ? 60 : Number(weaponData.heavyRadius);
    const fragRadius = weaponData.fragRadius === "" || weaponData.fragRadius === null || weaponData.fragRadius === undefined ? 100 : Number(weaponData.fragRadius);

    const killDamage = Number(this.actor.system.weapon?.killDamage) || 6;
    const heavyDamage = Number(this.actor.system.weapon?.heavyDamage) || 4;
    const fragDamage = Number(this.actor.system.weapon?.fragDamage) || 2;

    // 0 dice is allowed here and resolves as an automatic miss (0 successes).
    // This ensures one-shot bonuses/penalties are still consumed cleanly.

    const point = await this._promptForCanvasPoint(`Click the ${weaponName} impact point on the map.`);
    if (!point) return false;

    const attackResult = await this._rollVisibleDicePool(attackPool);
    if (bonusDice > 0 || penaltyDice > 0 || aimDice > 0) {
      await this._consumePendingAttackEffects(this.actor, rollData);
    }
    const attackDiceHtml = this._buildDiceHtml(attackResult.dieResults, true);
    const hit = attackResult.successes >= 1;

    let finalPoint = point;
    let attackResultText = "MISS";
    let attackNote = "Missed aim point. Scatter applied.";
    let scatterHtml = "";

    if (!hit) {
      const scatterDirectionRoll = await (new Roll("1d8")).evaluate();
      const scatterDistanceRoll = await (new Roll("1d10 * 5")).evaluate();

      const direction = scatterDirectionRoll.total;
      const distanceFeet = scatterDistanceRoll.total;

      const angleMap = {
        1: 270,
        2: 315,
        3: 0,
        4: 45,
        5: 90,
        6: 135,
        7: 180,
        8: 225
      };

      const angleDeg = angleMap[direction] ?? 0;
      const angleRad = angleDeg * (Math.PI / 180);

      const pixelsPerFoot = canvas.dimensions.size / canvas.dimensions.distance;
      const scatterPixels = distanceFeet * pixelsPerFoot;

      finalPoint = {
        x: point.x + Math.cos(angleRad) * scatterPixels,
        y: point.y + Math.sin(angleRad) * scatterPixels
      };

      scatterHtml = `
        <div class="dt-chat-section">
          <h4>Scatter</h4>
          <div class="dt-chat-grid">
            <div class="dt-chat-line">
              <span class="dt-chat-small">Direction</span><br>
              <span class="dt-chat-strong">${direction}</span>
            </div>
            <div class="dt-chat-line">
              <span class="dt-chat-small">Distance</span><br>
              <span class="dt-chat-strong">${distanceFeet} ft</span>
            </div>
          </div>
        </div>
      `;
    } else {
      attackResultText = "HIT";
      attackNote = "Hit aim point. Blast centered on clicked location.";
    }

    await this._createBlastTemplate(finalPoint, blastRadius);

    const zones = this._getBlastZones(finalPoint, killRadius, heavyRadius, fragRadius);

    const killResolutionHtml = await this._resolveBlastEntries(zones.kill, "Kill Zone", killDamage, weaponTier);
    const heavyResolutionHtml = await this._resolveBlastEntries(zones.heavy, "Heavy Splash", heavyDamage, weaponTier);
    const fragResolutionHtml = await this._resolveBlastEntries(zones.frag, "Fragmentation", fragDamage, weaponTier);

    const content = `
      <div class="dt-chat-card">
        <div class="dt-chat-header">
          <div class="dt-chat-title">${this.actor.name}</div>
          <div class="dt-chat-subtitle">${weaponName}</div>
        </div>
        <div class="dt-chat-body">

          <div class="dt-chat-section">
            <h4>Attack Roll</h4>
            <div class="dt-chat-grid">
              <div class="dt-chat-line">
                <span class="dt-chat-small">Attack Pool</span><br>
                <span class="dt-chat-strong">${attackPool}d6</span>
              </div>
              <div class="dt-chat-line">
                <span class="dt-chat-small">Successes</span><br>
                <span class="dt-chat-strong">${attackResult.successes}</span>
              </div>
            </div>
            <div class="dt-chat-dice-row">${attackDiceHtml}</div>
            <div class="dt-chat-line dt-chat-line--compact">
              <span class="dt-chat-small">Result</span><br>
              <span class="dt-chat-strong">${attackResultText}</span>
            </div>
            <div class="dt-chat-line">
              <span class="dt-chat-small">Note</span><br>
              <span class="dt-chat-strong">${attackNote}</span>
            </div>
            <div class="dt-chat-line">
              <span class="dt-chat-small">Weapon Tier Used</span><br>
              <span class="dt-chat-strong">${weaponTier}</span>
            </div>
          </div>

          ${scatterHtml}

          <div class="dt-chat-section">
            <h4>Blast Zones</h4>
            <div class="dt-chat-line">
              <span class="dt-chat-small">Kill Zone</span><br>
              <span class="dt-chat-strong">0–${killRadius} ft</span>
            </div>
            ${this._formatBlastZoneList(zones.kill)}
          </div>

          <div class="dt-chat-section">
            <div class="dt-chat-line">
              <span class="dt-chat-small">Heavy Splash</span><br>
              <span class="dt-chat-strong">${killRadius}–${heavyRadius} ft</span>
            </div>
            ${this._formatBlastZoneList(zones.heavy)}
          </div>

          <div class="dt-chat-section">
            <div class="dt-chat-line">
              <span class="dt-chat-small">Fragmentation</span><br>
              <span class="dt-chat-strong">${heavyRadius}–${fragRadius} ft</span>
            </div>
            ${this._formatBlastZoneList(zones.frag)}
          </div>

          <div class="dt-chat-section">
            <h4>Zone Profile</h4>
            <div class="dt-chat-grid">
              <div class="dt-chat-line">
                <span class="dt-chat-small">Blast Radius</span><br>
                <span class="dt-chat-strong">${blastRadius} ft</span>
              </div>
              <div class="dt-chat-line">
                <span class="dt-chat-small">Kill Zone</span><br>
                <span class="dt-chat-strong">${killDamage}d6</span>
              </div>
              <div class="dt-chat-line">
                <span class="dt-chat-small">Heavy Splash</span><br>
                <span class="dt-chat-strong">${heavyDamage}d6</span>
              </div>
              <div class="dt-chat-line">
                <span class="dt-chat-small">Fragmentation</span><br>
                <span class="dt-chat-strong">${fragDamage}d6</span>
              </div>
            </div>
          </div>

          ${killResolutionHtml}
          ${heavyResolutionHtml}
          ${fragResolutionHtml}

        </div>
      </div>
    `;

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content
    });

    if (options.consumeBonus && bonusDice > 0) {
      await this._consumePendingRollBonus(this.actor);
    }

    return true;
  }

  async _onRollSkill(event) {
    const skillKey = event.currentTarget.dataset.skill;
    const label = this._getSkillLabel(skillKey) || "Skill";
    const rollData = this._getAdjustedRollData(Number(this.actor.system.skills?.[skillKey]) || 0, this.actor);

    await this._rollPool(label, rollData.totalDice, "skill", {
      baseDice: rollData.baseDice,
      bonusDice: rollData.bonusDice,
      penaltyDice: rollData.penaltyDice,
      bonusSource: rollData.pendingBonus?.source,
      penaltySource: rollData.pendingPenalty?.source,
      consumeBonus: rollData.bonusDice > 0,
      consumePenalty: rollData.penaltyDice > 0
    });
  }

  async _onRollAttribute(event) {
    const attributeKey = event.currentTarget.dataset.attribute;
    const label = this._getSkillLabel(attributeKey) || "Attribute";
    const rollData = this._getAdjustedRollData(Number(this.actor.system.attributes?.[attributeKey]) || 0, this.actor);

    await this._rollPool(label, rollData.totalDice, "attribute", {
      baseDice: rollData.baseDice,
      bonusDice: rollData.bonusDice,
      penaltyDice: rollData.penaltyDice,
      bonusSource: rollData.pendingBonus?.source,
      penaltySource: rollData.pendingPenalty?.source,
      consumeBonus: rollData.bonusDice > 0,
      consumePenalty: rollData.penaltyDice > 0
    });
  }

  async _onRollShoot(event) {
    const rollData = this._getAdjustedAttackRollData(Number(this.actor.system.skills?.shooting) || 0, this.actor);
    const baseShootPool = rollData.baseDice;
    const pendingBonus = rollData.pendingBonus;
    const pendingPenalty = rollData.pendingPenalty;
    const pendingAim = rollData.pendingAim;
    const bonusDice = rollData.bonusDice;
    const penaltyDice = rollData.penaltyDice;
    const aimDice = rollData.aimDice;
    const shootPool = rollData.totalDice;
    const baseDamage = Number(this.actor.system.weapon?.baseDamage) || 0;
    const weaponName = this.actor.system.weapon?.name || "Weapon";
    const weaponTier = this.actor.system.weapon?.tier || "Medium";

    // 0 dice is allowed here and resolves as an automatic fail (0 successes).
    // This ensures one-shot bonuses/penalties are still consumed cleanly.

    if (baseDamage <= 0) {
      ui.notifications.warn("Base Damage Dice must be at least 1.");
      return;
    }

    const targets = Array.from(game.user.targets);

    if (targets.length === 0) {
      ui.notifications.warn("No target selected.");
      return;
    }

    const targetToken = targets[0];
    const targetActor = targetToken.actor;

    if (!targetActor) {
      ui.notifications.warn("Target has no actor.");
      return;
    }

    const attackResult = await this._rollVisibleDicePool(shootPool);
    if (bonusDice > 0 || penaltyDice > 0 || aimDice > 0) {
      await this._consumePendingAttackEffects(this.actor, rollData);
    }
    const attackDiceHtml = this._buildDiceHtml(attackResult.dieResults, true);
    const outcome = this._getAttackOutcome(attackResult.successes);
    const outcomeClass = this._getOutcomeClass(attackResult.successes);

    let content = `
      <div class="dt-chat-card">
        <div class="dt-chat-header">
          <div class="dt-chat-title">${this.actor.name} → ${targetActor.name}</div>
          <div class="dt-chat-subtitle">Attack Workflow</div>
        </div>
        <div class="dt-chat-body">

          <div class="dt-chat-section">
            <h4>Attack</h4>
            <div class="dt-chat-grid">
              <div class="dt-chat-line"><span class="dt-chat-small">Attack Pool</span><br><span class="dt-chat-strong">${shootPool}d6</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Successes</span><br><span class="dt-chat-strong">${attackResult.successes}</span></div>
              ${shootPool <= 0 ? `<div class="dt-chat-line"><span class="dt-chat-small">Result</span><br><span class="dt-chat-strong">Automatic Miss (0 dice)</span></div>` : ""}
              ${bonusDice > 0 ? `<div class="dt-chat-line"><span class="dt-chat-small">${pendingBonus.source}</span><br><span class="dt-chat-strong">+${bonusDice}d6</span></div>` : ""}
              ${aimDice > 0 ? `<div class="dt-chat-line"><span class="dt-chat-small">${pendingAim.source}</span><br><span class="dt-chat-strong">+${aimDice}d6</span></div>` : ""}
              ${penaltyDice > 0 ? `<div class="dt-chat-line"><span class="dt-chat-small">${pendingPenalty.source}</span><br><span class="dt-chat-strong">-${penaltyDice}d6</span></div>` : ""}
              ${aimDice > 0 ? `<div class="dt-chat-line"><span class="dt-chat-small">${pendingAim.source}</span><br><span class="dt-chat-strong">+${aimDice}d6</span></div>` : ""}
              ${penaltyDice > 0 ? `<div class="dt-chat-line"><span class="dt-chat-small">${pendingPenalty.source}</span><br><span class="dt-chat-strong">-${penaltyDice}d6</span></div>` : ""}
            </div>
            <div class="dt-chat-dice-row">${attackDiceHtml}</div>
            <div class="dt-chat-line dt-chat-line--compact">
              <span class="dt-chat-small">Outcome</span><br>
              <span class="dt-chat-outcome ${outcomeClass}">${outcome}</span>
            </div>
          </div>
    `;

    if (attackResult.successes >= 1) {
      const attackMods = this._getAttackDamageModifiers(attackResult.successes, baseDamage);
      const preDefenseDamageDice = attackMods.damageDice;

      const defenseData = this._getAdjustedDefenseRollData(targetActor);
      const defensePool = defenseData.totalDice;
      const defenseResult = await this._rollDicePool(defensePool);
      if (defenseData.bonusDice > 0 || defenseData.penaltyDice > 0 || defenseData.braceMultiplier > 1) {
        await this._consumePendingDefenseEffects(targetActor, defenseData);
      }
      const defenseDiceHtml = this._buildDiceHtml(defenseResult.dieResults, true);
      const cancelledDice = Math.min(defenseResult.successes, preDefenseDamageDice);
      const finalDamageDice = Math.max(0, preDefenseDamageDice - cancelledDice);

      const damageRoll = await this._rollDamageDice(finalDamageDice);
      const damageDiceHtml = this._buildDiceHtml(damageRoll.dieResults, false);

      const armorTier = targetActor.system.armor?.tier || "Medium";
      const tierMultiplier = this._getTierMultiplier(weaponTier, armorTier);
      const tierLabel = this._getTierInteractionLabel(weaponTier, armorTier);
      const scaledDamage = Math.floor(damageRoll.total * attackMods.multiplier * tierMultiplier);

      const applicationResult = await this._applyDamageToActor(targetActor, scaledDamage);

      content += `
          <div class="dt-chat-section">
            <h4>Defense</h4>
            <div class="dt-chat-grid">
              <div class="dt-chat-line"><span class="dt-chat-small">Defense Pool</span><br><span class="dt-chat-strong">${defensePool}d6</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Dice Cancelled</span><br><span class="dt-chat-strong">${cancelledDice}</span></div>
              ${defenseData.braceMultiplier > 1 ? `<div class="dt-chat-line"><span class="dt-chat-small">${defenseData.pendingBrace?.source || "Brace"}</span><br><span class="dt-chat-strong">x${defenseData.braceMultiplier}</span></div>` : ""}
            </div>
            <div class="dt-chat-dice-row">${defenseDiceHtml}</div>
            <div class="dt-chat-line dt-chat-line--compact"><span class="dt-chat-small">Defense Successes</span><br><span class="dt-chat-strong">${defenseResult.successes}</span></div>
          </div>

          <div class="dt-chat-section">
            <h4>Damage</h4>
            <div class="dt-chat-grid">
              <div class="dt-chat-line"><span class="dt-chat-small">Weapon</span><br><span class="dt-chat-strong">${weaponName}</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Base Damage</span><br><span class="dt-chat-strong">${baseDamage}d6</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Pre-Defense Dice</span><br><span class="dt-chat-strong">${preDefenseDamageDice}d6</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Final Damage Dice</span><br><span class="dt-chat-strong">${finalDamageDice}d6</span></div>
            </div>
            <div class="dt-chat-dice-row">${damageDiceHtml}</div>
            <div class="dt-chat-grid dt-chat-grid--compact">
              <div class="dt-chat-line"><span class="dt-chat-small">Raw Damage</span><br><span class="dt-chat-strong">${damageRoll.total}</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Attack Multiplier</span><br><span class="dt-chat-strong">x${attackMods.multiplier}</span></div>
            </div>
          </div>

          <div class="dt-chat-section">
            <h4>Tier Interaction</h4>
            <div class="dt-chat-grid">
              <div class="dt-chat-line"><span class="dt-chat-small">Weapon Tier</span><br><span class="dt-chat-strong">${weaponTier}</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Armor Tier</span><br><span class="dt-chat-strong">${armorTier}</span></div>
            </div>
            <div class="dt-chat-line dt-chat-line--compact"><span class="dt-chat-small">Result</span><br><span class="dt-chat-strong">${tierLabel}</span></div>
            <div class="dt-chat-line"><span class="dt-chat-small">Tier Multiplier</span><br><span class="dt-chat-strong">${this._formatMultiplier(tierMultiplier)}</span></div>
          </div>

          <div class="dt-chat-section">
            <h4>Applied Damage</h4>
            <div class="dt-chat-line"><span class="dt-chat-small">Final Applied Damage</span><br><span class="dt-chat-final">${scaledDamage}</span></div>
            <div class="dt-chat-grid dt-chat-grid--compact">
              <div class="dt-chat-line"><span class="dt-chat-small">Integrity Damage</span><br><span class="dt-chat-strong">${applicationResult.integrityDamage}</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Health Damage</span><br><span class="dt-chat-strong">${applicationResult.healthDamage}</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Remaining Integrity</span><br><span class="dt-chat-strong">${applicationResult.newIntegrity}</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Remaining Health</span><br><span class="dt-chat-strong">${applicationResult.newHealth}</span></div>
            </div>
          </div>
      `;
    } else {
      content += `
          <div class="dt-chat-section">
            <h4>Result</h4>
            <div class="dt-chat-line"><span class="dt-chat-small">Damage</span><br><span class="dt-chat-strong">No damage rolled.</span></div>
          </div>
      `;
    }

    content += `
        </div>
      </div>
    `;

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content
    });
  }

  async _onWeaponAttack(event) {
    event.preventDefault();

    const itemId = event.currentTarget.dataset.itemId;
    const weapon = this.actor.items.get(itemId);

    if (!weapon) {
      ui.notifications.warn("Weapon not found.");
      return;
    }

    if (weapon.system?.aoeEnabled) {
      await this._onWeaponAoeAttack(weapon);
      return;
    }

    await this._onWeaponSingleAttack(weapon);
  }

  async _onWeaponSingleAttack(weapon) {
    const skillKey = weapon.system?.skill || "shooting";
    const rollData = this._getAdjustedAttackRollData(Number(this.actor.system.skills?.[skillKey]) || 0, this.actor);
    const baseAttackPool = rollData.baseDice;
    const pendingBonus = rollData.pendingBonus;
    const pendingPenalty = rollData.pendingPenalty;
    const pendingAim = rollData.pendingAim;
    const bonusDice = rollData.bonusDice;
    const penaltyDice = rollData.penaltyDice;
    const aimDice = rollData.aimDice;
    const attackPool = rollData.totalDice;
    const baseDamage = Number(weapon.system?.baseDamage) || 0;
    const weaponName = weapon.name || "Weapon";
    const weaponTier = weapon.system?.tier || "Medium";

    const ammoState = this._getWeaponAmmoState(weapon);

    if (!this._validateWeaponAmmoState(weapon, ammoState)) return;

    // 0 dice is allowed here and resolves as an automatic miss (0 successes).
    // This ensures one-shot bonuses/penalties are still consumed cleanly.

    if (baseDamage <= 0) {
      ui.notifications.warn(`${weaponName}: base damage dice must be at least 1.`);
      return;
    }

    const targets = Array.from(game.user.targets);

    if (targets.length === 0) {
      ui.notifications.warn(`No target selected for ${weaponName}.`);
      return;
    }

    const targetToken = targets[0];
    const targetActor = targetToken.actor;

    if (!targetActor) {
      ui.notifications.warn("Target has no actor.");
      return;
    }

    if (ammoState.usesAmmo) {
      if (ammoState.ammo <= 0) {
        ui.notifications.warn(`${weaponName} is out of ammo.`);
        return;
      }

      await weapon.update({
        "system.ammo": ammoState.ammo - 1
      });
    }

    const attackResult = await this._rollVisibleDicePool(attackPool);
    if (bonusDice > 0 || penaltyDice > 0 || aimDice > 0) {
      await this._consumePendingAttackEffects(this.actor, rollData);
    }
    const attackDiceHtml = this._buildDiceHtml(attackResult.dieResults, true);
    const outcome = this._getAttackOutcome(attackResult.successes);
    const outcomeClass = this._getOutcomeClass(attackResult.successes);

    let content = `
      <div class="dt-chat-card">
        <div class="dt-chat-header">
          <div class="dt-chat-title">${this.actor.name} → ${targetActor.name}</div>
          <div class="dt-chat-subtitle">${weaponName}</div>
        </div>
        <div class="dt-chat-body">

          <div class="dt-chat-section">
            <h4>Attack</h4>
            <div class="dt-chat-grid">
              <div class="dt-chat-line"><span class="dt-chat-small">Skill</span><br><span class="dt-chat-strong">${skillKey}</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Attack Pool</span><br><span class="dt-chat-strong">${attackPool}d6</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Successes</span><br><span class="dt-chat-strong">${attackResult.successes}</span></div>
              ${attackPool <= 0 ? `<div class="dt-chat-line"><span class="dt-chat-small">Result</span><br><span class="dt-chat-strong">Automatic Miss (0 dice)</span></div>` : ""}
              <div class="dt-chat-line"><span class="dt-chat-small">Weapon Tier</span><br><span class="dt-chat-strong">${weaponTier}</span></div>
              ${bonusDice > 0 ? `<div class="dt-chat-line"><span class="dt-chat-small">${pendingBonus.source}</span><br><span class="dt-chat-strong">+${bonusDice}d6</span></div>` : ""}
              ${aimDice > 0 ? `<div class="dt-chat-line"><span class="dt-chat-small">${pendingAim.source}</span><br><span class="dt-chat-strong">+${aimDice}d6</span></div>` : ""}
              ${penaltyDice > 0 ? `<div class="dt-chat-line"><span class="dt-chat-small">${pendingPenalty.source}</span><br><span class="dt-chat-strong">-${penaltyDice}d6</span></div>` : ""}
            </div>
            <div class="dt-chat-dice-row">${attackDiceHtml}</div>
            <div class="dt-chat-line dt-chat-line--compact">
              <span class="dt-chat-small">Outcome</span><br>
              <span class="dt-chat-outcome ${outcomeClass}">${outcome}</span>
            </div>
          </div>
    `;

    if (attackResult.successes >= 1) {
      const attackMods = this._getAttackDamageModifiers(attackResult.successes, baseDamage);
      const preDefenseDamageDice = attackMods.damageDice;

      const defenseData = this._getAdjustedDefenseRollData(targetActor);
      const defensePool = defenseData.totalDice;
      const defenseResult = await this._rollDicePool(defensePool);
      if (defenseData.bonusDice > 0 || defenseData.penaltyDice > 0 || defenseData.braceMultiplier > 1) {
        await this._consumePendingDefenseEffects(targetActor, defenseData);
      }
      const defenseDiceHtml = this._buildDiceHtml(defenseResult.dieResults, true);
      const cancelledDice = Math.min(defenseResult.successes, preDefenseDamageDice);
      const finalDamageDice = Math.max(0, preDefenseDamageDice - cancelledDice);

      const damageRoll = await this._rollDamageDice(finalDamageDice);
      const damageDiceHtml = this._buildDiceHtml(damageRoll.dieResults, false);

      const armorTier = targetActor.system.armor?.tier || "Medium";
      const tierMultiplier = this._getTierMultiplier(weaponTier, armorTier);
      const tierLabel = this._getTierInteractionLabel(weaponTier, armorTier);
      const scaledDamage = Math.floor(damageRoll.total * attackMods.multiplier * tierMultiplier);

      const applicationResult = await this._applyDamageToActor(targetActor, scaledDamage);

      content += `
          <div class="dt-chat-section">
            <h4>Defense</h4>
            <div class="dt-chat-grid">
              <div class="dt-chat-line"><span class="dt-chat-small">Defense Pool</span><br><span class="dt-chat-strong">${defensePool}d6</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Dice Cancelled</span><br><span class="dt-chat-strong">${cancelledDice}</span></div>
              ${defenseData.braceMultiplier > 1 ? `<div class="dt-chat-line"><span class="dt-chat-small">${defenseData.pendingBrace?.source || "Brace"}</span><br><span class="dt-chat-strong">x${defenseData.braceMultiplier}</span></div>` : ""}
            </div>
            <div class="dt-chat-dice-row">${defenseDiceHtml}</div>
            <div class="dt-chat-line dt-chat-line--compact"><span class="dt-chat-small">Defense Successes</span><br><span class="dt-chat-strong">${defenseResult.successes}</span></div>
          </div>

          <div class="dt-chat-section">
            <h4>Damage</h4>
            <div class="dt-chat-grid">
              <div class="dt-chat-line"><span class="dt-chat-small">Weapon</span><br><span class="dt-chat-strong">${weaponName}</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Base Damage</span><br><span class="dt-chat-strong">${baseDamage}d6</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Pre-Defense Dice</span><br><span class="dt-chat-strong">${preDefenseDamageDice}d6</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Final Damage Dice</span><br><span class="dt-chat-strong">${finalDamageDice}d6</span></div>
            </div>
            <div class="dt-chat-dice-row">${damageDiceHtml}</div>
            <div class="dt-chat-grid dt-chat-grid--compact">
              <div class="dt-chat-line"><span class="dt-chat-small">Raw Damage</span><br><span class="dt-chat-strong">${damageRoll.total}</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Attack Multiplier</span><br><span class="dt-chat-strong">x${attackMods.multiplier}</span></div>
            </div>
          </div>

          <div class="dt-chat-section">
            <h4>Tier Interaction</h4>
            <div class="dt-chat-grid">
              <div class="dt-chat-line"><span class="dt-chat-small">Weapon Tier</span><br><span class="dt-chat-strong">${weaponTier}</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Armor Tier</span><br><span class="dt-chat-strong">${armorTier}</span></div>
            </div>
            <div class="dt-chat-line dt-chat-line--compact"><span class="dt-chat-small">Result</span><br><span class="dt-chat-strong">${tierLabel}</span></div>
            <div class="dt-chat-line"><span class="dt-chat-small">Tier Multiplier</span><br><span class="dt-chat-strong">${this._formatMultiplier(tierMultiplier)}</span></div>
          </div>

          <div class="dt-chat-section">
            <h4>Applied Damage</h4>
            <div class="dt-chat-line"><span class="dt-chat-small">Final Applied Damage</span><br><span class="dt-chat-final">${scaledDamage}</span></div>
            <div class="dt-chat-grid dt-chat-grid--compact">
              <div class="dt-chat-line"><span class="dt-chat-small">Integrity Damage</span><br><span class="dt-chat-strong">${applicationResult.integrityDamage}</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Health Damage</span><br><span class="dt-chat-strong">${applicationResult.healthDamage}</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Remaining Integrity</span><br><span class="dt-chat-strong">${applicationResult.newIntegrity}</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Remaining Health</span><br><span class="dt-chat-strong">${applicationResult.newHealth}</span></div>
            </div>
          </div>
      `;
    } else {
      content += `
          <div class="dt-chat-section">
            <h4>Result</h4>
            <div class="dt-chat-line"><span class="dt-chat-small">Damage</span><br><span class="dt-chat-strong">No damage rolled.</span></div>
          </div>
      `;
    }

    content += `
        </div>
      </div>
    `;

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content
    });
  }

  async _onWeaponAoeAttack(weapon) {
    if (this._isSmokeWeapon(weapon)) {
      await this._onWeaponSmokeAttack(weapon);
      return;
    }

    const aoeType = this._getAoeType(weapon.system);

    if (aoeType === "cone") {
      await this._onWeaponConeAttack(weapon);
      return;
    }

    await this._onWeaponBlastAttack(weapon);
  }


  async _onWeaponSmokeAttack(weapon) {
    const skillKey = weapon.system?.skill || "heavyWeapons";
    const rollData = this._getAdjustedAttackRollData(Number(this.actor.system.skills?.[skillKey]) || 0, this.actor);
    const baseAttackPool = rollData.baseDice;
    const pendingBonus = rollData.pendingBonus;
    const pendingPenalty = rollData.pendingPenalty;
    const pendingAim = rollData.pendingAim;
    const bonusDice = rollData.bonusDice;
    const penaltyDice = rollData.penaltyDice;
    const aimDice = rollData.aimDice;
    const attackPool = rollData.totalDice;
    const weaponName = weapon.name || "Smoke Grenade";
    const ammoState = this._getWeaponAmmoState(weapon);

    if (!this._validateWeaponAmmoState(weapon, ammoState)) return;

    // 0 dice is allowed here and resolves as an automatic miss (0 successes).
    // This ensures one-shot bonuses/penalties are still consumed cleanly.

    if (ammoState.usesAmmo && ammoState.ammo <= 0) {
      ui.notifications.warn(`${weaponName} is out of ammo.`);
      return;
    }

    const smokeDiameter = Math.max(1, this._getNumericValue(weapon.system?.smokeDiameter, 30));
    const smokeDurationRounds = Math.max(1, Math.floor(this._getNumericValue(weapon.system?.smokeDurationRounds, 3)));

    const point = await this._promptForCanvasPoint(`Click the ${weaponName} landing point on the map.`);
    if (!point) return;

    const attackResult = await this._rollVisibleDicePool(attackPool);
    await this._consumePendingAttackEffects(this.actor, rollData);

    const attackDiceHtml = this._buildDiceHtml(attackResult.dieResults, true);
    const hit = attackResult.successes >= 1;

    let finalPoint = point;
    let attackResultText = "MISS";
    let attackNote = "Missed aim point. Smoke scatters from the selected point.";
    let scatterHtml = "";

    if (!hit) {
      const scatterDirectionRoll = await (new Roll("1d8")).evaluate();
      const scatterDistanceRoll = await (new Roll("1d10 * 5")).evaluate();

      const direction = scatterDirectionRoll.total;
      const distanceFeet = scatterDistanceRoll.total;

      const angleMap = {
        1: 270,
        2: 315,
        3: 0,
        4: 45,
        5: 90,
        6: 135,
        7: 180,
        8: 225
      };

      const angleDeg = angleMap[direction] ?? 0;
      const angleRad = angleDeg * (Math.PI / 180);
      const pixelsPerFoot = canvas.dimensions.size / canvas.dimensions.distance;
      const scatterPixels = distanceFeet * pixelsPerFoot;

      finalPoint = {
        x: point.x + Math.cos(angleRad) * scatterPixels,
        y: point.y + Math.sin(angleRad) * scatterPixels
      };

      scatterHtml = `
        <div class="dt-chat-section">
          <h4>Scatter</h4>
          <div class="dt-chat-grid">
            <div class="dt-chat-line">
              <span class="dt-chat-small">Direction</span><br>
              <span class="dt-chat-strong">${direction}</span>
            </div>
            <div class="dt-chat-line">
              <span class="dt-chat-small">Distance</span><br>
              <span class="dt-chat-strong">${distanceFeet} ft</span>
            </div>
          </div>
        </div>
      `;
    } else {
      attackResultText = "HIT";
      attackNote = "Smoke lands on the selected point.";
    }

    if (ammoState.usesAmmo) {
      await weapon.update({
        "system.ammo": ammoState.ammo - 1
      });
    }

    const createdTemplate = await this._createSmokeTemplate(finalPoint, smokeDiameter, smokeDurationRounds);
    const ammoDisplay = this._formatWeaponAmmoDisplay(weapon);
    const smokeData = createdTemplate?.getFlag?.("drop-trooper", "smokeData") || createdTemplate?.flags?.["drop-trooper"]?.smokeData || {};
    const expirationText = smokeData?.combatId
      ? `Round ${smokeData.removeAtRound}`
      : "Manual delete if no combat is active";

    const content = `
      <div class="dt-chat-card">
        <div class="dt-chat-header">
          <div class="dt-chat-title">${this.actor.name}</div>
          <div class="dt-chat-subtitle">${weaponName} — Smoke Grenade</div>
        </div>
        <div class="dt-chat-body">

          <div class="dt-chat-section">
            <h4>Attack Roll</h4>
            <div class="dt-chat-grid">
              <div class="dt-chat-line"><span class="dt-chat-small">Skill</span><br><span class="dt-chat-strong">${skillKey}</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Base Pool</span><br><span class="dt-chat-strong">${baseAttackPool}d6</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Attack Pool</span><br><span class="dt-chat-strong">${attackPool}d6</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Successes</span><br><span class="dt-chat-strong">${attackResult.successes}</span></div>
              ${attackPool <= 0 ? `<div class="dt-chat-line"><span class="dt-chat-small">Result</span><br><span class="dt-chat-strong">Automatic Miss (0 dice)</span></div>` : ""}
              <div class="dt-chat-line"><span class="dt-chat-small">Ammo</span><br><span class="dt-chat-strong">${ammoDisplay}</span></div>
              ${bonusDice > 0 ? `<div class="dt-chat-line"><span class="dt-chat-small">${pendingBonus.source}</span><br><span class="dt-chat-strong">+${bonusDice}d6</span></div>` : ""}
              ${aimDice > 0 ? `<div class="dt-chat-line"><span class="dt-chat-small">${pendingAim.source}</span><br><span class="dt-chat-strong">+${aimDice}d6</span></div>` : ""}
              ${penaltyDice > 0 ? `<div class="dt-chat-line"><span class="dt-chat-small">${pendingPenalty.source}</span><br><span class="dt-chat-strong">-${penaltyDice}d6</span></div>` : ""}
            </div>
            <div class="dt-chat-dice-row">${attackDiceHtml}</div>
            <div class="dt-chat-line dt-chat-line--compact"><span class="dt-chat-small">Result</span><br><span class="dt-chat-strong">${attackResultText}</span></div>
            <div class="dt-chat-line"><span class="dt-chat-small">Note</span><br><span class="dt-chat-strong">${attackNote}</span></div>
          </div>

          ${scatterHtml}

          <div class="dt-chat-section">
            <h4>Smoke Cloud</h4>
            <div class="dt-chat-grid">
              <div class="dt-chat-line"><span class="dt-chat-small">Diameter</span><br><span class="dt-chat-strong">${smokeDiameter} ft</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Radius</span><br><span class="dt-chat-strong">${smokeDiameter / 2} ft</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Duration</span><br><span class="dt-chat-strong">${smokeDurationRounds} round${smokeDurationRounds === 1 ? "" : "s"}</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Expires</span><br><span class="dt-chat-strong">${expirationText}</span></div>
            </div>
            <div class="dt-chat-line"><span class="dt-chat-small">GM Control</span><br><span class="dt-chat-strong">The measured template can be grabbed and deleted manually.</span></div>
          </div>

        </div>
      </div>
    `;

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content
    });
  }

  async _onWeaponBlastAttack(weapon) {
    const skillKey = weapon.system?.skill || "heavyWeapons";
    const rollData = this._getAdjustedAttackRollData(Number(this.actor.system.skills?.[skillKey]) || 0, this.actor);
    const baseAttackPool = rollData.baseDice;
    const pendingBonus = rollData.pendingBonus;
    const pendingPenalty = rollData.pendingPenalty;
    const pendingAim = rollData.pendingAim;
    const bonusDice = rollData.bonusDice;
    const penaltyDice = rollData.penaltyDice;
    const aimDice = rollData.aimDice;
    const attackPool = rollData.totalDice;
    const weaponTier = weapon.system?.tier || "Medium";
    const weaponName = weapon.name || "AOE Weapon";
    const ammoState = this._getWeaponAmmoState(weapon);

    if (!this._validateWeaponAmmoState(weapon, ammoState)) return;

    // 0 dice is allowed here and resolves as an automatic miss (0 successes).
    // This ensures one-shot bonuses/penalties are still consumed cleanly.

    if (ammoState.usesAmmo && ammoState.ammo <= 0) {
      ui.notifications.warn(`${weaponName} is out of ammo.`);
      return;
    }

    const blastRadius = this._getNumericValue(weapon.system?.blastRadius, 100);
    const killRadius = this._getNumericValue(weapon.system?.killRadius, 30);
    const heavyRadius = this._getNumericValue(weapon.system?.heavyRadius, 60);
    const fragRadius = this._getNumericValue(weapon.system?.fragRadius, 100);
    const killDamage = this._getNumericValue(weapon.system?.killDamage, 6);
    const heavyDamage = this._getNumericValue(weapon.system?.heavyDamage, 4);
    const fragDamage = this._getNumericValue(weapon.system?.fragDamage, 2);

    const point = await this._promptForCanvasPoint(`Click the ${weaponName} impact point on the map.`);
    if (!point) return;

    const attackResult = await this._rollVisibleDicePool(attackPool);
    if (bonusDice > 0 || penaltyDice > 0) {
      await this._consumePendingRollModifiers(this.actor, rollData);
    }
    const attackDiceHtml = this._buildDiceHtml(attackResult.dieResults, true);
    const hit = attackResult.successes >= 1;

    let finalPoint = point;
    let attackResultText = "MISS";
    let attackNote = "Missed aim point. Scatter applied.";
    let scatterHtml = "";

    if (!hit) {
      const scatterDirectionRoll = await (new Roll("1d8")).evaluate();
      const scatterDistanceRoll = await (new Roll("1d10 * 5")).evaluate();

      const direction = scatterDirectionRoll.total;
      const distanceFeet = scatterDistanceRoll.total;

      const angleMap = {
        1: 270,
        2: 315,
        3: 0,
        4: 45,
        5: 90,
        6: 135,
        7: 180,
        8: 225
      };

      const angleDeg = angleMap[direction] ?? 0;
      const angleRad = angleDeg * (Math.PI / 180);
      const pixelsPerFoot = canvas.dimensions.size / canvas.dimensions.distance;
      const scatterPixels = distanceFeet * pixelsPerFoot;

      finalPoint = {
        x: point.x + Math.cos(angleRad) * scatterPixels,
        y: point.y + Math.sin(angleRad) * scatterPixels
      };

      scatterHtml = `
        <div class="dt-chat-section">
          <h4>Scatter</h4>
          <div class="dt-chat-grid">
            <div class="dt-chat-line">
              <span class="dt-chat-small">Direction</span><br>
              <span class="dt-chat-strong">${direction}</span>
            </div>
            <div class="dt-chat-line">
              <span class="dt-chat-small">Distance</span><br>
              <span class="dt-chat-strong">${distanceFeet} ft</span>
            </div>
          </div>
        </div>
      `;
    } else {
      attackResultText = "HIT";
      attackNote = "Hit aim point. Blast centered on clicked location.";
    }

    if (ammoState.usesAmmo) {
      await weapon.update({
        "system.ammo": ammoState.ammo - 1
      });
    }

    await this._createBlastTemplate(finalPoint, blastRadius);

    const zones = this._getBlastZones(finalPoint, killRadius, heavyRadius, fragRadius);
    const killResolutionHtml = await this._resolveBlastEntries(zones.kill, "Kill Zone", killDamage, weaponTier);
    const heavyResolutionHtml = await this._resolveBlastEntries(zones.heavy, "Heavy Splash", heavyDamage, weaponTier);
    const fragResolutionHtml = await this._resolveBlastEntries(zones.frag, "Fragmentation", fragDamage, weaponTier);
    const ammoDisplay = this._formatWeaponAmmoDisplay(weapon);

    const content = `
      <div class="dt-chat-card">
        <div class="dt-chat-header">
          <div class="dt-chat-title">${this.actor.name}</div>
          <div class="dt-chat-subtitle">${weaponName} — Blast AOE</div>
        </div>
        <div class="dt-chat-body">

          <div class="dt-chat-section">
            <h4>Attack Roll</h4>
            <div class="dt-chat-grid">
              <div class="dt-chat-line"><span class="dt-chat-small">Skill</span><br><span class="dt-chat-strong">${skillKey}</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Attack Pool</span><br><span class="dt-chat-strong">${attackPool}d6</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Successes</span><br><span class="dt-chat-strong">${attackResult.successes}</span></div>
              ${attackPool <= 0 ? `<div class="dt-chat-line"><span class="dt-chat-small">Result</span><br><span class="dt-chat-strong">Automatic Miss (0 dice)</span></div>` : ""}
              <div class="dt-chat-line"><span class="dt-chat-small">Ammo</span><br><span class="dt-chat-strong">${ammoDisplay}</span></div>
              ${bonusDice > 0 ? `<div class="dt-chat-line"><span class="dt-chat-small">${pendingBonus.source}</span><br><span class="dt-chat-strong">+${bonusDice}d6</span></div>` : ""}
              ${aimDice > 0 ? `<div class="dt-chat-line"><span class="dt-chat-small">${pendingAim.source}</span><br><span class="dt-chat-strong">+${aimDice}d6</span></div>` : ""}
              ${penaltyDice > 0 ? `<div class="dt-chat-line"><span class="dt-chat-small">${pendingPenalty.source}</span><br><span class="dt-chat-strong">-${penaltyDice}d6</span></div>` : ""}
            </div>
            <div class="dt-chat-dice-row">${attackDiceHtml}</div>
            <div class="dt-chat-line dt-chat-line--compact"><span class="dt-chat-small">Result</span><br><span class="dt-chat-strong">${attackResultText}</span></div>
            <div class="dt-chat-line"><span class="dt-chat-small">Note</span><br><span class="dt-chat-strong">${attackNote}</span></div>
            <div class="dt-chat-line"><span class="dt-chat-small">Weapon Tier Used</span><br><span class="dt-chat-strong">${weaponTier}</span></div>
          </div>

          ${scatterHtml}

          <div class="dt-chat-section">
            <h4>Zone Profile</h4>
            <div class="dt-chat-grid">
              <div class="dt-chat-line"><span class="dt-chat-small">Blast Radius</span><br><span class="dt-chat-strong">${blastRadius} ft</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Kill Zone</span><br><span class="dt-chat-strong">${killDamage}d6</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Heavy Splash</span><br><span class="dt-chat-strong">${heavyDamage}d6</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Fragmentation</span><br><span class="dt-chat-strong">${fragDamage}d6</span></div>
            </div>
          </div>

          <div class="dt-chat-section">
            <div class="dt-chat-line"><span class="dt-chat-small">Kill Zone</span><br><span class="dt-chat-strong">0–${killRadius} ft</span></div>
            ${this._formatBlastZoneList(zones.kill)}
          </div>

          <div class="dt-chat-section">
            <div class="dt-chat-line"><span class="dt-chat-small">Heavy Splash</span><br><span class="dt-chat-strong">${this._formatRangeBand(killRadius, heavyRadius)}</span></div>
            ${this._formatBlastZoneList(zones.heavy)}
          </div>

          <div class="dt-chat-section">
            <div class="dt-chat-line"><span class="dt-chat-small">Fragmentation</span><br><span class="dt-chat-strong">${this._formatRangeBand(heavyRadius, fragRadius)}</span></div>
            ${this._formatBlastZoneList(zones.frag)}
          </div>

          ${killResolutionHtml}
          ${heavyResolutionHtml}
          ${fragResolutionHtml}

        </div>
      </div>
    `;

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content
    });
  }

  async _onWeaponConeAttack(weapon) {
    const skillKey = weapon.system?.skill || "shooting";
    const rollData = this._getAdjustedAttackRollData(Number(this.actor.system.skills?.[skillKey]) || 0, this.actor);
    const baseAttackPool = rollData.baseDice;
    const pendingBonus = rollData.pendingBonus;
    const pendingPenalty = rollData.pendingPenalty;
    const pendingAim = rollData.pendingAim;
    const bonusDice = rollData.bonusDice;
    const penaltyDice = rollData.penaltyDice;
    const aimDice = rollData.aimDice;
    const attackPool = rollData.totalDice;
    const weaponTier = weapon.system?.tier || "Medium";
    const weaponName = weapon.name || "Cone Weapon";
    const ammoState = this._getWeaponAmmoState(weapon);

    if (!this._validateWeaponAmmoState(weapon, ammoState)) return;

    // 0 dice is allowed here and resolves as an automatic miss (0 successes).
    // This ensures one-shot bonuses/penalties are still consumed cleanly.

    if (ammoState.usesAmmo && ammoState.ammo <= 0) {
      ui.notifications.warn(`${weaponName} is out of ammo.`);
      return;
    }

    const sourceToken = this._getActorTokenOnCanvas();
    if (!sourceToken) {
      ui.notifications.warn(`${weaponName}: place or select this actor's token on the scene before using a cone attack.`);
      return;
    }

    const coneKillConfigured = weapon.system?.coneKillRange;
    const coneHeavyConfigured = weapon.system?.coneHeavyRange;
    const coneFragConfigured = weapon.system?.coneFragRange;

    const fallbackConeKill = this._getNumericValue(weapon.system?.killRadius, 0);
    const fallbackConeHeavy = this._getNumericValue(weapon.system?.heavyRadius, 0);
    const fallbackConeFrag = this._getNumericValue(weapon.system?.fragRadius, 0);

    const killRange = this._getNumericValue(
      coneKillConfigured,
      fallbackConeKill > 0 ? fallbackConeKill : 0
    );
    const heavyRange = this._getNumericValue(
      coneHeavyConfigured,
      fallbackConeHeavy > 0 ? fallbackConeHeavy : 0
    );
    const fragRange = this._getNumericValue(
      coneFragConfigured,
      fallbackConeFrag > 0 ? fallbackConeFrag : 0
    );

    const coneRange = this._getNumericValue(
      weapon.system?.coneRange,
      Math.max(fragRange, heavyRange, killRange)
    );
    const coneAngle = this._getNumericValue(weapon.system?.coneAngle, 60);
    const killDamage = this._getNumericValue(weapon.system?.killDamage, 6);
    const heavyDamage = this._getNumericValue(weapon.system?.heavyDamage, 4);
    const fragDamage = this._getNumericValue(weapon.system?.fragDamage, 2);

    if (coneRange <= 0) {
      ui.notifications.warn(`${weaponName}: cone range must be greater than 0.`);
      return;
    }

    const aimPoint = await this._promptForCanvasPoint(`Click a point to aim the ${weaponName} cone.`);
    if (!aimPoint) return;

    const sourcePoint = sourceToken.center;
    const aimedDirection = this._getPointDirectionDegrees(sourcePoint, aimPoint);

    const attackResult = await this._rollVisibleDicePool(attackPool);
    if (bonusDice > 0 || penaltyDice > 0 || aimDice > 0) {
      await this._consumePendingAttackEffects(this.actor, rollData);
    }
    const attackDiceHtml = this._buildDiceHtml(attackResult.dieResults, true);

    let finalDirection = aimedDirection;
    let attackResultText = attackResult.successes >= 1 ? "HIT" : "MISS";
    let attackNote = attackResult.successes >= 1
      ? "Cone fired in the aimed direction."
      : "Cone missed its aim and drifted 15° off target.";
    let scatterHtml = "";

    if (attackResult.successes <= 0) {
      const scatterSign = Math.random() < 0.5 ? -1 : 1;
      finalDirection = this._normalizeDirection(aimedDirection + (15 * scatterSign));
      scatterHtml = `
        <div class="dt-chat-section">
          <h4>Scatter</h4>
          <div class="dt-chat-grid">
            <div class="dt-chat-line"><span class="dt-chat-small">Aim</span><br><span class="dt-chat-strong">${Math.round(aimedDirection)}°</span></div>
            <div class="dt-chat-line"><span class="dt-chat-small">Final</span><br><span class="dt-chat-strong">${Math.round(finalDirection)}°</span></div>
            <div class="dt-chat-line"><span class="dt-chat-small">Shift</span><br><span class="dt-chat-strong">${scatterSign < 0 ? "15° left" : "15° right"}</span></div>
          </div>
        </div>
      `;
    }

    if (ammoState.usesAmmo) {
      await weapon.update({
        "system.ammo": ammoState.ammo - 1
      });
    }

    await this._createConeTemplate(sourcePoint, finalDirection, coneRange, coneAngle);

    const zones = this._getConeZones(sourceToken, finalDirection, coneAngle, killRange, heavyRange, fragRange, coneRange);
    const killResolutionHtml = await this._resolveBlastEntries(zones.kill, "Kill Zone", killDamage, weaponTier);
    const heavyResolutionHtml = await this._resolveBlastEntries(zones.heavy, "Heavy Splash", heavyDamage, weaponTier);
    const fragResolutionHtml = await this._resolveBlastEntries(zones.frag, "Fragmentation", fragDamage, weaponTier);
    const ammoDisplay = this._formatWeaponAmmoDisplay(weapon);

    const content = `
      <div class="dt-chat-card">
        <div class="dt-chat-header">
          <div class="dt-chat-title">${this.actor.name}</div>
          <div class="dt-chat-subtitle">${weaponName} — Cone AOE</div>
        </div>
        <div class="dt-chat-body">

          <div class="dt-chat-section">
            <h4>Attack Roll</h4>
            <div class="dt-chat-grid">
              <div class="dt-chat-line"><span class="dt-chat-small">Skill</span><br><span class="dt-chat-strong">${skillKey}</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Attack Pool</span><br><span class="dt-chat-strong">${attackPool}d6</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Successes</span><br><span class="dt-chat-strong">${attackResult.successes}</span></div>
              ${attackPool <= 0 ? `<div class="dt-chat-line"><span class="dt-chat-small">Result</span><br><span class="dt-chat-strong">Automatic Miss (0 dice)</span></div>` : ""}
              <div class="dt-chat-line"><span class="dt-chat-small">Ammo</span><br><span class="dt-chat-strong">${ammoDisplay}</span></div>
              ${bonusDice > 0 ? `<div class="dt-chat-line"><span class="dt-chat-small">${pendingBonus.source}</span><br><span class="dt-chat-strong">+${bonusDice}d6</span></div>` : ""}
            </div>
            <div class="dt-chat-dice-row">${attackDiceHtml}</div>
            <div class="dt-chat-line dt-chat-line--compact"><span class="dt-chat-small">Result</span><br><span class="dt-chat-strong">${attackResultText}</span></div>
            <div class="dt-chat-line"><span class="dt-chat-small">Note</span><br><span class="dt-chat-strong">${attackNote}</span></div>
            <div class="dt-chat-line"><span class="dt-chat-small">Weapon Tier Used</span><br><span class="dt-chat-strong">${weaponTier}</span></div>
          </div>

          ${scatterHtml}

          <div class="dt-chat-section">
            <h4>Cone Profile</h4>
            <div class="dt-chat-grid">
              <div class="dt-chat-line"><span class="dt-chat-small">Range</span><br><span class="dt-chat-strong">${coneRange} ft</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Angle</span><br><span class="dt-chat-strong">${coneAngle}°</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Aim</span><br><span class="dt-chat-strong">${Math.round(aimedDirection)}°</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Final</span><br><span class="dt-chat-strong">${Math.round(finalDirection)}°</span></div>
            </div>
          </div>

          <div class="dt-chat-section">
            <h4>Zone Profile</h4>
            <div class="dt-chat-grid">
              <div class="dt-chat-line"><span class="dt-chat-small">Kill Zone</span><br><span class="dt-chat-strong">${killDamage}d6</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Heavy Splash</span><br><span class="dt-chat-strong">${heavyDamage}d6</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Fragmentation</span><br><span class="dt-chat-strong">${fragDamage}d6</span></div>
            </div>
          </div>

          <div class="dt-chat-section">
            <div class="dt-chat-line"><span class="dt-chat-small">Kill Zone</span><br><span class="dt-chat-strong">0–${killRange} ft</span></div>
            ${this._formatBlastZoneList(zones.kill)}
          </div>

          <div class="dt-chat-section">
            <div class="dt-chat-line"><span class="dt-chat-small">Heavy Splash</span><br><span class="dt-chat-strong">${this._formatRangeBand(killRange, heavyRange)}</span></div>
            ${this._formatBlastZoneList(zones.heavy)}
          </div>

          <div class="dt-chat-section">
            <div class="dt-chat-line"><span class="dt-chat-small">Fragmentation</span><br><span class="dt-chat-strong">${this._formatRangeBand(heavyRange, fragRange)}</span></div>
            ${this._formatBlastZoneList(zones.frag)}
          </div>

          ${killResolutionHtml}
          ${heavyResolutionHtml}
          ${fragResolutionHtml}

        </div>
      </div>
    `;

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content
    });
  }

  async _onWeaponReload(event) {
    event.preventDefault();

    const itemId = event.currentTarget.dataset.itemId;
    const weapon = this.actor.items.get(itemId);

    if (!weapon) {
      ui.notifications.warn("Weapon not found.");
      return;
    }

    const weaponName = weapon.name || "Weapon";
    const ammoState = this._getWeaponAmmoState(weapon);

    if (!ammoState.usesAmmo) {
      ui.notifications.info(`${weaponName} does not use ammo.`);
      return;
    }

    if (!this._validateWeaponAmmoState(weapon, ammoState)) return;

    if (ammoState.ammo >= ammoState.magSize) {
      ui.notifications.info(`${weaponName} is already fully loaded.`);
      return;
    }

    if (ammoState.spareAmmo <= 0) {
      ui.notifications.warn(`${weaponName} has no spare ammo left.`);
      return;
    }

    const needed = Math.max(0, ammoState.magSize - ammoState.ammo);
    const roundsLoaded = Math.min(needed, ammoState.spareAmmo);
    const newAmmo = ammoState.ammo + roundsLoaded;
    const newSpareAmmo = ammoState.spareAmmo - roundsLoaded;

    await weapon.update({
      "system.ammo": newAmmo,
      "system.ammoMax": newSpareAmmo
    });

    ui.notifications.info(`${weaponName} reloaded ${roundsLoaded} round${roundsLoaded === 1 ? "" : "s"}.`);
  }

  async _onWeaponCreate(event) {
    event.preventDefault();

    const created = await this.actor.createEmbeddedDocuments("Item", [{
      name: "New Weapon",
      type: "weapon"
    }]);

    if (created?.length) {
      created[0].sheet.render(true);
    }
  }

  async _onNpcBlueprintExport(event) {
    event.preventDefault();
    await exportDropTrooperNpcBlueprint(this.actor);
  }

  async _onWeaponEdit(event) {
    event.preventDefault();

    const itemId = event.currentTarget.dataset.itemId;
    const item = this.actor.items.get(itemId);

    if (!item) {
      ui.notifications.warn("Weapon not found.");
      return;
    }

    item.sheet.render(true);
  }

  async _onWeaponDelete(event) {
    event.preventDefault();

    const itemId = event.currentTarget.dataset.itemId;
    const item = this.actor.items.get(itemId);

    if (!item) return;

    const confirmed = await Dialog.confirm({
      title: "Delete Weapon",
      content: `<p>Delete <strong>${item.name}</strong> from ${this.actor.name}?</p>`
    });

    if (!confirmed) return;

    await item.delete();
  }

  async _onAbilityCreate(event) {
    event.preventDefault();

    const created = await this.actor.createEmbeddedDocuments("Item", [{
      name: "New Ability",
      type: "ability"
    }]);

    if (created?.length) {
      created[0].sheet.render(true);
    }
  }

  async _onAbilityUse(event) {
    event.preventDefault();

    const itemId = event.currentTarget.dataset.itemId;
    const ability = this.actor.items.get(itemId);

    if (!ability) {
      ui.notifications.warn("Ability not found.");
      return;
    }

    if (ability.system?.specialType === "commandDice") {
      await this._useCommandDiceAbility(ability);
      return;
    }

    if (ability.system?.specialType === "repairKit") {
      await this._useRepairKitAbility(ability);
      return;
    }

    if (ability.system?.specialType === "sensorSweep") {
      await this._useSensorSweepAbility(ability);
      return;
    }

    if (ability.system?.specialType === "flightPack") {
      await this._useFlightAbility(ability);
      return;
    }

    await this._useSkillAbility(ability);
  }

  async _useSkillAbility(ability) {
    const skillKey = ability.system?.linkedSkill || "tech";
    const skillDice = Number(this.actor.system.skills?.[skillKey]) || 0;
    const rollData = this._getAdjustedRollData(skillDice, this.actor);
    const baseDice = rollData.baseDice;
    const flatBonus = Number(ability.system?.bonusDice) || 0;
    const pendingBonus = rollData.pendingBonus;
    const pendingPenalty = rollData.pendingPenalty;
    const bonusDice = rollData.bonusDice;
    const penaltyDice = rollData.penaltyDice;
    const totalDice = Math.max(0, rollData.totalDice + flatBonus);
    const label = ability.name || "Ability";

    // 0 dice is allowed here and resolves as an automatic fail (0 successes).

    const result = await this._rollVisibleDicePool(totalDice);
    if (bonusDice > 0 || penaltyDice > 0) {
      await this._consumePendingRollModifiers(this.actor, rollData);
    }
    const diceHtml = this._buildDiceHtml(result.dieResults, true);
    const linkedSkillLabel = this._getSkillLabel(skillKey);

    const content = `
      <div class="dt-chat-card">
        <div class="dt-chat-header">
          <div class="dt-chat-title">${this.actor.name}</div>
          <div class="dt-chat-subtitle">${label}</div>
        </div>
        <div class="dt-chat-body">
          <div class="dt-chat-section">
            <div class="dt-chat-grid">
              <div class="dt-chat-line"><span class="dt-chat-small">Linked Skill</span><br><span class="dt-chat-strong">${linkedSkillLabel}</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Dice Rolled</span><br><span class="dt-chat-strong">${totalDice}d6</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Base Dice</span><br><span class="dt-chat-strong">${baseDice}d6</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Ability Bonus</span><br><span class="dt-chat-strong">+${flatBonus}d6</span></div>
              ${bonusDice > 0 ? `<div class="dt-chat-line"><span class="dt-chat-small">${pendingBonus.source}</span><br><span class="dt-chat-strong">+${bonusDice}d6</span></div>` : ""}
              ${penaltyDice > 0 ? `<div class="dt-chat-line"><span class="dt-chat-small">${pendingPenalty.source}</span><br><span class="dt-chat-strong">-${penaltyDice}d6</span></div>` : ""}
              <div class="dt-chat-line"><span class="dt-chat-small">Successes</span><br><span class="dt-chat-strong">${result.successes}</span></div>
            </div>
            <div class="dt-chat-dice-row">${diceHtml}</div>
            ${ability.system?.notes ? `<div class="dt-chat-line dt-chat-line--compact"><span class="dt-chat-small">Notes</span><br><span class="dt-chat-strong">${ability.system.notes}</span></div>` : ""}
          </div>
        </div>
      </div>
    `;

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content
    });
  }

  async _useRepairKitAbility(ability) {
    const abilityName = ability.name || "Repair Kit";
    const skillKey = ability.system?.linkedSkill || "tech";
    const flatBonus = Number(ability.system?.bonusDice) || 0;
    const skillDice = Number(this.actor.system.skills?.[skillKey]) || 0;
    const rollData = this._getAdjustedRollData(skillDice, this.actor);
    const pendingBonus = rollData.pendingBonus;
    const pendingPenalty = rollData.pendingPenalty;
    const bonusDice = rollData.bonusDice;
    const penaltyDice = rollData.penaltyDice;
    const poolCurrent = Number(ability.system?.pool?.value) || 0;
    const poolMax = Number(ability.system?.pool?.max) || 0;

    if (poolMax > 0 && poolCurrent <= 0) {
      ui.notifications.warn(`${abilityName} has no uses remaining.`);
      return;
    }

    const targets = Array.from(game.user.targets);
    const targetToken = targets[0] || this._getActorTokenOnCanvas();
    const targetActor = targetToken?.actor || this.actor;

    if (!targetActor) {
      ui.notifications.warn(`${abilityName}: no valid target found.`);
      return;
    }

    const integrityData = targetActor.system?.armor?.integrity;
    if (!integrityData) {
      ui.notifications.warn(`${abilityName}: target has no armor integrity.`);
      return;
    }

    const integrityCurrent = Number(integrityData.value) || 0;
    const integrityMax = Number(integrityData.max) || 0;

    if (integrityCurrent >= integrityMax) {
      ui.notifications.info(`${targetActor.name} is already at full integrity.`);
      return;
    }

    const totalDice = Math.max(0, rollData.totalDice + flatBonus);
    // 0 dice is allowed here and resolves as an automatic fail (0 successes).

    const skillResult = await this._rollVisibleDicePool(totalDice);
    if (bonusDice > 0 || penaltyDice > 0) {
      await this._consumePendingRollModifiers(this.actor, rollData);
    }
    const skillDiceHtml = this._buildDiceHtml(skillResult.dieResults, true);

    await this._showDice3D(`1d6`);
    const repairRoll = await this._rollDamageDice(1);
    const repairDiceHtml = this._buildDiceHtml(repairRoll.dieResults, false);

    const rawRepair = repairRoll.total + skillResult.successes;
    const appliedRepair = Math.min(rawRepair, Math.max(0, integrityMax - integrityCurrent));
    const newIntegrity = Math.min(integrityMax, integrityCurrent + appliedRepair);

    await targetActor.update({
      "system.armor.integrity.value": newIntegrity
    });

    if (poolMax > 0) {
      await ability.update({
        "system.pool.value": Math.max(0, poolCurrent - 1),
        "system.pool.max": poolMax
      });
    }

    const linkedSkillLabel = this._getSkillLabel(skillKey);
    const remainingUses = poolMax > 0 ? Math.max(0, poolCurrent - 1) : "—";

    const content = `
      <div class="dt-chat-card">
        <div class="dt-chat-header">
          <div class="dt-chat-title">${this.actor.name}</div>
          <div class="dt-chat-subtitle">${abilityName}</div>
        </div>
        <div class="dt-chat-body">
          <div class="dt-chat-section">
            <div class="dt-chat-grid">
              <div class="dt-chat-line"><span class="dt-chat-small">Target</span><br><span class="dt-chat-strong">${targetActor.name}</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Linked Skill</span><br><span class="dt-chat-strong">${linkedSkillLabel}</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Skill Dice</span><br><span class="dt-chat-strong">${totalDice}d6</span></div>
              ${bonusDice > 0 ? `<div class="dt-chat-line"><span class="dt-chat-small">${pendingBonus.source}</span><br><span class="dt-chat-strong">+${bonusDice}d6</span></div>` : ""}
              ${penaltyDice > 0 ? `<div class="dt-chat-line"><span class="dt-chat-small">${pendingPenalty.source}</span><br><span class="dt-chat-strong">-${penaltyDice}d6</span></div>` : ""}
              <div class="dt-chat-line"><span class="dt-chat-small">Successes</span><br><span class="dt-chat-strong">${skillResult.successes}</span></div>
            </div>
            <div class="dt-chat-dice-row">${skillDiceHtml}</div>
          </div>

          <div class="dt-chat-section">
            <div class="dt-chat-grid">
              <div class="dt-chat-line"><span class="dt-chat-small">Base Repair</span><br><span class="dt-chat-strong">${repairRoll.total}</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">+ Successes</span><br><span class="dt-chat-strong">+${skillResult.successes}</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Repair Applied</span><br><span class="dt-chat-final">${appliedRepair}</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Integrity</span><br><span class="dt-chat-strong">${integrityCurrent} → ${newIntegrity}</span></div>
            </div>
            <div class="dt-chat-dice-row">${repairDiceHtml}</div>
            ${poolMax > 0 ? `<div class="dt-chat-line dt-chat-line--compact"><span class="dt-chat-small">Uses Remaining</span><br><span class="dt-chat-strong">${remainingUses} / ${poolMax}</span></div>` : ""}
          </div>
        </div>
      </div>
    `;

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content
    });
  }


  _getActiveSmokeTemplates() {
    if (!canvas?.ready) return [];

    return (canvas.templates?.placeables || []).filter(template => {
      return !!template?.document?.getFlag("drop-trooper", "smokeData");
    });
  }

  _getPixelsPerDistanceUnit() {
    const gridDistance = Number(canvas?.scene?.grid?.distance) || Number(canvas?.grid?.distance) || 5;
    const gridSize = Number(canvas?.scene?.grid?.size) || Number(canvas?.grid?.size) || 100;
    return gridSize / gridDistance;
  }

  _distanceUnitsToPixels(distanceUnits) {
    return Math.max(0, Number(distanceUnits) || 0) * this._getPixelsPerDistanceUnit();
  }

  _isPointInsideSmoke(point) {
    if (!point) return false;

    const smokeTemplates = this._getActiveSmokeTemplates();
    if (!smokeTemplates.length) return false;

    return smokeTemplates.some(template => {
      const center = { x: Number(template.document?.x) || 0, y: Number(template.document?.y) || 0 };
      const radiusFeet = Number(template.document?.distance) || Number(template.document?.getFlag("drop-trooper", "smokeData")?.diameter) / 2 || 0;
      const radiusPx = this._distanceUnitsToPixels(radiusFeet);
      const dx = point.x - center.x;
      const dy = point.y - center.y;
      return ((dx * dx) + (dy * dy)) <= (radiusPx * radiusPx);
    });
  }

  _segmentIntersectsSmoke(startPoint, endPoint) {
    if (!startPoint || !endPoint) return false;

    const smokeTemplates = this._getActiveSmokeTemplates();
    if (!smokeTemplates.length) return false;

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
      const radiusPx = this._distanceUnitsToPixels(radiusFeet);

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

  _isSensorSweepBlockedBySmoke(sourceToken, targetToken) {
    if (!sourceToken?.center || !targetToken?.center) return false;
    if (!this._getActiveSmokeTemplates().length) return false;

    if (this._isPointInsideSmoke(sourceToken.center)) return true;
    if (this._isPointInsideSmoke(targetToken.center)) return true;
    return this._segmentIntersectsSmoke(sourceToken.center, targetToken.center);
  }

  _getSensorSweepTargets(sourceToken, rangeFeet) {
    if (!canvas?.ready || !sourceToken || rangeFeet <= 0) return [];
    if (this._isPointInsideSmoke(sourceToken.center)) return [];

    const targets = [];

    for (const token of canvas.tokens.placeables) {
      if (!token?.actor) continue;
      if (token.id === sourceToken.id) continue;

      const distance = canvas.grid.measureDistance(sourceToken.center, token.center);
      if (distance > rangeFeet) continue;
      if (this._isSensorSweepBlockedBySmoke(sourceToken, token)) continue;

      targets.push({
        token,
        distance,
        wasHidden: !!token.document?.hidden
      });
    }

    targets.sort((a, b) => a.distance - b.distance);
    return targets;
  }

  async _temporarilyRevealSensorSweepTargets(entries, durationMs = 1500) {
    const hiddenEntries = (entries || []).filter(entry => entry?.token?.document?.hidden);
    if (!hiddenEntries.length || !game.user?.isGM) return;

    const idsToReveal = hiddenEntries.map(entry => entry.token.id).filter(Boolean);
    if (!idsToReveal.length) return;

    try {
      await canvas.scene.updateEmbeddedDocuments("Token", idsToReveal.map(id => ({ _id: id, hidden: false })));
    } catch (err) {
      console.warn("Drop Trooper | Failed to reveal sensor sweep targets", err);
      return;
    }

    setTimeout(async () => {
      try {
        if (!canvas?.scene) return;
        const updates = idsToReveal.map(id => {
          const tokenDoc = canvas.scene.tokens.get(id);
          if (!tokenDoc || tokenDoc.hidden) return null;
          return { _id: id, hidden: true };
        }).filter(Boolean);

        if (updates.length) {
          await canvas.scene.updateEmbeddedDocuments("Token", updates);
        }
      } catch (err) {
        console.warn("Drop Trooper | Failed to restore hidden sensor sweep targets", err);
      }
    }, Math.max(250, Number(durationMs) || 1500));
  }

  async _showSensorSweepPings(entries, durationMs = 1500) {
    if (!canvas?.ready || !entries?.length) return;

    const container = new PIXI.Container();
    container.zIndex = 10000;
    canvas.stage.addChild(container);

    for (const entry of entries) {
      const graphics = new PIXI.Graphics();
      const x = entry.token.center.x;
      const y = entry.token.center.y;

      graphics.lineStyle(3, 0x66ffcc, 1);
      graphics.drawCircle(x, y, 24);
      graphics.lineStyle(2, 0x66ffcc, 0.9);
      graphics.moveTo(x - 34, y);
      graphics.lineTo(x - 14, y);
      graphics.moveTo(x + 14, y);
      graphics.lineTo(x + 34, y);
      graphics.moveTo(x, y - 34);
      graphics.lineTo(x, y - 14);
      graphics.moveTo(x, y + 14);
      graphics.lineTo(x, y + 34);
      container.addChild(graphics);
    }

    container.alpha = 1;

    setTimeout(() => {
      try {
        canvas.stage.removeChild(container);
        container.destroy({ children: true });
      } catch (err) {
        console.warn("Drop Trooper | Failed to remove sensor sweep pings", err);
      }
    }, durationMs);
  }

  async _useSensorSweepAbility(ability) {
    const abilityName = ability.name || "Sensor Sweep";
    const skillKey = ability.system?.linkedSkill || "sensors";
    const flatBonus = Number(ability.system?.bonusDice) || 0;
    const skillDice = Number(this.actor.system.skills?.[skillKey]) || 0;
    const rollData = this._getAdjustedRollData(skillDice, this.actor);
    const pendingBonus = rollData.pendingBonus;
    const pendingPenalty = rollData.pendingPenalty;
    const bonusDice = rollData.bonusDice;
    const penaltyDice = rollData.penaltyDice;
    const totalDice = Math.max(0, rollData.totalDice + flatBonus);
    const baseRange = this._getNumericValue(ability.system?.baseRange, 60);
    const rangePerSuccess = this._getNumericValue(ability.system?.rangePerSuccess, 30);
    const pingDurationMs = this._getNumericValue(ability.system?.pingDurationMs, 1500);
    const linkedSkillLabel = this._getSkillLabel(skillKey);
    const poolCurrent = Number(ability.system?.pool?.value) || 0;
    const poolMax = Number(ability.system?.pool?.max) || 0;

    if (poolMax > 0 && poolCurrent <= 0) {
      ui.notifications.warn(`${abilityName} has no uses remaining.`);
      return;
    }

    const sourceToken = this._getActorTokenOnCanvas();
    if (!sourceToken) {
      ui.notifications.warn(`${abilityName}: place or select this actor's token on the scene first.`);
      return;
    }

    const result = await this._rollVisibleDicePool(totalDice);
    const diceHtml = this._buildDiceHtml(result.dieResults, true);
    const totalRange = baseRange + (result.successes * rangePerSuccess);

    const smokeBlocked = this._isPointInsideSmoke(sourceToken.center);
    const detectedEntries = (result.successes <= 0 || smokeBlocked)
      ? []
      : this._getSensorSweepTargets(sourceToken, totalRange);

    if (poolMax > 0) {
      await ability.update({
        "system.pool.value": Math.max(0, poolCurrent - 1),
        "system.pool.max": poolMax
      });
    }

    await this._temporarilyRevealSensorSweepTargets(detectedEntries, pingDurationMs);
    await this._showSensorSweepPings(detectedEntries, pingDurationMs);

    const contactHtml = detectedEntries.length
      ? detectedEntries.map(entry => `
          <div class="dt-chat-line">
            <span class="dt-chat-strong">${entry.token.name}</span>
            <span class="dt-chat-small">(${Math.round(entry.distance)} ft${entry.wasHidden ? ", hidden" : ""})</span>
          </div>
        `).join("")
      : `<div class="dt-chat-small">${smokeBlocked ? "Sweep blocked by smoke." : "No contacts detected."}</div>`;

    const content = `
      <div class="dt-chat-card">
        <div class="dt-chat-header">
          <div class="dt-chat-title">${this.actor.name}</div>
          <div class="dt-chat-subtitle">${abilityName}</div>
        </div>
        <div class="dt-chat-body">
          <div class="dt-chat-section">
            <div class="dt-chat-grid">
              <div class="dt-chat-line"><span class="dt-chat-small">Linked Skill</span><br><span class="dt-chat-strong">${linkedSkillLabel}</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Dice Rolled</span><br><span class="dt-chat-strong">${totalDice}d6</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Base Range</span><br><span class="dt-chat-strong">${baseRange} ft</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Range / Success</span><br><span class="dt-chat-strong">+${rangePerSuccess} ft</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Successes</span><br><span class="dt-chat-strong">${result.successes}</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Final Range</span><br><span class="dt-chat-strong">${totalRange} ft</span></div>
              ${poolMax > 0 ? `<div class="dt-chat-line"><span class="dt-chat-small">Uses Remaining</span><br><span class="dt-chat-strong">${Math.max(0, poolCurrent - 1)} / ${poolMax}</span></div>` : ""}
            </div>
            <div class="dt-chat-dice-row">${diceHtml}</div>
          </div>

          <div class="dt-chat-section">
            <h4>Sensor Contacts</h4>
            <div class="dt-chat-line">
              <span class="dt-chat-small">Detection Rules</span><br>
              <span class="dt-chat-strong">Sweeps all tokens in range, ignores walls, blocked by smoke.</span>
            </div>
            <div class="dt-chat-line dt-chat-line--compact">
              <span class="dt-chat-small">Contacts Found</span><br>
              <span class="dt-chat-strong">${detectedEntries.length}</span>
            </div>
            <div class="dt-chat-dice-row">
              ${contactHtml}
            </div>
          </div>

          ${ability.system?.notes ? `
          <div class="dt-chat-section">
            <div class="dt-chat-line"><span class="dt-chat-small">Notes</span><br><span class="dt-chat-strong">${ability.system.notes}</span></div>
          </div>` : ""}
        </div>
      </div>
    `;

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content
    });
  }

  _getFlightMishapTable() {
    return [
      {
        label: "Overheat Warning",
        effect: "Jets sputter and cut out. Flight fails, the trooper stays grounded, and cannot use Flight again until next turn."
      },
      {
        label: "Spin Out",
        effect: "The suit yaws sideways. Drift 1d6 squares in a random direction, then land off-balance."
      },
      {
        label: "Hard Landing",
        effect: "The trooper gets airborne but crashes down early. Move only half distance, then lose 1 action next turn."
      },
      {
        label: "Thruster Flare",
        effect: "A bright exhaust bloom gives away the trooper's position. They are easy to spot until the end of the round."
      },
      {
        label: "Smoke Belch",
        effect: "The pack belches smoke and soot. Place a small smoke patch around the trooper until the end of the round."
      },
      {
        label: "Power Drain",
        effect: "The suit browns out. The trooper cannot Aim or Brace until next turn."
      },
      {
        label: "Wild Burst",
        effect: "The thrusters kick too hard. The trooper overshoots the landing point by a short distance and ends exposed."
      },
      {
        label: "Gyro Failure",
        effect: "The stabilizers glitch. The trooper lands where intended but ends prone or unstable."
      },
      {
        label: "Comms Screech",
        effect: "The suit screams static across local comms. Nearby allies are distracted, but nobody is harmed."
      },
      {
        label: "Control Lock",
        effect: "Flight fails completely. The trooper must manually reset the pack before trying again."
      }
    ];
  }

  async _rollFlightMishap() {
    const table = this._getFlightMishapTable();
    let total = 1;

    try {
      const roll = await new Roll(`1d10`).evaluate();
      total = Math.max(1, Math.min(10, Number(roll.total) || 1));

      if (game?.dice3d) {
        try {
          await game.dice3d.showForRoll(roll, game.user, true, null, false);
        } catch (err) {
          console.warn("Drop Trooper | Dice So Nice flight mishap roll failed", err);
        }
      }
    } catch (err) {
      console.warn("Drop Trooper | Flight mishap roll failed", err);
    }

    return {
      roll: total,
      ...table[total - 1]
    };
  }

  async _useFlightAbility(ability) {
    const abilityName = ability.name || "Flight";
    const skillKey = ability.system?.linkedSkill || "maneuvering";
    const flatBonus = Number(ability.system?.bonusDice) || 0;
    const skillDice = Number(this.actor.system.skills?.[skillKey]) || 0;
    const rollData = this._getAdjustedRollData(skillDice, this.actor);
    const baseDice = rollData.baseDice;
    const pendingBonus = rollData.pendingBonus;
    const pendingPenalty = rollData.pendingPenalty;
    const bonusDice = rollData.bonusDice;
    const penaltyDice = rollData.penaltyDice;
    const totalDice = Math.max(0, rollData.totalDice + flatBonus);
    const linkedSkillLabel = this._getSkillLabel(skillKey);
    const poolCurrent = Number(ability.system?.pool?.value) || 0;
    const poolMax = Number(ability.system?.pool?.max) || 0;

    if (poolMax > 0 && poolCurrent <= 0) {
      ui.notifications.warn(`${abilityName} has no uses remaining.`);
      return;
    }

    // 0 dice is allowed here and resolves as an automatic fail (0 successes).

    const result = await this._rollVisibleDicePool(totalDice);
    if (bonusDice > 0 || penaltyDice > 0) {
      await this._consumePendingRollModifiers(this.actor, rollData);
    }

    let remainingUses = poolCurrent;
    if (poolMax > 0) {
      remainingUses = Math.max(0, poolCurrent - 1);
      await ability.update({
        "system.pool.value": remainingUses,
        "system.pool.max": poolMax
      });
    }

    const diceHtml = this._buildDiceHtml(result.dieResults, true);
    const mishap = result.successes > 0 ? null : await this._rollFlightMishap();
    const outcomeTitle = mishap ? "Flight Mishap" : "Flight Stable";
    const outcomeText = mishap
      ? mishap.label
      : "Flight engages normally. Resolve movement on the scene as usual.";
    const effectText = mishap
      ? mishap.effect
      : "No mishap triggered.";

    const content = `
      <div class="dt-chat-card">
        <div class="dt-chat-header">
          <div class="dt-chat-title">${this.actor.name}</div>
          <div class="dt-chat-subtitle">${abilityName}</div>
        </div>
        <div class="dt-chat-body">
          <div class="dt-chat-section">
            <div class="dt-chat-grid">
              <div class="dt-chat-line"><span class="dt-chat-small">Linked Skill</span><br><span class="dt-chat-strong">${linkedSkillLabel}</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Dice Rolled</span><br><span class="dt-chat-strong">${totalDice}d6</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Base Dice</span><br><span class="dt-chat-strong">${baseDice}d6</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Ability Bonus</span><br><span class="dt-chat-strong">+${flatBonus}d6</span></div>
              ${bonusDice > 0 ? `<div class="dt-chat-line"><span class="dt-chat-small">${pendingBonus.source}</span><br><span class="dt-chat-strong">+${bonusDice}d6</span></div>` : ""}
              ${penaltyDice > 0 ? `<div class="dt-chat-line"><span class="dt-chat-small">${pendingPenalty.source}</span><br><span class="dt-chat-strong">-${penaltyDice}d6</span></div>` : ""}
              <div class="dt-chat-line"><span class="dt-chat-small">Successes</span><br><span class="dt-chat-strong">${result.successes}</span></div>
              ${poolMax > 0 ? `<div class="dt-chat-line"><span class="dt-chat-small">Uses Remaining</span><br><span class="dt-chat-strong">${remainingUses} / ${poolMax}</span></div>` : ""}
            </div>
            <div class="dt-chat-dice-row">${diceHtml}</div>
          </div>

          <div class="dt-chat-section">
            <h4>${outcomeTitle}</h4>
            <div class="dt-chat-line dt-chat-line--compact"><span class="dt-chat-small">Result</span><br><span class="dt-chat-strong">${outcomeText}</span></div>
            ${mishap ? `<div class="dt-chat-line"><span class="dt-chat-small">Mishap Roll</span><br><span class="dt-chat-strong">${mishap.roll} / 10</span></div>` : ""}
            <div class="dt-chat-line"><span class="dt-chat-small">Effect</span><br><span class="dt-chat-strong">${effectText}</span></div>
          </div>

          ${ability.system?.notes ? `
          <div class="dt-chat-section">
            <div class="dt-chat-line"><span class="dt-chat-small">Notes</span><br><span class="dt-chat-strong">${ability.system.notes}</span></div>
          </div>` : ""}
        </div>
      </div>
    `;

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content
    });
  }

  async _useCommandDiceAbility(ability) {
    const poolCurrent = Number(ability.system?.pool?.value) || 0;
    const poolMax = Number(ability.system?.pool?.max) || 0;
    const abilityName = ability.name || "Command Dice";

    if (poolCurrent <= 0) {
      ui.notifications.warn(`${abilityName} has no dice remaining.`);
      return;
    }

    const targetedTokens = Array.from(game.user?.targets || []).filter(token => token?.actor);
    if (targetedTokens.length !== 1) {
      ui.notifications.warn(`${abilityName}: target exactly 1 token first.`);
      return;
    }

    const targetToken = targetedTokens[0];
    const targetActor = targetToken.actor;
    if (!targetActor) {
      ui.notifications.warn(`${abilityName}: the targeted token does not have an actor.`);
      return;
    }

    const targetLabel = targetToken.name && targetToken.name !== targetActor.name
      ? `${targetToken.name} (${targetActor.name})`
      : (targetToken.name || targetActor.name || "Target");

    const dialogResult = await Dialog.wait({
      title: abilityName,
      content: `
        <form>
          <div class="form-group">
            <label>Target</label>
            <div><strong>${targetLabel}</strong></div>
          </div>
          <div class="form-group">
            <label>Dice to Spend (1-${poolCurrent})</label>
            <input type="number" name="spendDice" min="1" max="${poolCurrent}" value="1" />
          </div>
        </form>
      `,
      buttons: {
        use: {
          label: "Use",
          callback: (html) => {
            const spendDice = Number(html.find('[name="spendDice"]').val()) || 0;
            return { spendDice };
          }
        },
        cancel: {
          label: "Cancel",
          callback: () => null
        }
      },
      default: "use",
      close: () => null
    });

    if (!dialogResult) return;

    const spendDice = Number(dialogResult.spendDice) || 0;
    if (spendDice <= 0 || spendDice > poolCurrent) {
      ui.notifications.warn(`${abilityName}: choose a valid number of dice to spend.`);
      return;
    }

    const existingBonus = this._getPendingRollBonus(targetActor);
    const existingBonusDice = existingBonus?.dice || 0;
    const totalGrantedDice = existingBonusDice + spendDice;
    const existingSources = String(existingBonus?.source || "")
      .split("+")
      .map(part => part.trim())
      .filter(Boolean);
    const bonusSource = existingSources.includes(abilityName)
      ? existingSources.join(" + ") || abilityName
      : [...existingSources, abilityName].filter(Boolean).join(" + ") || abilityName;

    await this._setPendingRollBonus(targetActor, totalGrantedDice, bonusSource);
    await ability.update({
      "system.pool.value": poolCurrent - spendDice,
      "system.pool.max": poolMax
    });

    const content = `
      <div class="dt-chat-card">
        <div class="dt-chat-header">
          <div class="dt-chat-title">${this.actor.name}</div>
          <div class="dt-chat-subtitle">${abilityName}</div>
        </div>
        <div class="dt-chat-body">
          <div class="dt-chat-section">
            <div class="dt-chat-grid">
              <div class="dt-chat-line"><span class="dt-chat-small">Target</span><br><span class="dt-chat-strong">${targetLabel}</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Dice Spent</span><br><span class="dt-chat-strong">${spendDice}</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Dice Granted</span><br><span class="dt-chat-strong">+${spendDice}d6</span></div>
              ${existingBonusDice > 0 ? `<div class="dt-chat-line"><span class="dt-chat-small">Existing Bonus</span><br><span class="dt-chat-strong">+${existingBonusDice}d6</span></div>` : ""}
              <div class="dt-chat-line"><span class="dt-chat-small">Next Roll Bonus</span><br><span class="dt-chat-strong">+${totalGrantedDice}d6</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Pool Remaining</span><br><span class="dt-chat-strong">${poolCurrent - spendDice} / ${poolMax}</span></div>
            </div>
            <div class="dt-chat-line dt-chat-line--compact"><span class="dt-chat-small">Result</span><br><span class="dt-chat-strong">${targetLabel}'s next roll gains +${totalGrantedDice}d6. If that roll is an attack, the bonus applies to the attack roll only, not the damage roll.</span></div>
          </div>
        </div>
      </div>
    `;

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content
    });
  }

  async _onAbilityReset(event) {
    event.preventDefault();

    const itemId = event.currentTarget.dataset.itemId;
    const ability = this.actor.items.get(itemId);
    if (!ability) return;

    const max = Number(ability.system?.pool?.max) || 0;
    await ability.update({
      "system.pool.value": max
    });

    ui.notifications.info(`${ability.name} reset to ${max}.`);
  }

  async _onAbilityEdit(event) {
    event.preventDefault();

    const itemId = event.currentTarget.dataset.itemId;
    const ability = this.actor.items.get(itemId);

    if (!ability) {
      ui.notifications.warn("Ability not found.");
      return;
    }

    ability.sheet.render(true);
  }

  async _onAbilityDelete(event) {
    event.preventDefault();

    const itemId = event.currentTarget.dataset.itemId;
    const ability = this.actor.items.get(itemId);
    if (!ability) return;

    const confirmed = await Dialog.confirm({
      title: "Delete Ability",
      content: `<p>Delete <strong>${ability.name}</strong> from ${this.actor.name}?</p>`
    });

    if (!confirmed) return;

    await ability.delete();
  }


  async _onAim(event) {
    event.preventDefault();

    await this._setPendingAttackAim(this.actor, 2, "Aim");

    const content = `
      <div class="dt-chat-card">
        <div class="dt-chat-header">
          <div class="dt-chat-title">${this.actor.name}</div>
          <div class="dt-chat-subtitle">Aim</div>
        </div>
        <div class="dt-chat-body">
          <div class="dt-chat-section">
            <div class="dt-chat-grid">
              <div class="dt-chat-line">
                <span class="dt-chat-small">Next Attack Bonus</span><br>
                <span class="dt-chat-final">+2d6</span>
              </div>
            </div>
            <div class="dt-chat-line dt-chat-line--compact">
              <span class="dt-chat-small">Result</span><br>
              <span class="dt-chat-strong">Aim active: next attack roll gains +2 dice.</span>
            </div>
          </div>
        </div>
      </div>
    `;

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content
    });
  }

  async _onBrace(event) {
    event.preventDefault();

    const defensePool = Number(this.actor.system.skills?.defense) || 0;

    if (defensePool <= 0) {
      ui.notifications.warn(`${this.actor.name} has no Defense dice for Brace.`);
      return;
    }

    await this._setPendingDefenseBrace(this.actor, 2, "Brace");

    const content = `
      <div class="dt-chat-card">
        <div class="dt-chat-header">
          <div class="dt-chat-title">${this.actor.name}</div>
          <div class="dt-chat-subtitle">Brace</div>
        </div>
        <div class="dt-chat-body">
          <div class="dt-chat-section">
            <div class="dt-chat-grid">
              <div class="dt-chat-line">
                <span class="dt-chat-small">Current Defense</span><br>
                <span class="dt-chat-strong">${defensePool}d6</span>
              </div>
              <div class="dt-chat-line">
                <span class="dt-chat-small">Next Defense Roll</span><br>
                <span class="dt-chat-final">${defensePool * 2}d6</span>
              </div>
            </div>
            <div class="dt-chat-line dt-chat-line--compact">
              <span class="dt-chat-small">Result</span><br>
              <span class="dt-chat-strong">Brace active: next defense roll is doubled.</span>
            </div>
          </div>
        </div>
      </div>
    `;

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content
    });
  }

  async _onRollDefense(event) {
    const defenseData = this._getAdjustedDefenseRollData(this.actor);

    await this._rollPool("Defense", defenseData.totalDice, "defense", {
      baseDice: defenseData.baseDice,
      bonusDice: defenseData.bonusDice,
      penaltyDice: defenseData.penaltyDice,
      bonusSource: defenseData.pendingBonus?.source,
      penaltySource: defenseData.pendingPenalty?.source,
      defenseMultiplier: defenseData.braceMultiplier,
      defenseMultiplierSource: defenseData.pendingBrace?.source,
      preMultiplierDice: defenseData.preBraceDice,
      consumeBonus: defenseData.bonusDice > 0,
      consumePenalty: defenseData.penaltyDice > 0,
      consumeBrace: defenseData.braceMultiplier > 1
    });
  }

  async _onRollDamage(event) {
    const baseDamage = Number(this.actor.system.weapon?.baseDamage) || 0;

    if (baseDamage <= 0) {
      ui.notifications.warn("Base Damage Dice must be at least 1.");
      return;
    }

    const roll = await this._rollDamageDice(baseDamage);
    const diceHtml = this._buildDiceHtml(roll.dieResults, false);

    const content = `
      <div class="dt-chat-card">
        <div class="dt-chat-header">
          <div class="dt-chat-title">${this.actor.name}</div>
          <div class="dt-chat-subtitle">Manual Damage Roll</div>
        </div>
        <div class="dt-chat-body">
          <div class="dt-chat-section">
            <div class="dt-chat-grid">
              <div class="dt-chat-line"><span class="dt-chat-small">Weapon</span><br><span class="dt-chat-strong">${this.actor.system.weapon?.name || "Weapon"}</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Base Damage</span><br><span class="dt-chat-strong">${baseDamage}d6</span></div>
            </div>
            <div class="dt-chat-dice-row">${diceHtml}</div>
            <div class="dt-chat-line dt-chat-line--compact"><span class="dt-chat-small">Total Damage</span><br><span class="dt-chat-final">${roll.total}</span></div>
          </div>
        </div>
      </div>
    `;

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content
    });
  }

  async _onNanoRepair(event) {
    event.preventDefault();
    await AbilityService.nanoRepair(this.actor);
  }

}

class DropTrooperWeaponSheet extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["drop-trooper", "sheet", "item"],
      width: 600,
      height: 700,
      resizable: true
    });
  }

  get template() {
    if (this.item.type === "ability") {
      return "systems/drop-trooper/templates/actor/ability-sheet.hbs";
    }

    return "systems/drop-trooper/templates/actor/weapon-sheet.hbs";
  }

  getData() {
    const data = super.getData();
    data.system = this.item.system;
    return data;
  }
}



const DROP_TROOPER_NPC_BLUEPRINT_FLAG = "npcBlueprintMeta";
const DROP_TROOPER_NPC_IMPORT_COMMAND = "/dt-npc";
const DROP_TROOPER_NPC_EXPORT_COMMAND = "/dt-export-npc";

function escapeDropTrooperHtml(value) {
  return foundry.utils.escapeHTML(String(value ?? ""));
}

function normalizeDropTrooperString(value) {
  return String(value ?? "").trim();
}

function normalizeDropTrooperSkill(value, fallback = "shooting") {
  const raw = normalizeDropTrooperString(value).toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  const map = {
    shooting: "shooting",
    "heavy weapons": "heavyWeapons",
    heavyweapons: "heavyWeapons",
    melee: "melee",
    maneuvering: "maneuvering",
    recon: "recon",
    sensors: "sensors",
    electronics: "electronics",
    engineering: "engineering",
    "drone control": "droneControl",
    dronecontrol: "droneControl",
    command: "command",
    discipline: "discipline",
    survival: "survival",
    defense: "defense",
    strength: "strength",
    agility: "agility",
    perception: "perception",
    tech: "tech",
    will: "will"
  };

  return map[raw] || fallback;
}

function normalizeDropTrooperArmorTier(value, fallback = "Medium") {
  const raw = normalizeDropTrooperString(value).toLowerCase();
  const map = {
    light: "Light",
    medium: "Medium",
    heavy: "Heavy",
    ultra: "Ultra"
  };

  return map[raw] || fallback;
}

function normalizeDropTrooperTier(value, fallback = "Standard") {
  const raw = normalizeDropTrooperString(value);
  if (!raw) return fallback;
  return raw;
}

function normalizeDropTrooperAbilityType(value) {
  const raw = normalizeDropTrooperString(value).toLowerCase();
  return raw === "special" ? "special" : "skill";
}

function normalizeDropTrooperSpecialType(value) {
  const raw = normalizeDropTrooperString(value).toLowerCase();
  const map = {
    commanddice: "commandDice",
    repairkit: "repairKit",
    sensorsweep: "sensorSweep",
    flight: "flightPack",
    flightpack: "flightPack",
    none: "none",
    "": "none"
  };

  return map[raw.replace(/\s+/g, "")] || "none";
}

function parseDropTrooperMaybeNumber(value, fallback = 0) {
  const raw = normalizeDropTrooperString(value);
  if (!raw || raw === "-") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseDropTrooperMaybeAmmoValue(value) {
  const raw = normalizeDropTrooperString(value);
  if (!raw || raw === "-") return "";
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : "";
}

function parseDropTrooperPoolValue(value) {
  const raw = normalizeDropTrooperString(value);
  if (!raw || raw === "-") {
    return { value: 0, max: 0 };
  }

  const slashMatch = raw.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (slashMatch) {
    return {
      value: Number(slashMatch[1]) || 0,
      max: Number(slashMatch[2]) || 0
    };
  }

  const parsed = Number(raw);
  if (Number.isFinite(parsed)) {
    return { value: parsed, max: parsed };
  }

  return { value: 0, max: 0 };
}

function parseDropTrooperWeaponMode(value) {
  const raw = normalizeDropTrooperString(value).toLowerCase();
  if (raw === "blast") return "blast";
  if (raw === "cone") return "cone";
  return "direct";
}

function parseDropTrooperTags(value) {
  const raw = normalizeDropTrooperString(value);
  if (!raw || raw === "-") return [];
  return raw.split(",").map(part => normalizeDropTrooperString(part)).filter(Boolean);
}

function parseDropTrooperBlueprint(rawText) {
  const text = String(rawText ?? "").replace(/\r/g, "");
  const lines = text.split("\n");
  const blueprint = {
    name: "",
    archetype: "",
    tier: "Standard",
    armor: "Medium",
    integrity: 8,
    health: 8,
    initiative: 0,
    shooting: 2,
    defense: 1,
    weapons: [],
    abilities: [],
    notes: "",
    image: "",
    spawnCount: 1
  };

  let section = "fields";

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const lower = line.toLowerCase();
    if (lower === "weapons:") {
      section = "weapons";
      continue;
    }

    if (lower === "abilities:") {
      section = "abilities";
      continue;
    }

    if (section === "weapons" && line.startsWith("-")) {
      const body = line.slice(1).trim();
      const parts = body.split("|").map(part => part.trim());
      if (!parts[0]) continue;

      const mode = parseDropTrooperWeaponMode(parts[7]);
      const tags = parseDropTrooperTags(parts[8]);
      const isSmoke = tags.some(tag => tag.toLowerCase() === "smoke");

      blueprint.weapons.push({
        name: parts[0],
        skill: normalizeDropTrooperSkill(parts[1], "shooting"),
        tier: normalizeDropTrooperArmorTier(parts[2], "Medium"),
        baseDamage: parseDropTrooperMaybeNumber(parts[3], 0),
        ammo: parseDropTrooperMaybeAmmoValue(parts[4]),
        magSize: parseDropTrooperMaybeAmmoValue(parts[5]),
        ammoMax: parseDropTrooperMaybeAmmoValue(parts[6]),
        aoeEnabled: mode !== "direct",
        aoeType: mode === "cone" ? "cone" : "blast",
        aoeEffect: isSmoke ? "smoke" : "damage",
        tags,
        notes: tags.join(", ")
      });
      continue;
    }

    if (section === "abilities" && line.startsWith("-")) {
      const body = line.slice(1).trim();
      const parts = body.split("|").map(part => part.trim());
      if (!parts[0]) continue;
      const pool = parseDropTrooperPoolValue(parts[5]);

      blueprint.abilities.push({
        name: parts[0],
        abilityType: normalizeDropTrooperAbilityType(parts[1]),
        linkedSkill: normalizeDropTrooperSkill(parts[2], "tech"),
        bonusDice: parseDropTrooperMaybeNumber(parts[3], 0),
        specialType: normalizeDropTrooperSpecialType(parts[4]),
        pool,
        notes: normalizeDropTrooperString(parts[6])
      });
      continue;
    }

    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim().toLowerCase();
    const value = line.slice(colonIndex + 1).trim();

    switch (key) {
      case "name":
        blueprint.name = value;
        break;
      case "archetype":
        blueprint.archetype = value;
        break;
      case "tier":
        blueprint.tier = normalizeDropTrooperTier(value, "Standard");
        break;
      case "armor":
        blueprint.armor = normalizeDropTrooperArmorTier(value, "Medium");
        break;
      case "integrity":
        blueprint.integrity = parseDropTrooperMaybeNumber(value, 8);
        break;
      case "health":
        blueprint.health = parseDropTrooperMaybeNumber(value, 8);
        break;
      case "initiative":
        blueprint.initiative = parseDropTrooperMaybeNumber(value, 0);
        break;
      case "shooting":
        blueprint.shooting = parseDropTrooperMaybeNumber(value, 2);
        break;
      case "defense":
        blueprint.defense = parseDropTrooperMaybeNumber(value, 1);
        break;
      case "notes":
        blueprint.notes = value;
        break;
      case "image":
        blueprint.image = value;
        break;
      case "spawn count":
        blueprint.spawnCount = Math.max(1, parseDropTrooperMaybeNumber(value, 1));
        break;
      default:
        break;
    }
  }

  if (!blueprint.name) {
    throw new Error("Blueprint is missing Name.");
  }

  return blueprint;
}

function getDropTrooperDerivedAoeDamage(weaponData = {}) {
  const baseDamage = parseDropTrooperMaybeNumber(weaponData.baseDamage, 0);
  if (baseDamage <= 0) {
    return { killDamage: 0, heavyDamage: 0, fragDamage: 0 };
  }

  return {
    killDamage: parseDropTrooperMaybeNumber(weaponData.killDamage, baseDamage),
    heavyDamage: parseDropTrooperMaybeNumber(weaponData.heavyDamage, Math.max(0, baseDamage - 1)),
    fragDamage: parseDropTrooperMaybeNumber(weaponData.fragDamage, Math.max(0, baseDamage - 2))
  };
}

function buildDropTrooperLegacyWeaponData(weaponData = {}) {
  const aoeDamage = getDropTrooperDerivedAoeDamage(weaponData);
  return {
    name: weaponData.name || "Weapon",
    tier: normalizeDropTrooperArmorTier(weaponData.tier, "Medium"),
    baseDamage: parseDropTrooperMaybeNumber(weaponData.baseDamage, 4),
    aoeEnabled: !!weaponData.aoeEnabled,
    blastRadius: parseDropTrooperMaybeNumber(weaponData.blastRadius, 100),
    killRadius: parseDropTrooperMaybeNumber(weaponData.killRadius, 30),
    heavyRadius: parseDropTrooperMaybeNumber(weaponData.heavyRadius, 60),
    fragRadius: parseDropTrooperMaybeNumber(weaponData.fragRadius, 100),
    killDamage: aoeDamage.killDamage,
    heavyDamage: aoeDamage.heavyDamage,
    fragDamage: aoeDamage.fragDamage,
    ammo: weaponData.ammo ?? "",
    magSize: weaponData.magSize ?? "",
    ammoMax: weaponData.ammoMax ?? "",
    coneRange: parseDropTrooperMaybeNumber(weaponData.coneRange, 20),
    coneAngle: String(weaponData.coneAngle ?? "60"),
    coneKillRange: parseDropTrooperMaybeNumber(weaponData.coneKillRange, 0),
    coneHeavyRange: parseDropTrooperMaybeNumber(weaponData.coneHeavyRange, 0),
    coneFragRange: parseDropTrooperMaybeNumber(weaponData.coneFragRange, 0),
    aoeEffect: weaponData.aoeEffect === "smoke" ? "smoke" : "damage",
    smokeDiameter: parseDropTrooperMaybeNumber(weaponData.smokeDiameter, 30),
    smokeDurationRounds: parseDropTrooperMaybeNumber(weaponData.smokeDurationRounds, 3)
  };
}

function buildDropTrooperWeaponItemData(weaponData = {}) {
  const aoeDamage = getDropTrooperDerivedAoeDamage(weaponData);
  return {
    name: weaponData.name || "Weapon",
    type: "weapon",
    system: {
      tier: normalizeDropTrooperArmorTier(weaponData.tier, "Medium"),
      baseDamage: parseDropTrooperMaybeNumber(weaponData.baseDamage, 4),
      skill: normalizeDropTrooperSkill(weaponData.skill, "shooting"),
      ammo: weaponData.ammo ?? "",
      notes: weaponData.notes || "",
      aoeEnabled: !!weaponData.aoeEnabled,
      aoeType: weaponData.aoeType === "cone" ? "cone" : "blast",
      blastRadius: parseDropTrooperMaybeNumber(weaponData.blastRadius, 100),
      killRadius: parseDropTrooperMaybeNumber(weaponData.killRadius, 30),
      heavyRadius: parseDropTrooperMaybeNumber(weaponData.heavyRadius, 60),
      fragRadius: parseDropTrooperMaybeNumber(weaponData.fragRadius, 100),
      killDamage: aoeDamage.killDamage,
      heavyDamage: aoeDamage.heavyDamage,
      fragDamage: aoeDamage.fragDamage,
      magSize: weaponData.magSize ?? "",
      ammoMax: weaponData.ammoMax ?? "",
      coneRange: parseDropTrooperMaybeNumber(weaponData.coneRange, 20),
      coneAngle: String(weaponData.coneAngle ?? "60"),
      coneKillRange: parseDropTrooperMaybeNumber(weaponData.coneKillRange, 0),
      coneHeavyRange: parseDropTrooperMaybeNumber(weaponData.coneHeavyRange, 0),
      coneFragRange: parseDropTrooperMaybeNumber(weaponData.coneFragRange, 0),
      aoeEffect: weaponData.aoeEffect === "smoke" ? "smoke" : "damage",
      smokeDiameter: parseDropTrooperMaybeNumber(weaponData.smokeDiameter, 30),
      smokeDurationRounds: parseDropTrooperMaybeNumber(weaponData.smokeDurationRounds, 3)
    }
  };
}

function buildDropTrooperAbilityItemData(abilityData = {}) {
  return {
    name: abilityData.name || "Ability",
    type: "ability",
    system: {
      abilityType: normalizeDropTrooperAbilityType(abilityData.abilityType),
      linkedSkill: normalizeDropTrooperSkill(abilityData.linkedSkill, "tech"),
      bonusDice: parseDropTrooperMaybeNumber(abilityData.bonusDice, 0),
      specialType: normalizeDropTrooperSpecialType(abilityData.specialType),
      pool: {
        value: parseDropTrooperMaybeNumber(abilityData.pool?.value, 0),
        max: parseDropTrooperMaybeNumber(abilityData.pool?.max, 0)
      },
      notes: abilityData.notes || "",
      baseRange: parseDropTrooperMaybeNumber(abilityData.baseRange, 60),
      rangePerSuccess: parseDropTrooperMaybeNumber(abilityData.rangePerSuccess, 30),
      pingDurationMs: parseDropTrooperMaybeNumber(abilityData.pingDurationMs, 1500)
    }
  };
}

function buildDropTrooperNpcBlueprintText(actor) {
  const meta = actor.getFlag("drop-trooper", DROP_TROOPER_NPC_BLUEPRINT_FLAG) || {};
  const weapons = actor.items.filter(item => item.type === "weapon");
  const abilities = actor.items.filter(item => item.type === "ability");

  const weaponLines = weapons.length
    ? weapons.map(weapon => {
        const mode = weapon.system?.aoeEnabled ? (weapon.system?.aoeType === "cone" ? "cone" : "blast") : "direct";
        const tags = [];
        if (weapon.system?.aoeEnabled && weapon.system?.aoeEffect === "smoke") tags.push("smoke");
        const notes = normalizeDropTrooperString(weapon.system?.notes);
        if (notes && !tags.includes(notes)) tags.push(notes);
        const tagText = tags.length ? tags.join(", ") : "-";
        const ammo = weapon.system?.ammo === "" || weapon.system?.ammo === null || weapon.system?.ammo === undefined ? "-" : weapon.system.ammo;
        const mag = weapon.system?.magSize === "" || weapon.system?.magSize === null || weapon.system?.magSize === undefined ? "-" : weapon.system.magSize;
        const spare = weapon.system?.ammoMax === "" || weapon.system?.ammoMax === null || weapon.system?.ammoMax === undefined ? "-" : weapon.system.ammoMax;
        return `- ${weapon.name} | ${weapon.system?.skill || "shooting"} | ${weapon.system?.tier || "Medium"} | ${Number(weapon.system?.baseDamage) || 0} | ${ammo} | ${mag} | ${spare} | ${mode} | ${tagText}`;
      })
    : [`- ${actor.system?.weapon?.name || "Weapon"} | shooting | ${actor.system?.weapon?.tier || "Medium"} | ${Number(actor.system?.weapon?.baseDamage) || 0} | ${actor.system?.weapon?.ammo || "-"} | ${actor.system?.weapon?.magSize || "-"} | ${actor.system?.weapon?.ammoMax || "-"} | direct | -`];

  const abilityLines = abilities.map(ability => {
    const poolCurrent = Number(ability.system?.pool?.value) || 0;
    const poolMax = Number(ability.system?.pool?.max) || 0;
    const poolText = poolMax > 0 ? `${poolCurrent}/${poolMax}` : "0";
    return `- ${ability.name} | ${ability.system?.abilityType || "skill"} | ${ability.system?.linkedSkill || "tech"} | ${Number(ability.system?.bonusDice) || 0} | ${ability.system?.specialType || "none"} | ${poolText} | ${normalizeDropTrooperString(ability.system?.notes)}`;
  });

  return [
    `Name: ${actor.name}`,
    `Archetype: ${meta.archetype || ""}`,
    `Tier: ${meta.tier || "Standard"}`,
    `Armor: ${actor.system?.armor?.tier || "Medium"}`,
    `Integrity: ${Number(actor.system?.armor?.integrity?.value) || 0}`,
    `Health: ${Number(actor.system?.health?.value) || 0}`,
    `Initiative: ${Number(actor.system?.combat?.initiative) || 0}`,
    `Shooting: ${Number(actor.system?.skills?.shooting) || 0}`,
    `Defense: ${Number(actor.system?.skills?.defense) || 0}`,
    "",
    "Weapons:",
    ...weaponLines,
    "",
    "Abilities:",
    ...(abilityLines.length ? abilityLines : [""]),
    "",
    `Notes: ${meta.notes || ""}`,
    `Image: ${actor.img || ""}`,
    `Spawn Count: ${Number(meta.spawnCount) || 1}`
  ].join("\n");
}

function showDropTrooperBlueprintDialog(title, blueprintText) {
  const escaped = escapeDropTrooperHtml(blueprintText);
  new Dialog({
    title,
    content: `
      <form class="trooper-sheet">
        <section class="dt-card">
          <h2>Blueprint</h2>
          <textarea class="dt-blueprint-textarea" readonly>${escaped}</textarea>
          <p class="dt-item-help">Copy this text back into chat or save it for later. Use ${DROP_TROOPER_NPC_IMPORT_COMMAND} to import a blueprint into Foundry.</p>
        </section>
      </form>
    `,
    buttons: {
      close: {
        label: "Close"
      }
    }
  }).render(true);
}

async function exportDropTrooperNpcBlueprint(actor) {
  if (!actor || actor.type !== "npc") {
    ui.notifications.warn("Select or open an NPC first.");
    return;
  }

  const blueprintText = buildDropTrooperNpcBlueprintText(actor);
  showDropTrooperBlueprintDialog(`${actor.name} Blueprint`, blueprintText);

  await ChatMessage.create({
    whisper: ChatMessage.getWhisperRecipients("GM").map(user => user.id),
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="dt-chat-card">
        <div class="dt-chat-header">
          <div class="dt-chat-title">${escapeDropTrooperHtml(actor.name)}</div>
          <div class="dt-chat-subtitle">NPC Blueprint Export</div>
        </div>
        <div class="dt-chat-body">
          <div class="dt-chat-section">
            <pre class="dt-blueprint-pre">${escapeDropTrooperHtml(blueprintText)}</pre>
          </div>
        </div>
      </div>
    `
  });
}

async function createDropTrooperNpcFromBlueprint(rawText) {
  const blueprint = parseDropTrooperBlueprint(rawText);
  const img = normalizeDropTrooperString(blueprint.image) || "icons/svg/mystery-man.svg";
  const primaryWeapon = blueprint.weapons[0] || {
    name: "Weapon",
    tier: "Medium",
    baseDamage: 4,
    ammo: "",
    magSize: "",
    ammoMax: "",
    aoeEnabled: false,
    aoeType: "blast",
    aoeEffect: "damage"
  };

  const actor = await Actor.create({
    name: blueprint.name,
    type: "npc",
    img,
    system: {
      nameplate: blueprint.archetype || "",
      armor: {
        tier: normalizeDropTrooperArmorTier(blueprint.armor, "Medium"),
        integrity: {
          value: parseDropTrooperMaybeNumber(blueprint.integrity, 8),
          max: parseDropTrooperMaybeNumber(blueprint.integrity, 8)
        }
      },
      health: {
        value: parseDropTrooperMaybeNumber(blueprint.health, 8),
        max: parseDropTrooperMaybeNumber(blueprint.health, 8)
      },
      combat: {
        initiative: parseDropTrooperMaybeNumber(blueprint.initiative, 0)
      },
      skills: {
        shooting: parseDropTrooperMaybeNumber(blueprint.shooting, 2),
        defense: parseDropTrooperMaybeNumber(blueprint.defense, 1)
      },
      weapon: buildDropTrooperLegacyWeaponData(primaryWeapon)
    },
    prototypeToken: {
      name: blueprint.name,
      actorLink: false,
      texture: { src: img }
    }
  });

  if (blueprint.weapons.length > 0) {
    await actor.createEmbeddedDocuments("Item", blueprint.weapons.map(buildDropTrooperWeaponItemData));
  }

  if (blueprint.abilities.length > 0) {
    await actor.createEmbeddedDocuments("Item", blueprint.abilities.map(buildDropTrooperAbilityItemData));
  }

  await actor.setFlag("drop-trooper", DROP_TROOPER_NPC_BLUEPRINT_FLAG, {
    archetype: blueprint.archetype || "",
    tier: blueprint.tier || "Standard",
    notes: blueprint.notes || "",
    spawnCount: Math.max(1, parseDropTrooperMaybeNumber(blueprint.spawnCount, 1))
  });

  ui.notifications.info(`Created NPC: ${actor.name}`);
  actor.sheet?.render(true);
  return actor;
}

function getDropTrooperActiveNpcActor() {
  const controlled = canvas?.tokens?.controlled?.find(token => token?.actor?.type === "npc")?.actor;
  if (controlled) return controlled;

  const openSheet = Object.values(ui.windows).find(app => app instanceof DropTrooperSheet && app.actor?.type === "npc");
  if (openSheet?.actor) return openSheet.actor;

  return null;
}

function openDropTrooperNpcImportDialog(prefillText = "") {
  const escaped = escapeDropTrooperHtml(prefillText);

  new Dialog({
    title: "Import Drop Trooper NPC Blueprint",
    content: `
      <form class="trooper-sheet">
        <section class="dt-card">
          <h2>Paste Blueprint</h2>
          <textarea name="blueprint" class="dt-blueprint-textarea">${escaped}</textarea>
          <p class="dt-item-help">This creates one editable NPC actor in the Actors tab. It does not place tokens on the map.</p>
        </section>
      </form>
    `,
    buttons: {
      import: {
        label: "Import NPC",
        callback: async html => {
          const blueprintText = html.find("textarea[name='blueprint']").val();
          try {
            await createDropTrooperNpcFromBlueprint(blueprintText);
          } catch (err) {
            console.error("Drop Trooper | NPC blueprint import failed", err);
            ui.notifications.error(`NPC import failed: ${err.message}`);
          }
        }
      },
      cancel: {
        label: "Cancel"
      }
    },
    default: "import"
  }).render(true);
}

function handleDropTrooperNpcChatCommand(messageText) {
  if (!game.user?.isGM) {
    ui.notifications.warn("Only the GM can import or export Drop Trooper NPC blueprints.");
    return false;
  }

  const trimmed = String(messageText ?? "").trim();

  if (trimmed.startsWith(DROP_TROOPER_NPC_IMPORT_COMMAND)) {
    const rawBlueprint = trimmed.slice(DROP_TROOPER_NPC_IMPORT_COMMAND.length).trim();
    if (rawBlueprint) {
      createDropTrooperNpcFromBlueprint(rawBlueprint).catch(err => {
        console.error("Drop Trooper | NPC blueprint import failed", err);
        ui.notifications.error(`NPC import failed: ${err.message}`);
      });
    } else {
      openDropTrooperNpcImportDialog();
    }
    return false;
  }

  if (trimmed.startsWith(DROP_TROOPER_NPC_EXPORT_COMMAND)) {
    const actor = getDropTrooperActiveNpcActor();
    exportDropTrooperNpcBlueprint(actor).catch(err => {
      console.error("Drop Trooper | NPC blueprint export failed", err);
      ui.notifications.error(`NPC export failed: ${err.message}`);
    });
    return false;
  }

  return true;
}


function getDropTrooperHudAmmoText(weapon) {
  const ammo = weapon.system?.ammo;
  const magSize = weapon.system?.magSize;
  const spareAmmo = weapon.system?.ammoMax;

  const hasAmmo = ammo !== undefined && ammo !== null && String(ammo).trim() !== "";
  const hasMag = magSize !== undefined && magSize !== null && String(magSize).trim() !== "";
  const hasSpare = spareAmmo !== undefined && spareAmmo !== null && String(spareAmmo).trim() !== "";

  if (!hasAmmo && !hasMag && !hasSpare) return "—";

  const current = hasAmmo ? ammo : "?";
  const mag = hasMag ? magSize : "?";
  const spare = hasSpare ? spareAmmo : "?";

  return `${current} / ${mag} / ${spare}`;
}

const DROP_TROOPER_GROUP_ACTED_FLAG = "groupActed";
const DROP_TROOPER_GROUP_ACTED_LEGACY_ICON = "icons/svg/combat.svg";
const DROP_TROOPER_GROUP_ACTED_TINT = "#ff7a00";
const DROP_TROOPER_GROUP_ACTED_ALPHA = 0.62;

function getDropTrooperGroupSignature(actor) {
  if (!actor) return "";

  const weaponSignature = actor.items
    .filter(item => item.type === "weapon")
    .map(item => `${item.name}::${item.system?.skill || "shooting"}::${item.system?.aoeEnabled ? "aoe" : "direct"}`)
    .sort()
    .join("||");

  return `${actor.type}::${actor.name}::${weaponSignature}`;
}

function getDropTrooperGroupActedData(tokenLike) {
  const document = tokenLike?.document || tokenLike;
  return document?.getFlag?.("drop-trooper", DROP_TROOPER_GROUP_ACTED_FLAG) || null;
}

function isDropTrooperGroupActedToken(tokenLike, combat = game.combat) {
  const data = getDropTrooperGroupActedData(tokenLike);
  if (!data || !combat) return false;
  return data.combatId === combat.id && Number(data.round) === Number(combat.round);
}

async function setDropTrooperGroupActedMarker(tokenLike) {
  if (!game.combat) return;

  const document = tokenLike?.document || tokenLike;
  if (!document) return;

  const existingData = getDropTrooperGroupActedData(document) || {};
  const previousAlpha = Object.prototype.hasOwnProperty.call(existingData, "previousAlpha")
    ? existingData.previousAlpha
    : (document.alpha ?? 1);
  const previousTint = Object.prototype.hasOwnProperty.call(existingData, "previousTint")
    ? existingData.previousTint
    : (document.texture?.tint ?? null);

  await document.setFlag("drop-trooper", DROP_TROOPER_GROUP_ACTED_FLAG, {
    combatId: game.combat.id,
    round: Number(game.combat.round) || 0,
    label: "Group Fired",
    previousAlpha,
    previousTint
  });

  const effects = Array.isArray(document.effects) ? [...document.effects] : [];
  const filteredEffects = effects.filter(effect => effect !== DROP_TROOPER_GROUP_ACTED_LEGACY_ICON);

  const updateData = {};
  if ((document.alpha ?? 1) !== DROP_TROOPER_GROUP_ACTED_ALPHA) {
    updateData.alpha = DROP_TROOPER_GROUP_ACTED_ALPHA;
  }
  if ((document.texture?.tint ?? null) !== DROP_TROOPER_GROUP_ACTED_TINT) {
    updateData["texture.tint"] = DROP_TROOPER_GROUP_ACTED_TINT;
  }
  if (filteredEffects.length !== effects.length) {
    updateData.effects = filteredEffects;
  }

  if (Object.keys(updateData).length) {
    await document.update(updateData);
  }
}

async function clearDropTrooperGroupActedMarker(tokenLike) {
  const document = tokenLike?.document || tokenLike;
  if (!document) return;

  const markerData = getDropTrooperGroupActedData(document) || {};
  const previousAlpha = Object.prototype.hasOwnProperty.call(markerData, "previousAlpha")
    ? markerData.previousAlpha
    : 1;
  const previousTint = Object.prototype.hasOwnProperty.call(markerData, "previousTint")
    ? markerData.previousTint
    : null;

  await document.unsetFlag("drop-trooper", DROP_TROOPER_GROUP_ACTED_FLAG);

  const effects = Array.isArray(document.effects) ? [...document.effects] : [];
  const filteredEffects = effects.filter(effect => effect !== DROP_TROOPER_GROUP_ACTED_LEGACY_ICON);

  const updateData = {};
  if ((document.alpha ?? 1) !== previousAlpha) {
    updateData.alpha = previousAlpha;
  }
  if ((document.texture?.tint ?? null) !== previousTint) {
    updateData["texture.tint"] = previousTint;
  }
  if (filteredEffects.length !== effects.length) {
    updateData.effects = filteredEffects;
  }

  if (Object.keys(updateData).length) {
    await document.update(updateData);
  }
}

async function clearExpiredDropTrooperGroupMarkers(combat) {
  if (!game.user?.isGM || !canvas?.scene || !combat) return;

  const tokenDocs = canvas.scene.tokens?.contents || [];
  const currentRound = Number(combat.round) || 0;
  const staleDocs = tokenDocs.filter(tokenDoc => {
    const data = tokenDoc.getFlag("drop-trooper", DROP_TROOPER_GROUP_ACTED_FLAG);
    if (!data) return false;
    if (data.combatId && data.combatId !== combat.id) return false;
    const appliedRound = Number(data.round);
    return !Number.isFinite(appliedRound) || appliedRound < currentRound;
  });

  for (const tokenDoc of staleDocs) {
    await clearDropTrooperGroupActedMarker(tokenDoc);
  }
}

function getDropTrooperGroupHudData(tokens) {
  const validTokens = (tokens || []).filter(token => token?.actor);
  if (validTokens.length < 2) {
    return { valid: false };
  }

  const firstActor = validTokens[0].actor;
  if (!firstActor || firstActor.type !== "npc") {
    return { valid: false };
  }

  const signature = getDropTrooperGroupSignature(firstActor);
  const allMatch = validTokens.every(token => token.actor?.type === "npc" && getDropTrooperGroupSignature(token.actor) === signature);
  if (!allMatch) {
    return { valid: false };
  }

  const combat = game.combat;
  const actedTokens = combat ? validTokens.filter(token => isDropTrooperGroupActedToken(token, combat)) : [];
  const readyTokens = combat ? validTokens.filter(token => !isDropTrooperGroupActedToken(token, combat)) : validTokens;
  const weapons = firstActor.items.filter(item => item.type === "weapon" && !item.system?.aoeEnabled);

  return {
    valid: true,
    actor: firstActor,
    tokens: validTokens,
    readyTokens,
    actedTokens,
    weapons,
    hasStandardAttack: weapons.length === 0
  };
}

async function runDropTrooperHudAction(actor, action, itemId = null, rollKey = null) {
  const sheet = actor?.sheet;
  if (!sheet) return;

  if (action === "brace") {
    await sheet._onBrace({ preventDefault: () => {} });
    return;
  }

  if (action === "aim") {
    await sheet._onAim({ preventDefault: () => {} });
    return;
  }

  if (action === "skill-roll" && rollKey) {
    await sheet._onRollSkill({
      preventDefault: () => {},
      currentTarget: { dataset: { skill: rollKey } }
    });
    return;
  }

  if (action === "attribute-roll" && rollKey) {
    await sheet._onRollAttribute({
      preventDefault: () => {},
      currentTarget: { dataset: { attribute: rollKey } }
    });
    return;
  }

  if (action === "attack") {
    if (itemId) {
      const weapon = actor.items.get(itemId);
      if (!weapon) return;
      if (weapon.system?.aoeEnabled) {
        await sheet._onWeaponAoeAttack(weapon);
      } else {
        await sheet._onWeaponSingleAttack(weapon);
      }
      return;
    }

    await sheet._onRollShoot({ preventDefault: () => {} });
    return;
  }

  if (action === "reload" && itemId) {
    await sheet._onWeaponReload({
      preventDefault: () => {},
      currentTarget: { dataset: { itemId } }
    });
    return;
  }

  if (action === "ability" && itemId) {
    await sheet._onAbilityUse({
      preventDefault: () => {},
      currentTarget: { dataset: { itemId } }
    });
    return;
  }
}

const DROP_TROOPER_ATTRIBUTE_REQUEST_OPTIONS = [
  { key: "strength", label: "Strength (STR)" },
  { key: "agility", label: "Agility (AGI)" },
  { key: "perception", label: "Perception (PER)" },
  { key: "tech", label: "Tech (TEC)" },
  { key: "will", label: "Will (WIL)" }
];

const DROP_TROOPER_SKILL_REQUEST_OPTIONS = [
  { key: "shooting", label: "Shooting" },
  { key: "heavyWeapons", label: "Heavy Weapons" },
  { key: "melee", label: "Melee" },
  { key: "maneuvering", label: "Maneuvering" },
  { key: "recon", label: "Recon" },
  { key: "sensors", label: "Sensors" },
  { key: "electronics", label: "Electronics" },
  { key: "engineering", label: "Engineering" },
  { key: "droneControl", label: "Drone Control" },
  { key: "command", label: "Command" },
  { key: "discipline", label: "Discipline" },
  { key: "survival", label: "Survival" }
];

function getDropTrooperSupportedControlledTokens() {
  if (!canvas?.ready) return [];

  return (canvas.tokens?.controlled || []).filter(token => {
    const sheet = token?.actor?.sheet;
    return !!token?.actor && !!sheet && typeof sheet._onRollSkill === "function" && typeof sheet._onRollAttribute === "function";
  });
}

function getDropTrooperRequestedRollLabel(rollType, rollKey) {
  const options = rollType === "attribute"
    ? DROP_TROOPER_ATTRIBUTE_REQUEST_OPTIONS
    : DROP_TROOPER_SKILL_REQUEST_OPTIONS;

  return options.find(option => option.key === rollKey)?.label || "Requested Roll";
}

function canUserResolveDropTrooperRequestedRoll(actor, user = game.user) {
  if (!actor || !user) return false;
  if (user.isGM) return true;

  if (typeof actor.testUserPermission === "function") {
    const ownerLevel = CONST.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? CONST.DOCUMENT_PERMISSION_LEVELS?.OWNER ?? 3;
    return actor.testUserPermission(user, ownerLevel);
  }

  return actor.isOwner === true;
}

function getDropTrooperRequestedRollTarget(sceneId, tokenId, actorId) {
  const scene = sceneId ? game.scenes?.get(sceneId) : canvas?.scene;
  const tokenDocument = scene?.tokens?.get(tokenId) || null;
  const token = tokenDocument?.object || (canvas?.scene?.id === scene?.id ? canvas.tokens?.get(tokenId) : null) || null;
  const actor = token?.actor || tokenDocument?.actor || game.actors?.get(actorId) || null;

  return { scene, tokenDocument, token, actor };
}


function isDropTrooperSmokeTemplate(template) {
  return !!template?.document?.getFlag("drop-trooper", "smokeData");
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

function buildDropTrooperRequestedRollCard(token, rollType, rollKey) {
  const actor = token?.actor;
  const tokenName = escapeDropTrooperHtml(token?.name || actor?.name || "Token");
  const actorName = escapeDropTrooperHtml(actor?.name || token?.name || "Actor");
  const rollLabel = escapeDropTrooperHtml(getDropTrooperRequestedRollLabel(rollType, rollKey));
  const sceneId = escapeDropTrooperHtml(token?.scene?.id || canvas?.scene?.id || "");
  const tokenId = escapeDropTrooperHtml(token?.id || "");
  const actorId = escapeDropTrooperHtml(actor?.id || "");

  return `
    <div class="dt-chat-card dt-roll-request-card">
      <div class="dt-chat-header">
        <div class="dt-chat-title">${tokenName}</div>
        <div class="dt-chat-subtitle">Roll Request</div>
      </div>
      <div class="dt-chat-body">
        <div class="dt-chat-section">
          <div class="dt-chat-grid">
            <div class="dt-chat-line"><span class="dt-chat-small">Actor</span><br><span class="dt-chat-strong">${actorName}</span></div>
            <div class="dt-chat-line"><span class="dt-chat-small">Roll</span><br><span class="dt-chat-strong">${rollLabel}</span></div>
          </div>
          <div class="dt-chat-line dt-chat-line--compact"><span class="dt-chat-small">Prompt</span><br><span class="dt-chat-strong">Click to roll for this token.</span></div>
          <div style="margin-top:8px;">
            <button
              type="button"
              class="dt-request-roll-btn"
              data-roll-type="${rollType}"
              data-roll-key="${rollKey}"
              data-scene-id="${sceneId}"
              data-token-id="${tokenId}"
              data-actor-id="${actorId}"
              style="width:100%;height:28px;border:1px solid #425467;border-radius:6px;background:#18212b;color:#e8edf2;font-weight:700;cursor:pointer;"
            >Roll ${rollLabel}</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

async function executeDropTrooperRequestedRoll(requestData) {
  const { actor } = getDropTrooperRequestedRollTarget(requestData.sceneId, requestData.tokenId, requestData.actorId);
  if (!actor?.sheet) {
    ui.notifications.warn("That roll request no longer points to a valid token or actor.");
    return false;
  }

  if (!canUserResolveDropTrooperRequestedRoll(actor, game.user)) {
    ui.notifications.warn("Only the owning player or GM can roll for that token.");
    return false;
  }

  const sheet = actor.sheet;

  if (requestData.rollType === "skill") {
    await sheet._onRollSkill({
      preventDefault: () => {},
      currentTarget: { dataset: { skill: requestData.rollKey } }
    });
  } else {
    await sheet._onRollAttribute({
      preventDefault: () => {},
      currentTarget: { dataset: { attribute: requestData.rollKey } }
    });
  }

  return true;
}

async function runDropTrooperRequestedRoll(tokens, rollType, rollKey) {
  const supportedTokens = (tokens || []).filter(token => {
    const sheet = token?.actor?.sheet;
    return !!token?.actor && !!sheet && (rollType === "skill"
      ? typeof sheet._onRollSkill === "function"
      : typeof sheet._onRollAttribute === "function");
  });

  if (!supportedTokens.length) {
    ui.notifications.warn("No valid Drop Trooper tokens selected for that roll request.");
    return;
  }

  for (const token of supportedTokens) {
    await ChatMessage.create({
      speaker: { alias: "GM" },
      content: buildDropTrooperRequestedRollCard(token, rollType, rollKey),
      flags: {
        "drop-trooper": {
          rollRequest: {
            rollType,
            rollKey,
            sceneId: token?.scene?.id || canvas?.scene?.id || null,
            tokenId: token?.id || null,
            actorId: token?.actor?.id || null
          }
        }
      }
    });
  }
}

function openDropTrooperRollRequestDialog() {
  if (!game.user?.isGM) {
    ui.notifications.warn("Only the GM can send roll requests.");
    return;
  }

  const supportedTokens = getDropTrooperSupportedControlledTokens();
  if (!supportedTokens.length) {
    ui.notifications.warn("Select one or more Drop Trooper tokens first.");
    return;
  }

  const optionHtml = [
    '<optgroup label="Attributes">',
    ...DROP_TROOPER_ATTRIBUTE_REQUEST_OPTIONS.map(option => `<option value="attribute|${option.key}">${option.label}</option>`),
    '</optgroup>',
    '<optgroup label="Skills">',
    ...DROP_TROOPER_SKILL_REQUEST_OPTIONS.map(option => `<option value="skill|${option.key}">${option.label}</option>`),
    '</optgroup>'
  ].join('');

  const tokenList = supportedTokens.map(token => token.name || token.actor?.name || "Token").join(", ");

  new Dialog({
    title: "Drop Trooper | Request Roll",
    content: `
      <form>
        <div class="form-group">
          <label>Selected Tokens</label>
          <div style="line-height:1.3;">${tokenList}</div>
        </div>
        <div class="form-group" style="margin-top:8px;">
          <label>Roll</label>
          <select name="dropTrooperRollRequest" style="width:100%;">
            ${optionHtml}
          </select>
        </div>
      </form>
    `,
    buttons: {
      request: {
        icon: '<i class="fas fa-dice-d20"></i>',
        label: "Request",
        callback: async html => {
          const raw = String(html.find('[name="dropTrooperRollRequest"]').val() || "");
          const [rollType, rollKey] = raw.split("|");
          if (!rollType || !rollKey) {
            ui.notifications.warn("Choose a valid skill or attribute.");
            return;
          }

          await runDropTrooperRequestedRoll(supportedTokens, rollType, rollKey);
        }
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: "Cancel"
      }
    },
    default: "request"
  }).render(true);
}

async function runDropTrooperGroupHudAttack(tokens, weaponName = null) {
  const groupData = getDropTrooperGroupHudData(tokens);
  if (!groupData.valid) {
    ui.notifications.warn("Group HUD requires multiple NPCs with the same actor setup.");
    return;
  }

  const targets = Array.from(game.user.targets || []);
  if (targets.length !== 1) {
    ui.notifications.warn("Target exactly 1 token for Group Attack.");
    return;
  }

  const targetToken = targets[0];
  const targetActor = targetToken.actor;
  if (!targetActor) {
    ui.notifications.warn("Target has no actor.");
    return;
  }

  const readyTokens = groupData.readyTokens;
  if (!readyTokens.length) {
    ui.notifications.warn("All selected NPCs already have a Group Fired marker this round.");
    return;
  }

  let resolved = 0;
  let skippedAmmo = 0;
  let skippedMissingWeapon = 0;
  let skippedNoSheet = 0;

  for (const token of readyTokens) {
    const actor = token.actor;
    const sheet = actor?.sheet;
    if (!actor || !sheet) {
      skippedNoSheet += 1;
      continue;
    }

    if (weaponName) {
      const weapon = actor.items.find(item => item.type === "weapon" && item.name === weaponName && !item.system?.aoeEnabled);
      if (!weapon) {
        skippedMissingWeapon += 1;
        continue;
      }

      const ammoState = typeof sheet._getWeaponAmmoState === "function" ? sheet._getWeaponAmmoState(weapon) : null;
      if (ammoState?.usesAmmo && Number(ammoState.ammo) <= 0) {
        skippedAmmo += 1;
        continue;
      }

      await sheet._onWeaponSingleAttack(weapon);
    } else {
      await sheet._onRollShoot({ preventDefault: () => {} });
    }

    resolved += 1;
    if (game.combat) {
      await setDropTrooperGroupActedMarker(token);
    }
  }

  const actedSkipped = groupData.actedTokens.length;
  const headerLabel = `${groupData.actor.name} x${groupData.tokens.length}`;
  const weaponLabel = weaponName || "Standard Attack";
  const markerText = game.combat ? `Group Fired marker applied until round ${Number(game.combat.round) + 1}.` : "No active combat: no marker applied.";

  ChatMessage.create({
    speaker: { alias: headerLabel },
    content: `
      <div class="dt-chat-card">
        <div class="dt-chat-header">
          <div class="dt-chat-title">${headerLabel}</div>
          <div class="dt-chat-subtitle">Group Attack Summary</div>
        </div>
        <div class="dt-chat-body">
          <div class="dt-chat-section">
            <div class="dt-chat-grid">
              <div class="dt-chat-line"><span class="dt-chat-small">Weapon</span><br><span class="dt-chat-strong">${weaponLabel}</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Target</span><br><span class="dt-chat-strong">${targetActor.name}</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Resolved</span><br><span class="dt-chat-strong">${resolved}</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Already Acted</span><br><span class="dt-chat-strong">${actedSkipped}</span></div>
              ${skippedAmmo > 0 ? `<div class="dt-chat-line"><span class="dt-chat-small">Out of Ammo</span><br><span class="dt-chat-strong">${skippedAmmo}</span></div>` : ""}
              ${skippedMissingWeapon > 0 ? `<div class="dt-chat-line"><span class="dt-chat-small">Missing Weapon</span><br><span class="dt-chat-strong">${skippedMissingWeapon}</span></div>` : ""}
              ${skippedNoSheet > 0 ? `<div class="dt-chat-line"><span class="dt-chat-small">Skipped</span><br><span class="dt-chat-strong">${skippedNoSheet}</span></div>` : ""}
            </div>
            <div class="dt-chat-line dt-chat-line--compact"><span class="dt-chat-small">Marker</span><br><span class="dt-chat-strong">${markerText}</span></div>
          </div>
        </div>
      </div>
    `
  });
}

function renderDropTrooperHud() {
  const existing = document.getElementById("drop-trooper-token-hud");
  if (existing) existing.remove();

  if (!canvas?.ready) return;
  if (!canvas.tokens?.controlled?.length) return;

  const controlledTokens = canvas.tokens.controlled.filter(token => token?.actor);
  if (!controlledTokens.length) return;

  const groupData = controlledTokens.length > 1 ? getDropTrooperGroupHudData(controlledTokens) : null;
  const isGroupHud = !!groupData?.valid;

  if (!isGroupHud && controlledTokens.length !== 1) return;

  const token = controlledTokens[0];
  const actor = isGroupHud ? groupData.actor : token.actor;
  if (!actor) return;

  const hud = document.createElement("div");
  hud.id = "drop-trooper-token-hud";
  hud.style.position = "fixed";
  hud.style.left = localStorage.getItem("dropTrooperHudLeft") || "20px";
  hud.style.top = localStorage.getItem("dropTrooperHudTop") || "120px";
  hud.style.zIndex = "1000";
  hud.style.minWidth = "224px";
  hud.style.maxWidth = isGroupHud ? "304px" : "292px";
  hud.style.background = "#11161d";
  hud.style.border = "1px solid #2c3947";
  hud.style.borderRadius = "8px";
  hud.style.color = "#e8edf2";
  hud.style.boxShadow = "0 8px 18px rgba(0,0,0,0.32)";
  hud.style.fontFamily = "sans-serif";
  hud.style.fontSize = "12px";

  const header = document.createElement("div");
  header.textContent = isGroupHud ? `${actor.name} x${groupData.tokens.length} HUD` : `${actor.name} HUD`;
  header.style.padding = "6px 8px";
  header.style.cursor = "move";
  header.style.background = "linear-gradient(90deg, #1a2633, #233447)";
  header.style.borderBottom = "1px solid #324255";
  header.style.fontWeight = "700";
  header.style.fontSize = "12px";
  header.style.lineHeight = "1.15";
  header.style.borderTopLeftRadius = "8px";
  header.style.borderTopRightRadius = "8px";
  hud.appendChild(header);

  const body = document.createElement("div");
  body.style.padding = "6px";
  body.style.display = "grid";
  body.style.gap = "4px";

  const sectionTitleStyle = "font-size:10px;color:#9db0c3;text-transform:uppercase;letter-spacing:0.45px;font-weight:700;padding:1px 1px 0 1px;line-height:1.1;";
  const makeActionButton = (text) => {
    const btn = document.createElement("button");
    btn.textContent = text;
    btn.style.minWidth = "28px";
    btn.style.height = "24px";
    btn.style.padding = "0 8px";
    btn.style.borderRadius = "5px";
    btn.style.border = "1px solid #3b4a5c";
    btn.style.background = "#1b2530";
    btn.style.color = "#f4f7fa";
    btn.style.cursor = "pointer";
    btn.style.fontSize = "11px";
    btn.style.fontWeight = "700";
    btn.style.lineHeight = "1";
    return btn;
  };

  if (isGroupHud) {
    const summaryRow = document.createElement("div");
    summaryRow.style.display = "grid";
    summaryRow.style.gridTemplateColumns = "1fr 1fr";
    summaryRow.style.gap = "4px";
    summaryRow.style.padding = "4px 6px";
    summaryRow.style.background = "#18212b";
    summaryRow.style.border = "1px solid #2c3947";
    summaryRow.style.borderRadius = "6px";
    summaryRow.innerHTML = `
      <div><div style="font-size:10px;line-height:1.1;color:#9db0c3;">Ready</div><div style="font-weight:700;font-size:12px;line-height:1.1;">${groupData.readyTokens.length}</div></div>
      <div><div style="font-size:10px;line-height:1.1;color:#9db0c3;">Acted</div><div style="font-weight:700;font-size:12px;line-height:1.1;">${groupData.actedTokens.length}</div></div>
    `;
    body.appendChild(summaryRow);

    const tipRow = document.createElement("div");
    tipRow.style.cssText = "font-size:10px;line-height:1.15;color:#9db0c3;padding:1px 2px 0 2px;";
    tipRow.textContent = "Target 1 trooper, then choose one direct-fire weapon. Group Fired markers clear next round.";
    body.appendChild(tipRow);

    const weaponsTitle = document.createElement("div");
    weaponsTitle.style.cssText = sectionTitleStyle;
    weaponsTitle.textContent = "Group Weapons";
    body.appendChild(weaponsTitle);

    if (groupData.weapons.length) {
      for (const weapon of groupData.weapons) {
        const row = document.createElement("div");
        row.style.display = "grid";
        row.style.gridTemplateColumns = "1fr auto";
        row.style.gap = "4px";
        row.style.alignItems = "center";
        row.style.padding = "4px 6px";
        row.style.background = "#18212b";
        row.style.border = "1px solid #2c3947";
        row.style.borderRadius = "6px";

        const label = document.createElement("div");
        label.style.minWidth = "0";
        label.innerHTML = `<div style="font-weight:700;font-size:12px;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${weapon.name}</div><div style="font-size:10px;line-height:1.1;color:#9db0c3;margin-top:1px;">Batch attack for ${groupData.readyTokens.length} ready token${groupData.readyTokens.length === 1 ? "" : "s"}</div>`;
        row.appendChild(label);

        const attackBtn = makeActionButton("GA");
        attackBtn.dataset.action = "group-attack";
        attackBtn.dataset.weaponName = weapon.name;
        row.appendChild(attackBtn);

        body.appendChild(row);
      }
    } else if (groupData.hasStandardAttack) {
      const row = document.createElement("div");
      row.style.display = "grid";
      row.style.gridTemplateColumns = "1fr auto";
      row.style.gap = "4px";
      row.style.alignItems = "center";
      row.style.padding = "4px 6px";
      row.style.background = "#18212b";
      row.style.border = "1px solid #2c3947";
      row.style.borderRadius = "6px";

      const label = document.createElement("div");
      label.innerHTML = `<div style="font-weight:700;font-size:12px;line-height:1.1;">Standard Attack</div><div style="font-size:10px;line-height:1.1;color:#9db0c3;margin-top:1px;">Batch attack for ${groupData.readyTokens.length} ready token${groupData.readyTokens.length === 1 ? "" : "s"}</div>`;
      row.appendChild(label);

      const attackBtn = makeActionButton("GA");
      attackBtn.dataset.action = "group-attack";
      row.appendChild(attackBtn);
      body.appendChild(row);
    } else {
      const note = document.createElement("div");
      note.style.cssText = "padding:4px 6px;background:#18212b;border:1px solid #2c3947;border-radius:6px;font-size:11px;line-height:1.15;color:#c7d1db;";
      note.textContent = "No direct-fire weapons available for Group Attack. AOE weapons are not included in Group HUD v1.";
      body.appendChild(note);
    }
  } else {
    const weaponsTitle = document.createElement("div");
    weaponsTitle.style.cssText = sectionTitleStyle;
    weaponsTitle.textContent = "Weapons";
    body.appendChild(weaponsTitle);

    const weapons = actor.items.filter(item => item.type === "weapon");

    if (weapons.length) {
      for (const weapon of weapons) {
        const row = document.createElement("div");
        row.style.display = "grid";
        row.style.gridTemplateColumns = "1fr auto auto";
        row.style.gap = "4px";
        row.style.alignItems = "center";
        row.style.padding = "4px 6px";
        row.style.background = "#18212b";
        row.style.border = "1px solid #2c3947";
        row.style.borderRadius = "6px";

        const label = document.createElement("div");
        label.style.minWidth = "0";
        label.innerHTML = `<div style="font-weight:700;font-size:12px;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${weapon.name}</div><div style="font-size:10px;line-height:1.1;color:#9db0c3;margin-top:1px;">${getDropTrooperHudAmmoText(weapon)}</div>`;
        row.appendChild(label);

        const attackBtn = makeActionButton("A");
        attackBtn.dataset.action = "attack";
        attackBtn.dataset.itemId = weapon.id;

        const reloadBtn = makeActionButton("R");
        reloadBtn.dataset.action = "reload";
        reloadBtn.dataset.itemId = weapon.id;
        reloadBtn.disabled = !(weapon.system?.ammo !== undefined && weapon.system?.magSize !== undefined && String(weapon.system?.magSize).trim() !== "");
        reloadBtn.style.opacity = reloadBtn.disabled ? "0.5" : "1";

        row.appendChild(attackBtn);
        row.appendChild(reloadBtn);
        body.appendChild(row);
      }
    } else {
      const row = document.createElement("div");
      row.style.display = "grid";
      row.style.gridTemplateColumns = "1fr auto";
      row.style.gap = "4px";
      row.style.alignItems = "center";
      row.style.padding = "4px 6px";
      row.style.background = "#18212b";
      row.style.border = "1px solid #2c3947";
      row.style.borderRadius = "6px";

      const label = document.createElement("div");
      label.innerHTML = `<div style="font-weight:700;font-size:12px;line-height:1.1;">Standard Attack</div>`;
      row.appendChild(label);

      const attackBtn = makeActionButton("A");
      attackBtn.dataset.action = "attack";

      row.appendChild(attackBtn);
      body.appendChild(row);
    }

    const abilities = actor.items.filter(item => item.type === "ability");

    if (abilities.length) {
      const abilitiesTitle = document.createElement("div");
      abilitiesTitle.style.cssText = sectionTitleStyle + "margin-top:2px;";
      abilitiesTitle.textContent = "Abilities";
      body.appendChild(abilitiesTitle);

      for (const ability of abilities) {
        const row = document.createElement("div");
        row.style.display = "grid";
        row.style.gridTemplateColumns = "1fr auto";
        row.style.gap = "4px";
        row.style.alignItems = "center";
        row.style.padding = "4px 6px";
        row.style.background = "#18212b";
        row.style.border = "1px solid #2c3947";
        row.style.borderRadius = "6px";

        const current = Number(ability.system?.pool?.value) || 0;
        const max = Number(ability.system?.pool?.max) || 0;
        const status = max > 0 ? `Uses ${current} / ${max}` : (ability.system?.specialType === "sensorSweep" ? "Scan Ready" : (ability.system?.specialType === "flightPack" ? "Flight Ready" : "Ready"));

        const label = document.createElement("div");
        label.style.minWidth = "0";
        label.innerHTML = `<div style="font-weight:700;font-size:12px;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${ability.name}</div><div style="font-size:10px;line-height:1.1;color:#9db0c3;margin-top:1px;">${status}</div>`;
        row.appendChild(label);

        const useBtn = makeActionButton("Use");
        useBtn.style.minWidth = "42px";
        useBtn.dataset.action = "ability";
        useBtn.dataset.itemId = ability.id;

        row.appendChild(useBtn);
        body.appendChild(row);
      }
    }

    const utilityRow = document.createElement("div");
    utilityRow.style.display = "grid";
    utilityRow.style.gridTemplateColumns = "1fr 1fr 1fr";
    utilityRow.style.gap = "4px";
    utilityRow.style.marginTop = "2px";

    const braceBtn = makeActionButton("Brace");
    braceBtn.dataset.action = "brace";
    braceBtn.style.height = "26px";
    braceBtn.style.padding = "0 6px";

    const aimBtn = makeActionButton("Aim");
    aimBtn.dataset.action = "aim";
    aimBtn.style.height = "26px";
    aimBtn.style.padding = "0 6px";

    const rollsBtn = makeActionButton("Rolls");
    rollsBtn.style.height = "26px";
    rollsBtn.style.padding = "0 6px";

    utilityRow.appendChild(braceBtn);
    utilityRow.appendChild(aimBtn);
    utilityRow.appendChild(rollsBtn);
    body.appendChild(utilityRow);

    const rollsPanel = document.createElement("div");
    rollsPanel.style.display = "none";
    rollsPanel.style.gap = "4px";
    rollsPanel.style.marginTop = "2px";
    rollsPanel.style.padding = "6px";
    rollsPanel.style.background = "#18212b";
    rollsPanel.style.border = "1px solid #2c3947";
    rollsPanel.style.borderRadius = "6px";

    const makeRollsSection = (title, entries, action) => {
      const section = document.createElement("div");
      section.style.display = "grid";
      section.style.gap = "4px";

      const heading = document.createElement("div");
      heading.style.cssText = "font-size:10px;color:#9db0c3;text-transform:uppercase;letter-spacing:0.45px;font-weight:700;line-height:1.1;";
      heading.textContent = title;
      section.appendChild(heading);

      const grid = document.createElement("div");
      grid.style.display = "grid";
      grid.style.gridTemplateColumns = "1fr 1fr";
      grid.style.gap = "4px";

      for (const entry of entries) {
        const btn = makeActionButton(entry.label);
        btn.dataset.action = action;
        btn.dataset.rollKey = entry.key;
        btn.style.height = "24px";
        btn.style.padding = "0 6px";
        btn.style.minWidth = "0";
        grid.appendChild(btn);
      }

      section.appendChild(grid);
      return section;
    };

    const attributeEntries = [
      { key: "strength", label: "STR" },
      { key: "agility", label: "AGI" },
      { key: "perception", label: "PER" },
      { key: "tech", label: "TEC" },
      { key: "will", label: "WIL" }
    ];

    const skillEntries = [
      { key: "shooting", label: "Shooting" },
      { key: "heavyWeapons", label: "Heavy Wpn" },
      { key: "melee", label: "Melee" },
      { key: "maneuvering", label: "Maneuver" },
      { key: "recon", label: "Recon" },
      { key: "sensors", label: "Sensors" },
      { key: "electronics", label: "Electronics" },
      { key: "engineering", label: "Engineering" },
      { key: "droneControl", label: "Drone Ctrl" },
      { key: "command", label: "Command" },
      { key: "discipline", label: "Discipline" },
      { key: "survival", label: "Survival" }
    ];

    rollsPanel.appendChild(makeRollsSection("Attributes", attributeEntries, "attribute-roll"));
    rollsPanel.appendChild(makeRollsSection("Skills", skillEntries, "skill-roll"));
    body.appendChild(rollsPanel);

    rollsBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const isOpen = rollsPanel.style.display === "grid";
      rollsPanel.style.display = isOpen ? "none" : "grid";
    });
  }

  hud.appendChild(body);
  document.body.appendChild(hud);

  hud.querySelectorAll("button[data-action]").forEach(button => {
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const action = button.dataset.action;

      if (action === "group-attack") {
        await runDropTrooperGroupHudAttack(canvas.tokens.controlled.filter(tokenLike => tokenLike?.actor), button.dataset.weaponName || null);
      } else {
        const itemId = button.dataset.itemId || null;
        const rollKey = button.dataset.rollKey || null;
        await runDropTrooperHudAction(actor, action, itemId, rollKey);
      }

      renderDropTrooperHud();
    });
  });

  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  const onMouseMove = (event) => {
    if (!isDragging) return;
    hud.style.left = `${event.clientX - dragOffsetX}px`;
    hud.style.top = `${event.clientY - dragOffsetY}px`;
  };

  const onMouseUp = () => {
    if (!isDragging) return;
    isDragging = false;

    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);

    document.body.style.userSelect = "";

    localStorage.setItem("dropTrooperHudLeft", hud.style.left);
    localStorage.setItem("dropTrooperHudTop", hud.style.top);
  };

  hud.addEventListener("mousedown", (event) => {
    if (event.target.closest("button")) return;

    isDragging = true;
    dragOffsetX = event.clientX - hud.offsetLeft;
    dragOffsetY = event.clientY - hud.offsetTop;

    document.body.style.userSelect = "none";

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);

    event.preventDefault();
  });
}


function isDropTrooperHealthTrackedActor(actor) {
  if (!actor) return false;
  if (!["trooper", "npc", "drone"].includes(String(actor.type || ""))) return false;
  return foundry.utils.hasProperty(actor, "system.health.value");
}

function getDropTrooperCanvasTokensForActor(actor) {
  if (!canvas?.ready || !actor) return [];
  const actorId = actor.id;
  return (canvas.tokens?.placeables || []).filter(token => {
    if (!token?.actor) return false;
    if (token.actor === actor) return true;
    if (token.actor?.id && token.actor.id === actorId) return true;
    if (token.document?.actorId && token.document.actorId === actorId) return true;
    return false;
  });
}

function isDropTrooperActorDefeated(actor) {
  const healthValue = Number(actor?.system?.health?.value);
  return Number.isFinite(healthValue) && healthValue <= 0;
}

async function playDropTrooperDefeatSound() {
  for (const src of DROP_TROOPER_DEFEAT_SOUND_CANDIDATES) {
    try {
      await foundry.audio.AudioHelper.preloadSound(src);
      foundry.audio.AudioHelper.play({
        src,
        volume: 0.9,
        loop: false,
        autoplay: true,
        channel: "interface"
      }, true);
      return true;
    } catch (err) {
      console.warn(`Drop Trooper | Defeat sound failed for ${src}`, err);
    }
  }

  return false;
}

async function syncDropTrooperDefeatStateForActor(actor, { playSound = false } = {}) {
  if (!game.user?.isGM) return;
  if (!isDropTrooperHealthTrackedActor(actor)) return;

  const shouldBeDefeated = isDropTrooperActorDefeated(actor);
  const canvasTokens = getDropTrooperCanvasTokensForActor(actor);
  let changedToDefeated = false;

  for (const token of canvasTokens) {
    const tokenActor = token.actor;
    if (!tokenActor?.toggleStatusEffect) continue;

    const hasStatus = token.document?.hasStatusEffect?.(DROP_TROOPER_DEFEATED_STATUS_ID) ?? false;
    if (shouldBeDefeated && !hasStatus) {
      await tokenActor.toggleStatusEffect(DROP_TROOPER_DEFEATED_STATUS_ID, { active: true, overlay: true });
      changedToDefeated = true;
    } else if (!shouldBeDefeated && hasStatus) {
      await tokenActor.toggleStatusEffect(DROP_TROOPER_DEFEATED_STATUS_ID, { active: false, overlay: true });
    }

    const combatant = token.combatant || token.document?.combatant;
    if (combatant && combatant.defeated !== shouldBeDefeated) {
      await combatant.update({ defeated: shouldBeDefeated });
    }
  }

  if (playSound && changedToDefeated) {
    await playDropTrooperDefeatSound();
  }
}

async function syncDropTrooperDefeatStatesOnCanvas() {
  if (!game.user?.isGM) return;
  const actors = new Set();

  for (const token of canvas?.tokens?.placeables || []) {
    if (isDropTrooperHealthTrackedActor(token?.actor)) actors.add(token.actor);
  }

  for (const actor of actors) {
    await syncDropTrooperDefeatStateForActor(actor, { playSound: false });
  }
}


Hooks.once("init", function () {
  console.log("Drop Trooper | System Initializing");

  const hasDefeatedStatus = (CONFIG.statusEffects || []).some(effect => {
    const effectId = effect?.id || effect?._id;
    return effectId === DROP_TROOPER_DEFEATED_STATUS_ID;
  });

  if (!hasDefeatedStatus) {
    CONFIG.statusEffects.push({
      id: DROP_TROOPER_DEFEATED_STATUS_ID,
      name: DROP_TROOPER_DEFEATED_STATUS_NAME,
      img: DROP_TROOPER_DEFEATED_STATUS_ICON
    });
  }

  Actors.registerSheet("drop-trooper", DropTrooperSheet, {
    types: ["trooper", "npc", "drone"],
    makeDefault: true
  });

  Items.unregisterSheet("core", ItemSheet);

  Items.registerSheet("drop-trooper", DropTrooperWeaponSheet, {
    types: ["weapon", "ability"],
    makeDefault: true
  });
});

Hooks.on("getSceneControlButtons", controls => {
  const tokenControls = controls?.tokens;
  if (!tokenControls?.tools) return;

  tokenControls.tools.dropTrooperRequestRoll = {
    name: "dropTrooperRequestRoll",
    title: "Drop Trooper Request Roll",
    icon: "fas fa-dice-d20",
    order: Object.keys(tokenControls.tools).length,
    button: true,
    visible: game.user?.isGM,
    onChange: () => {
      openDropTrooperRollRequestDialog();
    }
  };
});

Hooks.on("renderChatMessage", (message, html) => {
  const requestData = message.getFlag("drop-trooper", "rollRequest");
  if (!requestData) return;

  const root = html?.[0] || html;
  if (!root?.querySelectorAll) return;

  root.querySelectorAll(".dt-request-roll-btn").forEach(button => {
    const { actor } = getDropTrooperRequestedRollTarget(requestData.sceneId, requestData.tokenId, requestData.actorId);
    const canRoll = canUserResolveDropTrooperRequestedRoll(actor, game.user);
    const rollLabel = getDropTrooperRequestedRollLabel(requestData.rollType, requestData.rollKey);

    if (!canRoll) {
      button.disabled = true;
      button.textContent = "Waiting for owner / GM";
      button.style.opacity = "0.55";
      button.style.cursor = "default";
      return;
    }

    button.addEventListener("click", async event => {
      event.preventDefault();
      event.stopPropagation();

      if (button.dataset.dtRolling === "1") return;
      button.dataset.dtRolling = "1";
      button.disabled = true;
      button.textContent = "Rolling...";

      try {
        const resolved = await executeDropTrooperRequestedRoll(requestData);
        if (resolved) {
          button.textContent = "Rolled";
          button.style.opacity = "0.7";
          button.style.cursor = "default";
        } else {
          button.disabled = false;
          button.dataset.dtRolling = "0";
          button.textContent = `Roll ${rollLabel}`;
        }
      } catch (err) {
        console.error("Drop Trooper | Requested roll failed", err);
        ui.notifications.error(`Requested roll failed: ${err.message}`);
        button.disabled = false;
        button.dataset.dtRolling = "0";
        button.textContent = `Roll ${rollLabel}`;
      }
    }, { once: true });
  });
});

Hooks.on("chatMessage", (chatLog, messageText, chatData) => {
  const trimmed = String(messageText ?? "").trim();
  if (!trimmed.startsWith("/dt-")) return true;
  return handleDropTrooperNpcChatCommand(trimmed);
});

Hooks.on("controlToken", () => {
  renderDropTrooperHud();
  queueDropTrooperSmokeOcclusionRefresh();
});

Hooks.on("updateToken", () => {
  renderDropTrooperHud();
  queueDropTrooperSmokeOcclusionRefresh();
});

Hooks.on("updateActor", (actor, changed) => {
  renderDropTrooperHud();

  if (!game.user?.isGM) return;
  if (!foundry.utils.hasProperty(changed, "system.health.value")) return;

  syncDropTrooperDefeatStateForActor(actor, { playSound: true }).catch(err => {
    console.warn("Drop Trooper | Failed to sync defeated state", err);
  });
});

Hooks.on("createItem", () => {
  renderDropTrooperHud();
});

Hooks.on("updateItem", () => {
  renderDropTrooperHud();
});

Hooks.on("deleteItem", () => {
  renderDropTrooperHud();
});

Hooks.on("canvasReady", () => {
  syncDropTrooperDefeatStatesOnCanvas().catch(err => {
    console.warn("Drop Trooper | Failed to sync defeated states on canvas", err);
  });
  queueDropTrooperSmokeOcclusionRefresh();
});

Hooks.on("createToken", tokenDocument => {
  if (game.user?.isGM) {
    syncDropTrooperDefeatStateForActor(tokenDocument?.actor, { playSound: false }).catch(err => {
      console.warn("Drop Trooper | Failed to sync defeated state for new token", err);
    });
  }
  queueDropTrooperSmokeOcclusionRefresh();
});

Hooks.on("updateCombat", (combat, changed) => {
  if (!game.user?.isGM) return;
  if (!changed || changed.round === undefined) return;

  clearExpiredDropTrooperGroupMarkers(combat).catch(err => {
    console.warn("Drop Trooper | Failed to clear group attack markers", err);
  });

  const activeSheet = Object.values(ui.windows).find(app => app instanceof DropTrooperSheet);
  if (activeSheet && typeof activeSheet._removeExpiredSmokeTemplates === "function") {
    activeSheet._removeExpiredSmokeTemplates(combat).catch(err => {
      console.warn("Drop Trooper | Failed to remove expired smoke templates", err);
    });
  } else if (canvas?.scene) {
    const templates = canvas.templates?.placeables || [];
    const expiredIds = templates
      .filter(template => {
        const smokeData = template.document?.getFlag("drop-trooper", "smokeData");
        if (!smokeData) return false;
        if (smokeData.combatId && smokeData.combatId !== combat.id) return false;
        const removeAtRound = Number(smokeData.removeAtRound);
        return Number.isFinite(removeAtRound) && (Number(combat.round) || 0) >= removeAtRound;
      })
      .map(template => template.id);

    if (expiredIds.length > 0) {
      canvas.scene.deleteEmbeddedDocuments("MeasuredTemplate", expiredIds).catch(err => {
        console.warn("Drop Trooper | Failed to remove expired smoke templates", err);
      });
    }
  }
});

Hooks.on("deleteCombat", (combat) => {
  if (!game.user?.isGM || !canvas?.scene) return;
  clearExpiredDropTrooperGroupMarkers({ id: combat?.id, round: Number.MAX_SAFE_INTEGER }).catch(err => {
    console.warn("Drop Trooper | Failed to clear group attack markers after combat", err);
  });
});

Hooks.on("canvasReady", () => {
  renderDropTrooperHud();
});

Hooks.on("deleteToken", () => {
  renderDropTrooperHud();
  queueDropTrooperSmokeOcclusionRefresh();
});

Hooks.on("renderActorSheet", () => {
  renderDropTrooperHud();
});

Hooks.on("createMeasuredTemplate", () => {
  queueDropTrooperSmokeOcclusionRefresh();
});

Hooks.on("updateMeasuredTemplate", () => {
  queueDropTrooperSmokeOcclusionRefresh();
});

Hooks.on("deleteMeasuredTemplate", () => {
  queueDropTrooperSmokeOcclusionRefresh();
});
