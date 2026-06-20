/* =========================================================
   INTERFAZ DE ACCESO A LISTAS

   Conecta los formularios HTML con:
   - Supabase Auth anónimo.
   - Crear lista.
   - Entrar a lista.
   - Seleccionar una lista existente.
   ========================================================= */

import {
  ensureAnonymousSession
} from "../auth/supabase-auth.js";

import {
  createHousehold,
  joinHousehold,
  listMyHouseholds
} from "../services/household-service.js";

import {
  getActiveHousehold,
  saveActiveHousehold
} from "../state/active-household.js";


/* Lista recién creada, antes de pulsar "Abrir la lista". */

let pendingCreatedHousehold = null;


/* =========================================================
   AYUDANTES
   ========================================================= */

function getRequiredElement(selector) {
  const element = document.querySelector(selector);

  if (!element) {
    throw new Error(
      `No se encontró el elemento: ${selector}`
    );
  }

  return element;
}


function setMessage(message = "", type = "info") {
  const element =
    getRequiredElement("#list-access-message");

  element.textContent = message;
  element.dataset.type = type;
}


function setFormBusy(form, busy) {
  const controls =
    form.querySelectorAll("input, button");

  controls.forEach(control => {
    control.disabled = busy;
  });
}


/*
  Muestra únicamente uno de los paneles principales.
*/

function showAccessView(viewName) {
  const choicePanel =
    getRequiredElement("#access-choice-panel");

  const createForm =
    getRequiredElement("#create-list-form");

  const joinForm =
    getRequiredElement("#join-list-form");

  const createdPanel =
    getRequiredElement("#list-created-panel");

  choicePanel.hidden = viewName !== "choice";
  createForm.hidden = viewName !== "create";
  joinForm.hidden = viewName !== "join";
  createdPanel.hidden = viewName !== "created";

  setMessage("");
}


/* =========================================================
   ACTIVAR UNA LISTA
   ========================================================= */

function activateHousehold(household) {
  saveActiveHousehold(household);

  /*
    Coloca el identificador en el documento para que después
    otros módulos puedan saber qué lista está activa.
  */

  document.documentElement.dataset.householdId =
    household.id;

  const accessScreen =
    getRequiredElement("#list-access-screen");

  const appShell =
    document.querySelector(".app-shell");

  accessScreen.hidden = true;

  if (appShell) {
    appShell.inert = false;
  }


  /*
    Emite un evento global.

    El futuro repositorio de tareas escuchará este evento
    para cargar únicamente las tareas de esta lista.
  */

  window.dispatchEvent(
    new CustomEvent("household:selected", {
      detail: household
    })
  );

  console.log(
    "Lista activa:",
    household.name,
    household.id
  );
}


/* =========================================================
   LISTAS YA VINCULADAS AL DISPOSITIVO
   ========================================================= */

function renderExistingHouseholds(households) {
  const section =
    getRequiredElement("#existing-lists-section");

  const container =
    getRequiredElement("#existing-lists-container");

  container.replaceChildren();

  if (!households.length) {
    section.hidden = true;
    return;
  }

  section.hidden = false;

  households.forEach(household => {
    const button =
      document.createElement("button");

    button.type = "button";
    button.className = "existing-list-button";

    const name =
      document.createElement("strong");

    name.textContent = household.name;

    const role =
      document.createElement("small");

    role.textContent =
      household.role === "owner"
        ? "Propietario"
        : "Integrante";

    button.append(name, role);

    button.addEventListener("click", () => {
      activateHousehold(household);
    });

    container.append(button);
  });
}


/* =========================================================
   FORMULARIO: CREAR LISTA
   ========================================================= */

async function handleCreateList(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const formData = new FormData(form);

  const name =
    String(formData.get("listName") ?? "").trim();

  const displayName =
    String(formData.get("displayName") ?? "").trim();

  const secret =
    String(formData.get("secret") ?? "");

  const secretConfirmation =
    String(
      formData.get("secretConfirmation") ?? ""
    );


  if (secret !== secretConfirmation) {
    setMessage(
      "Los códigos secretos no coinciden.",
      "error"
    );

    return;
  }

  if (secret.length < 8) {
    setMessage(
      "El código secreto necesita al menos 8 caracteres.",
      "error"
    );

    return;
  }

  setFormBusy(form, true);
  setMessage("Creando la lista…");

  try {
    const household = await createHousehold({
      name,
      secret,
      displayName
    });

    pendingCreatedHousehold = {
      ...household,
      role: "owner"
    };

    getRequiredElement(
      "#created-list-code"
    ).textContent = household.joinCode;

    form.reset();

    showAccessView("created");

    setMessage(
      "La lista fue creada correctamente.",
      "success"
    );
  } catch (error) {
    console.error(error);

    setMessage(
      error.message || "No se pudo crear la lista.",
      "error"
    );
  } finally {
    setFormBusy(form, false);
  }
}


