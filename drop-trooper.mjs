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
    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find(".roll-shoot").click(this._onRollShoot.bind(this));
    html.find(".roll-defense").click(this._onRollDefense.bind(this));
    html.find(".roll-damage").click(this._onRollDamage.bind(this));
    html.find(".roll-skill").click(this._onRollSkill.bind(this));
    html.find(".roll-attribute").click(this._onRollAttribute.bind(this));
    html.find(".micro-missile-test").click(this._onMicroMissileTest.bind(this));
    html.find(".weapon-attack").click(this._onWeaponAttack.bind(this));
    html.find(".weapon-delete").click(this._onWeaponDelete.bind(this));
    html.find(".weapon-edit").click(this._onWeaponEdit.bind(this));
    html.find(".weapon-reload").click(this._onWeaponReload.bind(this));
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
    return this._getAoeType(weapon.system) === "cone" ? "Fire Cone" : "Fire Blast";
  }

  _getAoeType(data) {
    const rawType = String(data?.aoeType ?? "blast").trim().toLowerCase();
    return rawType === "cone" ? "cone" : "blast";
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
      let color = "#333";
      if (successOnSix && d === 6) color = "#2e8b57";

      diceHtml += `<span style="
        display:inline-block;
        width:30px;
        padding:6px;
        margin:2px;
        text-align:center;
        border-radius:6px;
        background:${color};
        color:white;
        font-weight:bold;
      ">${d}</span>`;
    }

    return diceHtml;
  }

  _formatMultiplier(multiplier) {
    if (Number.isInteger(multiplier)) return String(multiplier);
    return multiplier.toFixed(2).replace(/\.00$/, "");
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

  async _rollPool(label, dicePool, type = "skill") {
    const result = await this._rollDicePool(dicePool);
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
                <span class="dt-chat-strong">${dicePool}d6</span>
              </div>
              <div class="dt-chat-line">
                <span class="dt-chat-small">Successes</span><br>
                <span class="dt-chat-strong">${result.successes}</span>
              </div>
            </div>
            <div style="margin-top:8px;">${diceHtml}</div>
          </div>
        </div>
      </div>
    `;

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content
    });

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

      const defensePool = Number(targetActor.system.skills?.defense) || 0;
      const defenseResult = await this._rollDicePool(defensePool);

      const cancelledDice = Math.min(defenseResult.successes, zoneDamageDice);
      const finalDamageDice = Math.max(0, zoneDamageDice - cancelledDice);

      const damageRoll = await this._rollDamageDice(finalDamageDice);

      const armorTier = targetActor.system.armor?.tier || "Medium";
      const tierMultiplier = this._getTierMultiplier(weaponTier, armorTier);

      const finalAppliedDamage = Math.floor(damageRoll.total * tierMultiplier);
      const applicationResult = await this._applyDamageToActor(targetActor, finalAppliedDamage);

      html += `
        <div class="dt-chat-line" style="margin-top:10px; padding-top:10px; border-top:1px solid #2c3947;">
          <span class="dt-chat-strong">${targetToken.name}</span>
          <span class="dt-chat-small">(${Math.round(entry.distance)} ft)</span>
        </div>

        <div class="dt-chat-grid" style="margin-top:6px;">
          <div class="dt-chat-line">
            <span class="dt-chat-small">Defense</span><br>
            <span class="dt-chat-strong">${defenseResult.successes} success${defenseResult.successes === 1 ? "" : "es"}</span>
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

        <div class="dt-chat-grid" style="margin-top:6px;">
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
    const attackPool = Number(this.actor.system.skills?.heavyWeapons) || 0;
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

    if (attackPool <= 0) {
      ui.notifications.warn("Heavy Weapons Dice must be at least 1.");
      return false;
    }

    const point = await this._promptForCanvasPoint(`Click the ${weaponName} impact point on the map.`);
    if (!point) return false;

    const attackResult = await this._rollDicePool(attackPool);
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
            <div style="margin-top:8px;">${attackDiceHtml}</div>
            <div class="dt-chat-line" style="margin-top:8px;">
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

    return true;
  }

  async _onRollSkill(event) {
    const skillKey = event.currentTarget.dataset.skill;
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
      survival: "Survival"
    };

    const label = labelMap[skillKey] || "Skill";
    const dicePool = Number(this.actor.system.skills?.[skillKey]) || 0;

    await this._rollPool(label, dicePool, "skill");
  }

  async _onRollAttribute(event) {
    const attributeKey = event.currentTarget.dataset.attribute;
    const labelMap = {
      strength: "Strength",
      agility: "Agility",
      perception: "Perception",
      tech: "Tech",
      will: "Will"
    };

    const label = labelMap[attributeKey] || "Attribute";
    const dicePool = Number(this.actor.system.attributes?.[attributeKey]) || 0;

    await this._rollPool(label, dicePool, "attribute");
  }

  async _onRollShoot(event) {
    const shootPool = Number(this.actor.system.skills?.shooting) || 0;
    const baseDamage = Number(this.actor.system.weapon?.baseDamage) || 0;
    const weaponName = this.actor.system.weapon?.name || "Weapon";
    const weaponTier = this.actor.system.weapon?.tier || "Medium";

    if (shootPool <= 0) {
      ui.notifications.warn("Shooting Dice must be at least 1.");
      return;
    }

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

    const attackResult = await this._rollDicePool(shootPool);
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
            </div>
            <div style="margin-top:8px;">${attackDiceHtml}</div>
            <div class="dt-chat-line" style="margin-top:8px;">
              <span class="dt-chat-small">Outcome</span><br>
              <span class="dt-chat-outcome ${outcomeClass}">${outcome}</span>
            </div>
          </div>
    `;

    if (attackResult.successes >= 1) {
      const attackMods = this._getAttackDamageModifiers(attackResult.successes, baseDamage);
      const preDefenseDamageDice = attackMods.damageDice;

      const defensePool = Number(targetActor.system.skills?.defense) || 0;
      const defenseResult = await this._rollDicePool(defensePool);
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
            </div>
            <div style="margin-top:8px;">${defenseDiceHtml}</div>
            <div class="dt-chat-line" style="margin-top:8px;"><span class="dt-chat-small">Defense Successes</span><br><span class="dt-chat-strong">${defenseResult.successes}</span></div>
          </div>

          <div class="dt-chat-section">
            <h4>Damage</h4>
            <div class="dt-chat-grid">
              <div class="dt-chat-line"><span class="dt-chat-small">Weapon</span><br><span class="dt-chat-strong">${weaponName}</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Base Damage</span><br><span class="dt-chat-strong">${baseDamage}d6</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Pre-Defense Dice</span><br><span class="dt-chat-strong">${preDefenseDamageDice}d6</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Final Damage Dice</span><br><span class="dt-chat-strong">${finalDamageDice}d6</span></div>
            </div>
            <div style="margin-top:8px;">${damageDiceHtml}</div>
            <div class="dt-chat-grid" style="margin-top:8px;">
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
            <div class="dt-chat-line" style="margin-top:8px;"><span class="dt-chat-small">Result</span><br><span class="dt-chat-strong">${tierLabel}</span></div>
            <div class="dt-chat-line"><span class="dt-chat-small">Tier Multiplier</span><br><span class="dt-chat-strong">${this._formatMultiplier(tierMultiplier)}</span></div>
          </div>

          <div class="dt-chat-section">
            <h4>Applied Damage</h4>
            <div class="dt-chat-line"><span class="dt-chat-small">Final Applied Damage</span><br><span class="dt-chat-final">${scaledDamage}</span></div>
            <div class="dt-chat-grid" style="margin-top:8px;">
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
    const attackPool = Number(this.actor.system.skills?.[skillKey]) || 0;
    const baseDamage = Number(weapon.system?.baseDamage) || 0;
    const weaponName = weapon.name || "Weapon";
    const weaponTier = weapon.system?.tier || "Medium";

    const ammoState = this._getWeaponAmmoState(weapon);

    if (!this._validateWeaponAmmoState(weapon, ammoState)) return;

    if (attackPool <= 0) {
      ui.notifications.warn(`${weaponName}: attack dice must be at least 1.`);
      return;
    }

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

    const attackResult = await this._rollDicePool(attackPool);
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
              <div class="dt-chat-line"><span class="dt-chat-small">Weapon Tier</span><br><span class="dt-chat-strong">${weaponTier}</span></div>
            </div>
            <div style="margin-top:8px;">${attackDiceHtml}</div>
            <div class="dt-chat-line" style="margin-top:8px;">
              <span class="dt-chat-small">Outcome</span><br>
              <span class="dt-chat-outcome ${outcomeClass}">${outcome}</span>
            </div>
          </div>
    `;

    if (attackResult.successes >= 1) {
      const attackMods = this._getAttackDamageModifiers(attackResult.successes, baseDamage);
      const preDefenseDamageDice = attackMods.damageDice;

      const defensePool = Number(targetActor.system.skills?.defense) || 0;
      const defenseResult = await this._rollDicePool(defensePool);
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
            </div>
            <div style="margin-top:8px;">${defenseDiceHtml}</div>
            <div class="dt-chat-line" style="margin-top:8px;"><span class="dt-chat-small">Defense Successes</span><br><span class="dt-chat-strong">${defenseResult.successes}</span></div>
          </div>

          <div class="dt-chat-section">
            <h4>Damage</h4>
            <div class="dt-chat-grid">
              <div class="dt-chat-line"><span class="dt-chat-small">Weapon</span><br><span class="dt-chat-strong">${weaponName}</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Base Damage</span><br><span class="dt-chat-strong">${baseDamage}d6</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Pre-Defense Dice</span><br><span class="dt-chat-strong">${preDefenseDamageDice}d6</span></div>
              <div class="dt-chat-line"><span class="dt-chat-small">Final Damage Dice</span><br><span class="dt-chat-strong">${finalDamageDice}d6</span></div>
            </div>
            <div style="margin-top:8px;">${damageDiceHtml}</div>
            <div class="dt-chat-grid" style="margin-top:8px;">
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
            <div class="dt-chat-line" style="margin-top:8px;"><span class="dt-chat-small">Result</span><br><span class="dt-chat-strong">${tierLabel}</span></div>
            <div class="dt-chat-line"><span class="dt-chat-small">Tier Multiplier</span><br><span class="dt-chat-strong">${this._formatMultiplier(tierMultiplier)}</span></div>
          </div>

          <div class="dt-chat-section">
            <h4>Applied Damage</h4>
            <div class="dt-chat-line"><span class="dt-chat-small">Final Applied Damage</span><br><span class="dt-chat-final">${scaledDamage}</span></div>
            <div class="dt-chat-grid" style="margin-top:8px;">
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
    const aoeType = this._getAoeType(weapon.system);

    if (aoeType === "cone") {
      await this._onWeaponConeAttack(weapon);
      return;
    }

    await this._onWeaponBlastAttack(weapon);
  }

  async _onWeaponBlastAttack(weapon) {
    const skillKey = weapon.system?.skill || "heavyWeapons";
    const attackPool = Number(this.actor.system.skills?.[skillKey]) || 0;
    const weaponTier = weapon.system?.tier || "Medium";
    const weaponName = weapon.name || "AOE Weapon";
    const ammoState = this._getWeaponAmmoState(weapon);

    if (!this._validateWeaponAmmoState(weapon, ammoState)) return;

    if (attackPool <= 0) {
      ui.notifications.warn(`${weaponName}: attack dice must be at least 1.`);
      return;
    }

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

    const attackResult = await this._rollDicePool(attackPool);
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
              <div class="dt-chat-line"><span class="dt-chat-small">Ammo</span><br><span class="dt-chat-strong">${ammoDisplay}</span></div>
            </div>
            <div style="margin-top:8px;">${attackDiceHtml}</div>
            <div class="dt-chat-line" style="margin-top:8px;"><span class="dt-chat-small">Result</span><br><span class="dt-chat-strong">${attackResultText}</span></div>
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
    const attackPool = Number(this.actor.system.skills?.[skillKey]) || 0;
    const weaponTier = weapon.system?.tier || "Medium";
    const weaponName = weapon.name || "Cone Weapon";
    const ammoState = this._getWeaponAmmoState(weapon);

    if (!this._validateWeaponAmmoState(weapon, ammoState)) return;

    if (attackPool <= 0) {
      ui.notifications.warn(`${weaponName}: attack dice must be at least 1.`);
      return;
    }

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

    const attackResult = await this._rollDicePool(attackPool);
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
              <div class="dt-chat-line"><span class="dt-chat-small">Ammo</span><br><span class="dt-chat-strong">${ammoDisplay}</span></div>
            </div>
            <div style="margin-top:8px;">${attackDiceHtml}</div>
            <div class="dt-chat-line" style="margin-top:8px;"><span class="dt-chat-small">Result</span><br><span class="dt-chat-strong">${attackResultText}</span></div>
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

  async _onRollDefense(event) {
    const dicePool = Number(this.actor.system.skills?.defense) || 0;
    await this._rollPool("Defense", dicePool, "defense");
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
            <div style="margin-top:8px;">${diceHtml}</div>
            <div class="dt-chat-line" style="margin-top:8px;"><span class="dt-chat-small">Total Damage</span><br><span class="dt-chat-final">${roll.total}</span></div>
          </div>
        </div>
      </div>
    `;

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content
    });
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
    return "systems/drop-trooper/templates/actor/weapon-sheet.hbs";
  }

  getData() {
    const data = super.getData();
    data.system = this.item.system;
    return data;
  }
}

Hooks.once("init", function () {
  console.log("Drop Trooper | System Initializing");

  Actors.registerSheet("drop-trooper", DropTrooperSheet, {
    types: ["trooper", "npc", "drone"],
    makeDefault: true
  });

  Items.unregisterSheet("core", ItemSheet);

  Items.registerSheet("drop-trooper", DropTrooperWeaponSheet, {
    types: ["weapon"],
    makeDefault: true
  });
});
