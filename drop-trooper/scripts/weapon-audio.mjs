function getDropTrooperAudioHelper() {
  return foundry?.audio?.AudioHelper;
}

async function playDropTrooperAudioFromCandidates(candidates = [], label = "Sound") {
  const helper = getDropTrooperAudioHelper();
  if (!helper) return false;

  for (const src of candidates) {
    try {
      await helper.preloadSound(src);
      helper.play({
        src,
        volume: 0.9,
        loop: false,
        autoplay: true,
        channel: "interface"
      }, true);
      return true;
    } catch (err) {
      console.warn(`Drop Trooper | ${label} failed for ${src}`, err);
    }
  }

  return false;
}

async function playDropTrooperDefeatSound() {
  return playDropTrooperAudioFromCandidates(
    Array.from(globalThis.DROP_TROOPER_DEFEAT_SOUND_CANDIDATES || []),
    "Defeat sound"
  );
}

async function playDropTrooperCritSuccessSound() {
  return playDropTrooperAudioFromCandidates(
    Array.from(globalThis.DROP_TROOPER_CRIT_SUCCESS_SOUND_CANDIDATES || []),
    "Crit success sound"
  );
}

async function playDropTrooperRandomHitSound() {
  const candidates = Array.from(globalThis.DROP_TROOPER_HIT_SOUND_CANDIDATES || []);
  if (!candidates.length) return false;

  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  return playDropTrooperAudioFromCandidates(candidates, "Hit sound");
}

async function playDropTrooperEffectSound(soundPath, label = "Effect sound") {
  const helper = getDropTrooperAudioHelper();
  const src = String(soundPath ?? "").trim();
  if (!helper || !src) return false;

  try {
    await helper.preloadSound(src);
    helper.play({
      src,
      volume: 0.9,
      loop: false,
      autoplay: true,
      channel: "interface"
    }, true);
    return true;
  } catch (err) {
    console.warn(`Drop Trooper | ${label} failed for ${src}`, err);
    return false;
  }
}

async function playDropTrooperBlastSound(soundPath = globalThis.DROP_TROOPER_BLAST_SOUND_PATH) {
  return playDropTrooperEffectSound(soundPath, "Blast sound");
}

async function playDropTrooperConeSound(soundPath = globalThis.DROP_TROOPER_CONE_SOUND_PATH) {
  return playDropTrooperEffectSound(soundPath, "Cone sound");
}

globalThis.DropTrooperWeaponAudio = {
  playDropTrooperDefeatSound,
  playDropTrooperCritSuccessSound,
  playDropTrooperRandomHitSound,
  playDropTrooperEffectSound,
  playDropTrooperBlastSound,
  playDropTrooperConeSound
};
