function applyDropTrooperItemSheetPermissions(html, itemSheet) {
  if (game.user?.isGM) return;

  const actor = itemSheet?.item?.parent;
  if (!actor) return;

  const isDrone = String(actor.type || "") === "drone";
  if (!isDrone) return;

  html.find('input, select, textarea, button').prop('disabled', true);
}

function applyDropTrooperActorSheetPermissions(html, actorSheet) {
  if (game.user?.isGM) return;

  const actor = actorSheet?.actor;
  if (!actor) return;

  const isDrone = String(actor.type || "") === "drone";
  if (isDrone) {
    html.find('input, select, textarea').prop('disabled', true);
    return;
  }
}

globalThis.DropTrooperItemSheetHelpers = {
  applyDropTrooperItemSheetPermissions,
  applyDropTrooperActorSheetPermissions
};
