import { APP_CONFIG } from "../config.js";

export function initializeTaskForm({ onCreateTask }) {
  const dialog =
    document.querySelector("#task-dialog");

  const form =
    document.querySelector("#task-form");

  const openButton =
    document.querySelector("#open-task-button");

  const closeButton =
    document.querySelector("#close-task-button");

  const groupSelect =
    document.querySelector("#task-group");

  const titleInput =
    document.querySelector("#task-title");

  const detailsInput =
    document.querySelector("#task-details");

  const detailsCounter =
    document.querySelector("#details-counter");

  const message =
    document.querySelector("#task-form-message");


  /* =======================================================
     CARGAR GRUPOS
     ======================================================= */

  groupSelect.innerHTML = `
    <option value="" selected disabled>
      Seleccionar
    </option>

    ${APP_CONFIG.groups
      .map(group => `
        <option value="${group.id}">
          ${group.name}
        </option>
      `)
      .join("")}
  `;


  /* =======================================================
     ABRIR Y CERRAR DIÁLOGO
     ======================================================= */

  function openDialog() {
    message.textContent = "";

    openButton.setAttribute(
      "aria-expanded",
      "true"
    );

    dialog.showModal();

    window.setTimeout(
      () => titleInput.focus(),
      0
    );
  }


  function closeDialog() {
    openButton.setAttribute(
      "aria-expanded",
      "false"
    );

    dialog.close();
  }


  openButton.addEventListener(
    "click",
    openDialog
  );

  closeButton.addEventListener(
    "click",
    closeDialog
  );


  dialog.addEventListener(
    "click",
    event => {
      if (event.target === dialog) {
        closeDialog();
      }
    }
  );


  /* =======================================================
     CONTADOR DE DETALLES
     ======================================================= */

  detailsInput.addEventListener(
    "input",
    () => {
      detailsCounter.textContent =
        `${detailsInput.value.length} / 1000`;
    }
  );


  form.addEventListener(
    "reset",
    () => {
      window.setTimeout(() => {
        detailsCounter.textContent =
          "0 / 1000";

        message.textContent = "";
      }, 0);
    }
  );


  /* =======================================================
     GUARDAR TAREA
     ======================================================= */

  form.addEventListener(
    "submit",
    async event => {
      event.preventDefault();

      const data =
        new FormData(form);

      const title =
        String(
          data.get("title") ?? ""
        ).trim();

      const groupId =
        String(
          data.get("groupId") ?? ""
        ).trim();


      if (!title || !groupId) {
        message.textContent =
          "Escribe una tarea y selecciona un grupo.";

        return;
      }


      const submitButton =
        form.querySelector(
          '[type="submit"]'
        );

      submitButton.disabled = true;

      message.textContent =
        "Guardando tarea…";


      try {
        await onCreateTask({
          title,

          details:
            String(
              data.get("details") ?? ""
            ).trim(),

          groupId,

          assignedTo:
            String(
              data.get("assignedTo") ??
              "anyone"
            ),

          dueDate:
            String(
              data.get("dueDate") ?? ""
            ) || null
        });


        form.reset();

        detailsCounter.textContent =
          "0 / 1000";

        message.textContent = "";

        closeDialog();
      } catch (error) {
        console.error(error);

        message.textContent =
          error.message ||
          "No se pudo guardar la tarea.";
      } finally {
        submitButton.disabled = false;
      }
    }
  );
}