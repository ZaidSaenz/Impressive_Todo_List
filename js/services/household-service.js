/* =========================================================
   SERVICIO DE LISTAS COMPARTIDAS

   Centraliza:
   - Crear listas.
   - Entrar a listas.
   - Consultar listas del dispositivo actual.
   ========================================================= */

import { supabaseClient } from "../supabase-client.js";


/* =========================================================
   CREAR LISTA
   ========================================================= */

export async function createHousehold({
  name,
  secret,
  displayName
}) {
  const { data, error } = await supabaseClient.rpc(
    "create_household",
    {
      p_name: String(name ?? "").trim(),
      p_secret: String(secret ?? ""),
      p_display_name: String(displayName ?? "").trim()
    }
  );

  if (error) {
    throw new Error(
      error.message || "No se pudo crear la lista."
    );
  }

  const createdHousehold = data?.[0];

  if (!createdHousehold) {
    throw new Error(
      "Supabase no devolvió la lista creada."
    );
  }

  return {
    id: createdHousehold.household_id,
    name: createdHousehold.household_name,
    joinCode: createdHousehold.join_code
  };
}


/* =========================================================
   ENTRAR A LISTA
   ========================================================= */

export async function joinHousehold({
  joinCode,
  secret,
  displayName
}) {
  const { data, error } = await supabaseClient.rpc(
    "join_household",
    {
      p_join_code: String(joinCode ?? "")
        .trim()
        .toUpperCase(),

      p_secret: String(secret ?? ""),

      p_display_name: String(displayName ?? "").trim()
    }
  );

  if (error) {
    throw new Error(
      error.message ||
      "No se pudo entrar a la lista."
    );
  }

  const household = data?.[0];

  if (!household) {
    throw new Error(
      "Supabase no devolvió la lista."
    );
  }

  return {
    id: household.household_id,
    name: household.household_name
  };
}


/* =========================================================
   CONSULTAR LISTAS DEL USUARIO ACTUAL
   ========================================================= */

export async function listMyHouseholds() {
  const {
    data,
    error
  } = await supabaseClient
    .from("household_members")
    .select(`
      role,
      joined_at,
      households (
        id,
        name,
        join_code,
        created_at
      )
    `)
    .order("joined_at", {
      ascending: true
    });

  if (error) {
    throw new Error(
      `No se pudieron cargar las listas: ${error.message}`
    );
  }

  return data
    .filter(item => item.households)
    .map(item => ({
      id: item.households.id,
      name: item.households.name,
      joinCode: item.households.join_code,
      createdAt: item.households.created_at,
      role: item.role
    }));
}