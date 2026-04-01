function getAbilityModeLabel(ability) {
  return ability?.system?.abilityType === "special" ? "Special" : "Skill";
}

function getAbilityLinkedSkillLabel(ability, helpers = {}) {
  if (ability?.system?.abilityType !== "skill") return "—";
  const getSkillLabel = typeof helpers.getSkillLabel === "function"
    ? helpers.getSkillLabel
    : (key) => String(key || "—");
  return getSkillLabel(ability?.system?.linkedSkill);
}

function getAbilityPoolDisplay(ability) {
  const current = Number(ability?.system?.pool?.value) || 0;
  const max = Number(ability?.system?.pool?.max) || 0;
  if (max <= 0) return "—";
  return `${current} / ${max}`;
}

function shouldShowAbilityReset(ability) {
  return (Number(ability?.system?.pool?.max) || 0) > 0;
}

globalThis.DropTrooperAbilityHelpers = {
  getAbilityModeLabel,
  getAbilityLinkedSkillLabel,
  getAbilityPoolDisplay,
  shouldShowAbilityReset
};
