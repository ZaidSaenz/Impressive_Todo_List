/* =========================================================
   APLICACIÓN PRINCIPAL
   ========================================================= */

import {
  initializeHouseholdAccess,
  openHouseholdSwitcher
} from "./ui/household-access.js";

import {
  applyPreferences,
  loadPreferences,
  populateSettings,
  savePreferences
} from "./ui/preferences.js";

import {
  initializeTaskForm
} from "./ui/task-form.js";

import {
  renderTasks
} from "./ui/task-list.js";

import {
  completeTask,
  createTask,
  loadTasks,
  subscribeToTasks
} from "./services/task-service.js";


/* =========================================================
   ESTADO DE LA APLICACIÓN
   ========================================================= */

let preferences = loadPreferences();
let tasks = [];
let activeHousehold = null;
let stopTaskSubscription = null;


/* =========================================================
   PREFERENCIAS VISUALES
   ========================================================= */

applyPreferences(preferences);
populateSettings(preferences);


/* =========================================================
   FORMULARIO DE TAREAS
   ========================================================= */

initializeTaskForm({
  async onCreateTask(task) {
    if (!activeHousehold) {
      throw new Error(
        "Primero debes abrir una lista."
      );
    }

    await createTask(
      activeHousehold.id,
      task
    );

    await refreshTasks();
  }
});


/* =========================================================
   CONFIGURACIÓN Y PRIMER RENDER
   ========================================================= */

initializeSettings();
render();


/* =========================================================
   RENDERIZAR TAREAS
   ========================================================= */

function render() {
  renderTasks(tasks, {
    onCompleteTask(taskId) {
      void handleCompleteTask(taskId);
    }
  });
}


/* =========================================================
   CARGAR TAREAS DE SUPABASE
   ========================================================= */

async function refreshTasks() {
  if (!activeHousehold) {
    tasks = [];
    render();
    return;
  }

  const householdId = activeHousehold.id;

  try {
    const loadedTasks =
      await loadTasks(householdId);

    /*
      Evita mostrar resultados de otra lista
      si el usuario cambió durante la consulta.
    */

    if (
      activeHousehold?.id !== householdId
    ) {
      return;
    }

    tasks = loadedTasks;
    render();

    console.log(
      "Tareas cargadas:",
      tasks.length
    );
  } catch (error) {
    console.error(
      "No se pudieron cargar las tareas:",
      error
    );
  }
}


/* =========================================================
   COMPLETAR UNA TAREA
   ========================================================= */

async function handleCompleteTask(taskId) {
  if (!activeHousehold) {
    return;
  }

  const previousTasks = tasks;

  /*
    Actualización visual inmediata.
  */

  tasks = tasks.map(task => (
    task.id === taskId
      ? {
          ...task,
          status: "completed",
          completedAt:
            new Date().toISOString()
        }
      : task
  ));

  render();

  try {
    await completeTask(
      activeHousehold.id,
      taskId
    );

    await refreshTasks();
  } catch (error) {
    /*
      Si Supabase falla, restaura el estado anterior.
    */

    tasks = previousTasks;
    render();

    console.error(error);

    window.alert(
      error.message ||
      "No se pudo completar la tarea."
    );
  }
}


/* =========================================================
   ACTUALIZAR NOMBRE DE LA LISTA EN CONFIGURACIÓN
   ========================================================= */

function updateHouseholdName(household) {
  const householdNameElement =
    document.querySelector(
      "#settings-household-name"
    );

  if (!householdNameElement) {
    return;
  }

  householdNameElement.textContent =
    household?.name ||
    "Sin lista seleccionada";
}


/* =========================================================
   CAMBIAR O ABRIR UNA LISTA
   ========================================================= */

async function selectHousehold(household) {
  if (!household?.id) {
    console.error(
      "La lista seleccionada no tiene un identificador válido."
    );

    return;
  }

  activeHousehold = household;

  /*
    Mostrar la lista activa dentro
    del apartado de configuración.
  */

  updateHouseholdName(household);

  /*
    Detener la suscripción Realtime
    de la lista anterior.
  */

  if (stopTaskSubscription) {
    stopTaskSubscription();
    stopTaskSubscription = null;
  }

  /*
    Cargar las tareas de la lista seleccionada.
  */

  await refreshTasks();

  /*
    Escuchar cambios desde otros dispositivos.
  */

  stopTaskSubscription =
    subscribeToTasks(
      household.id,
      () => {
        void refreshTasks();
      }
    );

  console.log(
    "Lista de tareas conectada:",
    household.name
  );
}


/*
  household-access.js emite este evento
  cuando se selecciona una lista.
*/

window.addEventListener(
  "household:selected",
  event => {
    void selectHousehold(
      event.detail
    );
  }
);


/* =========================================================
   CONFIGURACIÓN VISUAL
   ========================================================= */

function initializeSettings() {
  const dialog =
    document.querySelector(
      "#settings-dialog"
    );

  const form =
    document.querySelector(
      "#settings-form"
    );

  const openButton =
    document.querySelector(
      "#open-settings-button"
    );

  const closeButton =
    document.querySelector(
      "#close-settings-button"
    );

  const changeListButton =
    document.querySelector(
      "#change-list-button"
    );

  if (
    !dialog ||
    !form ||
    !openButton ||
    !closeButton
  ) {
    console.error(
      "No se encontraron todos los elementos de configuración."
    );

    return;
  }

  /*
    Abrir configuración.
  */

  openButton.addEventListener(
    "click",
    () => {
      populateSettings(preferences);
      updateHouseholdName(activeHousehold);
      dialog.showModal();
    }
  );

  /*
    Cerrar configuración.
  */

  closeButton.addEventListener(
    "click",
    () => {
      dialog.close();
    }
  );

  /*
  Cambiar de lista.
*/

if (!changeListButton) {
  console.error(
    "No se encontró #change-list-button en index.html."
  );
} else {
  changeListButton.addEventListener(
    "click",
    async event => {
      event.preventDefault();
      event.stopPropagation();

      console.log(
        "Botón Cambiar de lista pulsado."
      );

      if (dialog.open) {
        dialog.close();
      }

      try {
        await openHouseholdSwitcher();

        console.log(
          "Selector de listas abierto."
        );
      } catch (error) {
        console.error(
          "No se pudo abrir el selector de listas:",
          error
        );

        window.alert(
          error.message ||
          "No se pudo abrir el selector de listas."
        );
      }
    }
  );
}

  /*
    Cerrar al pulsar fuera del diálogo.
  */

  dialog.addEventListener(
    "click",
    event => {
      if (event.target === dialog) {
        dialog.close();
      }
    }
  );

  /*
    Guardar preferencias visuales.
  */

  form.addEventListener(
    "submit",
    event => {
      event.preventDefault();

      const data =
        new FormData(form);

      preferences = {
        identityId:
          String(
            data.get("identity")
          ),

        themeId:
          String(
            data.get("theme")
          )
      };

      savePreferences(preferences);
      applyPreferences(preferences);
      dialog.close();
    }
  );
}


/* =========================================================
   INICIALIZAR ACCESO A LISTAS
   ========================================================= */

initializeHouseholdAccess()
  .catch(error => {
    console.error(
      "No se pudo preparar el acceso a listas:",
      error
    );
  });