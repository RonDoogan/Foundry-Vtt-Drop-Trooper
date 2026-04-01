import { DamageService } from "./damage-service.mjs";

export class AttackWorkflowService {
  static async resolveTargetDamage(options = {}) {
    const {
      targetActor,
      targetToken = null,
      sourceActor = null,
      sourceToken = null,
      weaponName = "Weapon",
      attackLabel = "Attack",
      weaponTier = "Medium",
      damageTarget = "normal",
      preDefenseDamageDice = 0,
      attackMultiplier = 1,
      getDefenseData,
      rollDefense,
      consumeDefense,
      rollDamageDice,
      applyDamage,
      deferApprovalMessage = false
    } = options;

    if (!targetActor) {
      throw new Error("AttackWorkflowService.resolveTargetDamage requires a targetActor.");
    }

    if (typeof getDefenseData !== "function" || typeof rollDefense !== "function" || typeof rollDamageDice !== "function" || typeof applyDamage !== "function") {
      throw new Error("AttackWorkflowService.resolveTargetDamage requires workflow callback functions.");
    }

    const beforeIntegrity = Number(targetActor.system?.armor?.integrity?.value) || 0;
    const tracksHealth = foundry.utils.hasProperty(targetActor, "system.health.value");
    const beforeHealth = tracksHealth ? (Number(targetActor.system?.health?.value) || 0) : 0;

    const defenseData = getDefenseData(targetActor) || {};
    const defensePool = Math.max(0, Number(defenseData.totalDice) || 0);
    const defenseResult = await rollDefense(defensePool);

    if ((Number(defenseData.bonusDice) || 0) > 0 || (Number(defenseData.penaltyDice) || 0) > 0 || (Number(defenseData.braceMultiplier) || 1) > 1) {
      if (typeof consumeDefense === "function") {
        await consumeDefense(targetActor, defenseData);
      }
    }

    const armorTier = targetActor.system?.armor?.tier || "Medium";
    const defensePreview = DamageService.computeDamageFromRoll({
      preDefenseDamageDice,
      defenseSuccesses: Number(defenseResult?.successes) || 0,
      rawDamageTotal: 0,
      attackMultiplier,
      weaponTier,
      armorTier
    });

    const finalDamageDice = Math.max(0, Number(defensePreview.finalDamageDice) || 0);
    const damageRoll = await rollDamageDice(finalDamageDice);

    const resolvedDamage = DamageService.computeDamageFromRoll({
      preDefenseDamageDice,
      defenseSuccesses: Number(defenseResult?.successes) || 0,
      rawDamageTotal: Number(damageRoll?.total) || 0,
      attackMultiplier,
      weaponTier,
      armorTier
    });

    const applicationResult = await applyDamage(targetActor, resolvedDamage.finalAppliedDamage, {
      targetToken,
      sourceActor,
      sourceToken,
      weaponName,
      attackLabel,
      damageTarget,
      deferApprovalMessage
    });

    return {
      beforeIntegrity,
      beforeHealth,
      tracksHealth,
      defenseData,
      defensePool,
      defenseResult,
      preDefenseDamageDice,
      cancelledDice: resolvedDamage.cancelledDice,
      finalDamageDice: resolvedDamage.finalDamageDice,
      damageRoll,
      armorTier,
      tierMultiplier: resolvedDamage.tierMultiplier,
      tierLabel: resolvedDamage.tierLabel,
      finalAppliedDamage: resolvedDamage.finalAppliedDamage,
      applicationResult
    };
  }
}
