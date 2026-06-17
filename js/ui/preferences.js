import { APP_CONFIG } from "../config.js";

const STORAGE_KEY = "impressiveTodo.preferences";

export function loadPreferences() {
  const fallback = {
    identityId: APP_CONFIG.defaultIdentity,
    themeId: APP_CONFIG.defaultTheme
  };

  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return {
      ...fallback,
      ...(stored && typeof stored === "object" ? stored : {})
    };
  } catch {
    return fallback;
  }
}

export function savePreferences(preferences) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
}

export function applyPreferences(preferences) {
  const identity = APP_CONFIG.identities.find(
    item => item.id === preferences.identityId
  ) ?? APP_CONFIG.identities[0];

  const theme = APP_CONFIG.themes.find(
    item => item.id === preferences.themeId
  ) ?? APP_CONFIG.themes[0];

  document.body.dataset.theme = theme.id;
  document.querySelector("#app-name").textContent = identity.name;
  document.querySelector("#app-subtitle").textContent = identity.subtitle;
  document.title = identity.name;
}

export function populateSettings(preferences) {
  const identitySelect = document.querySelector("#identity-select");
  const themeOptions = document.querySelector("#theme-options");

  identitySelect.innerHTML = APP_CONFIG.identities
    .map(identity => `
      <option value="${identity.id}">${identity.name}</option>
    `)
    .join("");

  themeOptions.innerHTML = APP_CONFIG.themes
    .map(theme => `
      <div class="theme-option">
        <input
          id="theme-${theme.id}"
          name="theme"
          type="radio"
          value="${theme.id}"
        >
        <label for="theme-${theme.id}">
          <span class="theme-swatch" style="--swatch: ${theme.swatch}"></span>
          ${theme.name}
        </label>
      </div>
    `)
    .join("");

  identitySelect.value = preferences.identityId;

  const selectedTheme = themeOptions.querySelector(
    `input[value="${preferences.themeId}"]`
  );

  if (selectedTheme) {
    selectedTheme.checked = true;
  }
}
