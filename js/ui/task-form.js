import { APP_CONFIG } from "../config.js";

export function initializeTaskForm({ onCreateTask }) {
  const dialog = document.querySelector("#task-dialog");
  const form = document.querySelector("#task-form");
  const openButton = document.querySelector("#open-task-button");
  const closeButton = document.querySelector("#close-task-button");
  const groupSelect = document.querySelector("#task-group");
  const titleInput = document.querySelector("#task-title");
  const detailsInput = document.querySelector("#task-details");
  const detailsCounter = document.querySelector("#details-counter");
  const message = document.querySelector("#task-form-message");

  groupSelect.innerHTML = `
    <option value="" selected disabled>Seleccionar</option>
    ${APP_CONFIG.groups
      .map(group => `<option value="${group.id}">${group.name}</option>`)
      .join("")}
  `;

  function openDialog() {
    message.textContent = "";
    openButton.setAttribute("aria-expanded", "true");
    dialog.showModal();
    window.setTimeout(() => titleInput.focus(), 0);
  }

  function closeDialog() {
    openButton.setAttribute("aria-expanded", "false");
    dialog.close();
  }

  openButton.addEventListener("click", openDialog);
  closeButton.addEventListener("click", closeDialog);

  dialog.addEventListener("click", event => {
    if (event.target === dialog) {
      closeDialog();
    }
  });

  detailsInput.addEventListener("input", () => {
    detailsCounter.textContent = `${detailsInput.value.length} / 1000`;
  });

  form.addEventListener("reset", () => {
    window.setTimeout(() => {
      detailsCounter.textContent = "0 / 1000";
      message.textContent = "";
    }, 0);
  });

  form.addEventListener("submit", event => {
    event.preventDefault();

    const data = new FormData(form);
    const title = String(data.get("title") ?? "").trim();
    const groupId = String(data.get("groupId") ?? "").trim();

    if (!title || !groupId) {
      message.textContent = "Escribe una tarea y selecciona un grupo.";
      return;
    }

    onCreateTask({
      id: crypto.randomUUID(),
      title,
      details: String(data.get("details") ?? "").trim(),
      groupId,
      assignedTo: String(data.get("assignedTo") ?? "anyone"),
      dueDate: String(data.get("dueDate") ?? "") || null,
      status: "pending",
      createdAt: new Date().toISOString()
    });

    form.reset();
    detailsCounter.textContent = "0 / 1000";
    closeDialog();
  });
}