/* =========================================================
   FORMULARIO: ENTRAR A LISTA
   ========================================================= */

async function handleJoinList(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const formData = new FormData(form);

  const joinCode =
    String(formData.get("joinCode") ?? "")
      .trim()
      .toUpperCase();

  const secret =
    String(formData.get("secret") ?? "");

  const displayName =
    String(formData.get("displayName") ?? "").trim();

  setFormBusy(form, true);
  setMessage("Buscando la lista…");

  try {
    const household = await joinHousehold({
      joinCode,
      secret,
      displayName
    });

    form.reset();

    activateHousehold({
      ...household,
      joinCode,
      role: "member"
    });
  } catch (error) {
    console.error(error);

    setMessage(
      error.message ||
      "No se pudo entrar a la lista.",
      "error"
    );
  } finally {
    setFormBusy(form, false);
  }
}


/* =========================================================
   INICIALIZACIÓN
   ========================================================= */

export async function initializeHouseholdAccess() {
  const accessScreen =
    getRequiredElement("#list-access-screen");

  const appShell =
    document.querySelector(".app-shell");

  /*
    Evita que se pueda interactuar con la lista de fondo
    mientras se determina qué lista debe abrirse.
  */

  accessScreen.hidden = false;

  if (appShell) {
    appShell.inert = true;
  }

  setMessage("Preparando el dispositivo…");

  await ensureAnonymousSession();

  const households =
    await listMyHouseholds();

  const storedHousehold =
    getActiveHousehold();


  /*
    Si la lista almacenada todavía pertenece al usuario,
    se abre automáticamente.
  */

  if (storedHousehold) {
    const validStoredHousehold =
      households.find(
        household =>
          household.id === storedHousehold.id
      );

    if (validStoredHousehold) {
      activateHousehold(validStoredHousehold);
      return validStoredHousehold;
    }
  }


  /*
    Si el dispositivo solo tiene una lista vinculada,
    también puede abrirse automáticamente.
  */

  if (households.length === 1) {
    activateHousehold(households[0]);
    return households[0];
  }


  /*
    Con cero listas se muestran las opciones de creación.
    Con varias listas se muestran además los accesos rápidos.
  */

  renderExistingHouseholds(households);
  showAccessView("choice");


  /* Botones principales. */

  getRequiredElement(
    "#show-create-list"
  ).addEventListener("click", () => {
    showAccessView("create");

    document.querySelector(
      '#create-list-form input[name="listName"]'
    )?.focus();
  });

  getRequiredElement(
    "#show-join-list"
  ).addEventListener("click", () => {
    showAccessView("join");

    document.querySelector(
      '#join-list-form input[name="joinCode"]'
    )?.focus();
  });


  /* Botones Volver. */

  document
    .querySelectorAll("[data-access-back]")
    .forEach(button => {
      button.addEventListener("click", () => {
        showAccessView("choice");
      });
    });


  /* Formularios. */

  getRequiredElement(
    "#create-list-form"
  ).addEventListener(
    "submit",
    handleCreateList
  );

  getRequiredElement(
    "#join-list-form"
  ).addEventListener(
    "submit",
    handleJoinList
  );


  /* Continuar después de crear. */

  getRequiredElement(
    "#continue-to-list"
  ).addEventListener("click", () => {
    if (!pendingCreatedHousehold) {
      setMessage(
        "No se encontró la lista recién creada.",
        "error"
      );

      return;
    }

    activateHousehold(
      pendingCreatedHousehold
    );

    pendingCreatedHousehold = null;
  });

  return null;
}
/* =========================================================
   ABRIR SELECTOR DE LISTAS

   Permite mostrar nuevamente la pantalla de acceso para:
   - Seleccionar otra lista.
   - Crear una lista nueva.
   - Entrar a una lista existente.
   ========================================================= */

export async function openHouseholdSwitcher() {
  const accessScreen =
    getRequiredElement("#list-access-screen");

  const appShell =
    document.querySelector(".app-shell");

  /*
    Mostrar la pantalla de selección
    y bloquear temporalmente la aplicación.
  */

  accessScreen.hidden = false;

  if (appShell) {
    appShell.inert = true;
  }

  setMessage("Cargando tus listas…");

  try {
    /*
      Confirmar que el dispositivo mantiene
      una sesión anónima válida.
    */

    await ensureAnonymousSession();

    /*
      Consultar las listas vinculadas
      al usuario de este navegador.
    */

    const households =
      await listMyHouseholds();

    /*
      Mostrar las listas disponibles
      y las opciones para crear o entrar.
    */

    renderExistingHouseholds(households);
    showAccessView("choice");

    return households;
  } catch (error) {
    console.error(
      "No se pudieron cargar las listas:",
      error
    );

    setMessage(
      error.message ||
      "No se pudieron cargar tus listas.",
      "error"
    );

    throw error;
  }
}