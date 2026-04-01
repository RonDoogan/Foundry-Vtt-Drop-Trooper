import { RollService } from "./roll-service.mjs";

export class AbilityService {
  static _buildDiceHtml(dieResults, successOnSix = false) {
    let diceHtml = "";

    for (const d of dieResults) {
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

  static _getNanoUses(actor) {
    const nano = actor?.system?.nanoRepair ?? {};
    if (Number.isFinite(Number(nano.uses))) return Math.max(0, Number(nano.uses));

    const legacyCombat = Number(nano.combatCurrentUses);
    const legacyField = Number(nano.fieldCurrentUses);

    if (Number.isFinite(legacyCombat) || Number.isFinite(legacyField)) {
      return Math.max(
        0,
        Number.isFinite(legacyCombat) ? legacyCombat : 0,
        Number.isFinite(legacyField) ? legacyField : 0
      );
    }

    return 1;
  }

  static async nanoRepair(actor) {
    if (!actor) return 0;

    const current = Number(actor.system?.armor?.integrity?.value) || 0;
    const max = Number(actor.system?.armor?.integrity?.max) || 0;
    const currentHealth = Number(actor.system?.health?.value) || 0;
    const maxHealth = Number(actor.system?.health?.max) || 0;
    const techDice =
      (Number(actor.system?.attributes?.tech) || 0) +
      (Number(actor.system?.skills?.engineering) || 0);
    const nanoUses = this._getNanoUses(actor);

    const healthMissing = Math.max(0, maxHealth - currentHealth);
    const integrityMissing = Math.max(0, max - current);

    if (healthMissing <= 0 && integrityMissing <= 0) {
      ui.notifications.info(`${actor.name} is already at full Health and Integrity.`);
      return 0;
    }

    if (nanoUses <= 0) {
      ui.notifications.warn(`${actor.name} has no Nano Repair uses remaining.`);
      return 0;
    }

    if (techDice <= 0) {
      ui.notifications.warn(`${actor.name} has no TEC + Engineering dice for Nano Repair.`);
      return 0;
    }

    // Stage 1: TEC roll, only 6s count as successes
    const techRoll = await RollService.rollD6(`${techDice}d6`);
    const techDieResults = techRoll.dice[0]?.results?.map(r => r.result) ?? [];
    const successes = techDieResults.filter(d => d === 6).length;

    // Stage 2: Repair roll = 1d6 base + 1d6 per success
    const repairDice = 1 + successes;
    const repairRoll = await RollService.rollD6(`${repairDice}d6`);
    const repairDieResults = repairRoll.dice[0]?.results?.map(r => r.result) ?? [];
    const totalRepair = Number(repairRoll.total) || 0;

    let remainingRepair = totalRepair;

    let healthApplied = 0;
    let newHealth = currentHealth;
    if (healthMissing > 0) {
      healthApplied = Math.min(remainingRepair, healthMissing);
      newHealth = currentHealth + healthApplied;
      remainingRepair -= healthApplied;
    }

    let integrityApplied = 0;
    let newValue = current;
    if (integrityMissing > 0) {
      integrityApplied = Math.min(remainingRepair, integrityMissing);
      newValue = current + integrityApplied;
      remainingRepair -= integrityApplied;
    }

    const appliedRepair = healthApplied + integrityApplied;
    const usesLeft = Math.max(0, nanoUses - 1);

    await actor.update({
      "system.health.value": newHealth,
      "system.armor.integrity.value": newValue,
      "system.nanoRepair.uses": usesLeft
    });

    const techDiceHtml = this._buildDiceHtml(techDieResults, true);
    const repairDiceHtml = this._buildDiceHtml(repairDieResults, false);

    const content = `
      <div class="dt-chat-card">
        <div class="dt-chat-header">
          <div class="dt-chat-title">${actor.name}</div>
          <div class="dt-chat-subtitle">Nano Repair</div>
        </div>
        <div class="dt-chat-body">

          <div class="dt-chat-section">
            <div class="dt-chat-grid">
              <div class="dt-chat-line">
                <span class="dt-chat-small">TEC + ENG Roll</span><br>
                <span class="dt-chat-strong">${techDice}d6</span>
              </div>
              <div class="dt-chat-line">
                <span class="dt-chat-small">Successes</span><br>
                <span class="dt-chat-strong">${successes}</span>
              </div>
            </div>
            <div style="margin-top:8px;">${techDiceHtml}</div>
          </div>

          <div class="dt-chat-section">
            <div class="dt-chat-grid">
              <div class="dt-chat-line">
                <span class="dt-chat-small">Repair Roll</span><br>
                <span class="dt-chat-strong">${repairDice}d6</span>
              </div>
              <div class="dt-chat-line">
                <span class="dt-chat-small">Total Repair</span><br>
                <span class="dt-chat-strong">${totalRepair}</span>
              </div>
              <div class="dt-chat-line">
                <span class="dt-chat-small">Applied Repair</span><br>
                <span class="dt-chat-final">${appliedRepair}</span>
              </div>
            </div>
            <div style="margin-top:8px;">${repairDiceHtml}</div>
          </div>

          <div class="dt-chat-section">
            <div class="dt-chat-grid">
              <div class="dt-chat-line">
                <span class="dt-chat-small">Health</span><br>
                <span class="dt-chat-strong">${currentHealth} → ${newHealth}</span>
              </div>
              <div class="dt-chat-line">
                <span class="dt-chat-small">Integrity</span><br>
                <span class="dt-chat-strong">${current} → ${newValue}</span>
              </div>
              <div class="dt-chat-line">
                <span class="dt-chat-small">Uses Left</span><br>
                <span class="dt-chat-strong">${usesLeft}</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    `;

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content
    });

    return appliedRepair;
  }

  static async refreshCombatNanoFromCombat(_combat) {
    return;
  }

  static async refreshFieldNanoFromCombat(_combat) {
    return;
  }
}
