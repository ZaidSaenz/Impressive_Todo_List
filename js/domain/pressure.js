import { APP_CONFIG } from "../config.js";

const DAY_IN_MS = 86_400_000;

export function getAgeInDays(createdAt) {
  const created = new Date(createdAt);

  if (Number.isNaN(created.getTime())) {
    return 0;
  }

  const difference = Date.now() - created.getTime();
  return Math.max(0, Math.floor(difference / DAY_IN_MS));
}

export function getPressureLevel(createdAt) {
  const age = getAgeInDays(createdAt);
  const rules = APP_CONFIG.pressure;

  if (age <= rules.freshMaxDays) {
    return "fresh";
  }

  if (age <= rules.attentionMaxDays) {
    return "attention";
  }

  if (age <= rules.urgentMaxDays) {
    return "urgent";
  }

  return "critical";
}

export function formatAge(createdAt) {
  const age = getAgeInDays(createdAt);

  if (age === 0) {
    return "hoy";
  }

  if (age === 1) {
    return "hace 1 día";
  }

  return `hace ${age} días`;
}
