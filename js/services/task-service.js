/* =========================================================
   SERVICIO DE TAREAS

   Traduce entre:
   - La estructura utilizada por la interfaz.
   - Las columnas reales de Supabase.
   ========================================================= */

import {
  supabaseClient
} from "../supabase-client.js";


let activeTasksChannel = null;


/* =========================================================
   SESIÓN ACTUAL
   ========================================================= */

async function getCurrentUserId() {
  const {
    data,
    error
  } = await supabaseClient.auth.getSession();

  if (error) {
    throw new Error(
      `No se pudo consultar la sesión: ${error.message}`
    );
  }

  const userId = data.session?.user?.id;

  if (!userId) {
    throw new Error(
      "No existe una sesión activa."
    );
  }

  return userId;
}


/* =========================================================
   GRUPO POR SLUG

   La interfaz utiliza:
   hogar, limpieza, tramites...

   Supabase almacena el UUID real del grupo.
   ========================================================= */

async function findGroupId(
  householdId,
  groupSlug
) {
  const {
    data,
    error
  } = await supabaseClient
    .from("task_groups")
    .select("id")
    .eq("household_id", householdId)
    .eq("slug", groupSlug)
    .eq("active", true)
    .limit(1);

  if (error) {
    throw new Error(
      `No se pudo buscar el grupo: ${error.message}`
    );
  }

  const groupId = data?.[0]?.id;

  if (!groupId) {
    throw new Error(
      `No existe el grupo "${groupSlug}" en esta lista.`
    );
  }

  return groupId;
}


/* =========================================================
   ASIGNACIÓN

   Interfaz:
   - anyone
   - both
   - me
   - partner

   Base de datos:
   - anyone
   - both
   - specific + assigned_user_id
   ========================================================= */

async function resolveAssignment({
  householdId,
  assignedTo,
  currentUserId
}) {
  if (assignedTo === "both") {
    return {
      assignmentType: "both",
      assignedUserId: null
    };
  }

  if (assignedTo === "me") {
    return {
      assignmentType: "specific",
      assignedUserId: currentUserId
    };
  }

  if (assignedTo === "partner") {
    const {
      data,
      error
    } = await supabaseClient
      .from("household_members")
      .select("user_id")
      .eq("household_id", householdId)
      .neq("user_id", currentUserId)
      .limit(1);

    if (error) {
      throw new Error(
        `No se pudo buscar al otro integrante: ${error.message}`
      );
    }

    const partnerId = data?.[0]?.user_id;

    if (!partnerId) {
      throw new Error(
        "Todavía no hay otro integrante en esta lista."
      );
    }

    return {
      assignmentType: "specific",
      assignedUserId: partnerId
    };
  }

  return {
    assignmentType: "anyone",
    assignedUserId: null
  };
}


/* =========================================================
   CONVERTIR FILA DE SUPABASE A TAREA DE INTERFAZ
   ========================================================= */

function mapDatabaseTask(
  row,
  currentUserId
) {
  const relatedGroup =
    Array.isArray(row.task_groups)
      ? row.task_groups[0]
      : row.task_groups;

  let assignedTo = "anyone";

  if (row.assignment_type === "both") {
    assignedTo = "both";
  }

  if (row.assignment_type === "specific") {
    assignedTo =
      row.assigned_user_id === currentUserId
        ? "me"
        : "partner";
  }

  return {
    id: row.id,
    title: row.title,
    details: row.details ?? "",
    groupId: relatedGroup?.slug ?? "otros",
    assignedTo,
    dueDate: row.due_date,
    status: row.status,
    createdAt: row.created_at,
    completedAt: row.completed_at
  };
}


/* =========================================================
   CARGAR TAREAS
   ========================================================= */

export async function loadTasks(
  householdId
) {
  const currentUserId =
    await getCurrentUserId();

  const {
    data,
    error
  } = await supabaseClient
    .from("tasks")
    .select(`
      id,
      title,
      details,
      assignment_type,
      assigned_user_id,
      status,
      due_date,
      created_at,
      completed_at,
      task_groups (
        slug
      )
    `)
    .eq("household_id", householdId)
    .order("created_at", {
      ascending: false
    });

  if (error) {
    throw new Error(
      `No se pudieron cargar las tareas: ${error.message}`
    );
  }

  return (data ?? []).map(row =>
    mapDatabaseTask(
      row,
      currentUserId
    )
  );
}


/* =========================================================
   CREAR TAREA
   ========================================================= */

export async function createTask(
  householdId,
  task
) {
  const currentUserId =
    await getCurrentUserId();

  const groupId =
    await findGroupId(
      householdId,
      task.groupId
    );

  const assignment =
    await resolveAssignment({
      householdId,
      assignedTo: task.assignedTo,
      currentUserId
    });

  const {
    error
  } = await supabaseClient
    .from("tasks")
    .insert({
      household_id: householdId,
      group_id: groupId,

      title: String(task.title ?? "").trim(),
      details: String(task.details ?? "").trim(),

      assignment_type:
        assignment.assignmentType,

      assigned_user_id:
        assignment.assignedUserId,

      due_date:
        task.dueDate || null,

      status: "pending",
      created_by: currentUserId
    });

  if (error) {
    throw new Error(
      `No se pudo crear la tarea: ${error.message}`
    );
  }
}


/* =========================================================
   COMPLETAR TAREA
   ========================================================= */

export async function completeTask(
  householdId,
  taskId
) {
  const currentUserId =
    await getCurrentUserId();

  const completedAt =
    new Date().toISOString();

  const {
    error
  } = await supabaseClient
    .from("tasks")
    .update({
      status: "completed",
      completed_at: completedAt,
      completed_by: currentUserId,
      updated_by: currentUserId
    })
    .eq("id", taskId)
    .eq("household_id", householdId);

  if (error) {
    throw new Error(
      `No se pudo completar la tarea: ${error.message}`
    );
  }
}


/* =========================================================
   REALTIME

   Cuando cualquier integrante modifica las tareas,
   se solicita al frontend que vuelva a cargarlas.
   ========================================================= */

export function subscribeToTasks(
  householdId,
  onChange
) {
  if (activeTasksChannel) {
    void supabaseClient.removeChannel(
      activeTasksChannel
    );

    activeTasksChannel = null;
  }

  activeTasksChannel =
    supabaseClient
      .channel(
        `tasks-${householdId}-${Date.now()}`
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter:
            `household_id=eq.${householdId}`
        },
        payload => {
          onChange(payload);
        }
      )
      .subscribe(status => {
        console.log(
          "Realtime tareas:",
          status
        );
      });

  return function unsubscribe() {
    if (!activeTasksChannel) {
      return;
    }

    void supabaseClient.removeChannel(
      activeTasksChannel
    );

    activeTasksChannel = null;
  };
}
