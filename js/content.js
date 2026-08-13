// Department Knowledge Base loader. Ships as data/content.json (the "admin/content layer").
// A locally-saved override (edited via Admin -> Content) takes precedence in this browser only.
import { getContentOverride } from "./store.js";

let cache = null;

export async function loadContent() {
  if (cache) return cache;
  const override = getContentOverride();
  if (override) {
    cache = override;
    return cache;
  }
  const res = await fetch("data/content.json");
  cache = await res.json();
  return cache;
}

export function invalidateContentCache() {
  cache = null;
}

export function findSource(content, sourceId) {
  return (content.meta.sourceUrls || []).find((s) => s.id === sourceId) || null;
}

export function findDomain(content, domainId) {
  return content.domains.find((d) => d.id === domainId) || null;
}

export function findActivity(content, domainId, activityId) {
  const domain = findDomain(content, domainId);
  if (!domain) return null;
  return domain.activities.find((a) => a.id === activityId) || null;
}

export function allActivitiesFlat(content) {
  const out = [];
  content.domains.forEach((d) => {
    d.activities.forEach((a) => out.push(Object.assign({ domainId: d.id, domainName: d.name }, a)));
  });
  return out;
}
