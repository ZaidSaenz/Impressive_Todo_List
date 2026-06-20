/* =========================================================
   LISTA ACTIVA DEL DISPOSITIVO

   Guarda qué lista debe abrirse automáticamente en este
   navegador. No guarda el código secreto.
   ========================================================= */

const STORAGE_KEY =
  "impressiveTodo.activeHousehold";


/* Guarda la lista seleccionada. */

export function saveActiveHousehold(household) {
  if (!household?.id || !household?.name) {
    throw new Error(
      "La información de la lista está incompleta."
    );
  }

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      id: household.id,
      name: household.name,
      joinCode: household.joinCode ?? null,
      role: household.role ?? "member"
    })
  );
}


/* Recupera la lista seleccionada anteriormente. */

export function getActiveHousehold() {
  const storedValue =
    localStorage.getItem(STORAGE_KEY);

  if (!storedValue) {
    return null;
  }

  try {
    const household = JSON.parse(storedValue);

    if (!household?.id || !household?.name) {
      clearActiveHousehold();
      return null;
    }

    return household;
  } catch {
    clearActiveHousehold();
    return null;
  }
}


/* Olvida la selección local. No elimina la lista remota. */

export function clearActiveHousehold() {
  localStorage.removeItem(STORAGE_KEY);
}