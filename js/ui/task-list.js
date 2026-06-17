import { APP_CONFIG } from "../config.js";
import { formatAge, getAgeInDays, getPressureLevel } from "../domain/pressure.js";

const ASSIGNEE_LABELS = {
  anyone: "Cualquiera",
  me: "Yo",
  partner: "Mi pareja",
  both: "Ambos"
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(dateValue) {
  if (!dateValue) {
    return null;
  }

  const date = new Date(`${dateValue}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short"
  }).format(date);
}

function createTaskCard(task) {
  const dueDate = formatDate(task.dueDate);
  const pressure = getPressureLevel(task.createdAt);
  const details = task.details
    ? `<p class="task-card__details">${escapeHtml(task.details)}</p>`
    : "";

  return `
    <article class="task-card" data-task-id="${task.id}" data-pressure="${pressure}">
      <button
        class="task-card__check"
        type="button"
        aria-label="Completar ${escapeHtml(task.title)}"
        data-action="complete"
      >✓</button>

      <div class="task-card__content">
        <h3 class="task-card__title">${escapeHtml(task.title)}</h3>
        <p class="task-card__meta">
          <span>${escapeHtml(ASSIGNEE_LABELS[task.assignedTo] ?? "Cualquiera")}</span>
          <span>·</span>
          <span>${escapeHtml(formatAge(task.createdAt))}</span>
          ${dueDate ? `<span>·</span><span>${escapeHtml(dueDate)}</span>` : ""}
        </p>
        ${details}
      </div>

      <div class="task-card__actions">
        <button class="task-card__menu" type="button" aria-label="Más opciones">•••</button>
      </div>
    </article>
  `;
}

export function renderTasks(tasks, { onCompleteTask }) {
  const container = document.querySelector("#task-groups");
  const activeTasks = tasks.filter(task => task.status === "pending");

  if (activeTasks.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <strong>No hay pendientes</strong>
        Usa el botón + para agregar la primera tarea.
      </div>
    `;
    updateSummary(activeTasks);
    return;
  }

  const groups = APP_CONFIG.groups
    .map(group => ({
      ...group,
      tasks: activeTasks
        .filter(task => task.groupId === group.id)
        .sort((a, b) => getAgeInDays(b.createdAt) - getAgeInDays(a.createdAt))
    }))
    .filter(group => group.tasks.length > 0)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  container.innerHTML = groups
    .map(group => `
      <section class="task-group" data-group-id="${group.id}">
        <header class="task-group__header">
          <div class="task-group__heading">
            <span class="task-group__icon" aria-hidden="true">${group.icon}</span>
            <h2 class="task-group__title">${group.name}</h2>
          </div>
          <span class="task-group__count">${group.tasks.length}</span>
        </header>

        <div class="task-group__list">
          ${group.tasks.map(createTaskCard).join("")}
        </div>
      </section>
    `)
    .join("");

  container.querySelectorAll('[data-action="complete"]').forEach(button => {
    button.addEventListener("click", () => {
      const card = button.closest("[data-task-id]");
      onCompleteTask(card.dataset.taskId);
    });
  });

  updateSummary(activeTasks);
}

function updateSummary(tasks) {
  const pendingCount = document.querySelector("#pending-count");
  const groupCount = document.querySelector("#group-count");
  const oldestTask = document.querySelector("#oldest-task");

  pendingCount.textContent = String(tasks.length);
  groupCount.textContent = String(new Set(tasks.map(task => task.groupId)).size);

  if (tasks.length === 0) {
    oldestTask.textContent = "—";
    return;
  }

  const oldest = [...tasks].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
  )[0];

  oldestTask.textContent = formatAge(oldest.createdAt);
}
