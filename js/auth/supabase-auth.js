/* =========================================================
   SERVICIO DE AUTENTICACIÓN

   Centraliza todas las operaciones relacionadas con sesión,
   inicio de sesión y cierre de sesión.
   ========================================================= */

import { supabaseClient } from "../supabase-client.js";


/* =========================================================
   OBTENER SESIÓN ACTUAL

   Devuelve null cuando todavía no hay un usuario conectado.
   ========================================================= */

export async function getCurrentSession() {
  const {
    data,
    error
  } = await supabaseClient.auth.getSession();

  if (error) {
    throw new Error(
      `No se pudo obtener la sesión: ${error.message}`
    );
  }

  return data.session;
}


/* =========================================================
   INICIAR SESIÓN
   ========================================================= */

export async function signInWithPassword(
  email,
  password
) {
  const normalizedEmail = String(email)
    .trim()
    .toLowerCase();

  if (!normalizedEmail || !password) {
    throw new Error(
      "Es necesario escribir correo y contraseña."
    );
  }

  const {
    data,
    error
  } = await supabaseClient.auth.signInWithPassword({
    email: normalizedEmail,
    password
  });

  if (error) {
    throw new Error(
      `No se pudo iniciar sesión: ${error.message}`
    );
  }

  return data;
}


/* =========================================================
   CERRAR SESIÓN
   ========================================================= */

export async function signOut() {
  const { error } =
    await supabaseClient.auth.signOut();

  if (error) {
    throw new Error(
      `No se pudo cerrar la sesión: ${error.message}`
    );
  }
}


/* =========================================================
   ESCUCHAR CAMBIOS DE SESIÓN

   Permitirá reaccionar cuando un usuario entra o sale.
   ========================================================= */

export function subscribeToAuthChanges(callback) {
  const {
    data: { subscription }
  } = supabaseClient.auth.onAuthStateChange(
    (event, session) => {
      callback({
        event,
        session
      });
    }
  );

  return () => {
    subscription.unsubscribe();
  };
}
/* =========================================================
   ASEGURAR UNA IDENTIDAD ANÓNIMA

   Si el navegador ya tiene una sesión, la reutiliza.
   Si no existe, Supabase crea un usuario técnico anónimo.
   ========================================================= */

export async function ensureAnonymousSession() {
  const {
    data: sessionData,
    error: sessionError
  } = await supabaseClient.auth.getSession();

  if (sessionError) {
    throw new Error(
      `No se pudo revisar la sesión: ${sessionError.message}`
    );
  }

  if (sessionData.session) {
    return sessionData.session;
  }

  const {
    data,
    error
  } = await supabaseClient.auth.signInAnonymously();

  if (error) {
    throw new Error(
      `No se pudo crear la sesión anónima: ${error.message}`
    );
  }

  return data.session;
}