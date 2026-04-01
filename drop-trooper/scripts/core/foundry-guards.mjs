export function hasCanvasReady() {
  return !!globalThis.canvas?.ready;
}

export function getSafeActor(documentOrActor) {
  if (!documentOrActor) return null;
  return documentOrActor.actor || documentOrActor;
}

export function getSafeTokenDocument(tokenOrDocument) {
  if (!tokenOrDocument) return null;
  return tokenOrDocument.document || tokenOrDocument;
}

export function toFiniteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function toLowerKey(value, fallback = "") {
  const key = String(value ?? fallback).trim().toLowerCase();
  return key || fallback;
}
