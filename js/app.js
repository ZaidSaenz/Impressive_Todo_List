import { applyPreferences, loadPreferences, populateSettings, savePreferences } from "./ui/preferences.js";
import { initializeTaskForm } from "./ui/task-form.js";
import { renderTasks } from "./ui/task-list.js";

const DAY_IN_MS = 86_400_000;

let preferences = loadPreferences();
let tasks = createSampleTasks();

applyPreferences(preferences);
populateSettings(preferences);

initializeTaskForm({
  onCreateTask(task) {
    tasks = [task, ...tasks];
    render();
  }
});

initializeSettings();
render();

function render() {
  renderTasks(tasks, {
    onCompleteTask(taskId) {
      tasks = tasks.map(task => (
        task.id === taskId
          ? {
              ...task,
              status: "completed",
              completedAt: new Date().toISOString()
            }
          : task
      ));

      render();
    }
  });
}

function initializeSettings() {
  const dialog = document.querySelector("#settings-dialog");
  const form = document.querySelector("#settings-form");
  const openButton = document.querySelector("#open-settings-button");
  const closeButton = document.querySelector("#close-settings-button");

  openButton.addEventListener("click", () => {
    populateSettings(preferences);
    dialog.showModal();
  });

  closeButton.addEventListener("click", () => dialog.close());

  dialog.addEventListener("click", event => {
    if (event.target === dialog) {
      dialog.close();
    }
  });

  form.addEventListener("submit", event => {
    event.preventDefault();

    const data = new FormData(form);
    preferences = {
      identityId: String(data.get("identity")),
      themeId: String(data.get("theme"))
    };

    savePreferences(preferences);
    applyPreferences(preferences);
    dialog.close();
  });
}

function daysAgo(days) {
  return new Date(Date.now() - days * DAY_IN_MS).toISOString();
}

function createSampleTasks() {
  return [
    {
      id: crypto.randomUUID(),
      title: "Acomodar cajones del vanity",
      details: "Separar maquillaje, limpiar los cajones y retirar cosas que ya no se usan.",
      groupId: "hogar",
      assignedTo: "partner",
      dueDate: null,
      status: "pending",
      createdAt: daysAgo(2)
    },
    {
      id: crypto.randomUUID(),
      title: "Sacar copia del acta y verificar documentos faltantes",
      details: "Revisar también las copias de las INE antes de ir al Registro Civil.",
      groupId: "tramites",
      assignedTo: "both",
      dueDate: null,
      status: "pending",
      createdAt: daysAgo(5)
    },
    {
      id: crypto.randomUUID(),
      title: "Bañar perritos y lavar patio",
      details: "Hacerlo juntos y dejar listo el espacio de los perros.",
      groupId: "mascotas",
      assignedTo: "both",
      dueDate: null,
      status: "pending",
      createdAt: daysAgo(7)
    },
    {
      id: crypto.randomUUID(),
      title: "Lavar funda, sábanas y almohaditas",
      details: "",
      groupId: "limpieza",
      assignedTo: "anyone",
      dueDate: null,
      status: "pending",
      createdAt: daysAgo(1)
    },
    {
      id: crypto.randomUUID(),
      title: "Revisar y limpiar la memoria del celular",
      details: "Respaldar fotos importantes antes de borrar archivos.",
      groupId: "tecnologia",
      assignedTo: "me",
      dueDate: null,
      status: "pending",
      createdAt: daysAgo(4)
    }
  ];
}
