export class RollService {
  static async rollD6(formula) {
    const roll = await new Roll(formula).evaluate({ async: true });

    if (game?.dice3d) {
      try {
        await game.dice3d.showForRoll(roll, game.user, true, null, false);
      } catch (err) {
        console.warn("Drop Trooper | Dice So Nice visible roll failed", err);
      }
    }

    return roll;
  }
}
