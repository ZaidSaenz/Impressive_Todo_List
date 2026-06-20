/* =========================================================
   CLIENTE ÚNICO DE SUPABASE

   Este archivo crea una sola conexión que será reutilizada
   por autenticación, tareas, hogares y Realtime.
   ========================================================= */

import { SUPABASE_CONFIG } from "./config.js";


/* Verifica que la librería CDN haya cargado correctamente. */

if (!window.supabase?.createClient) {
  throw new Error(
    "No se pudo cargar la librería de Supabase."
  );
}


/* Verifica que existan las credenciales públicas. */

if (
  !SUPABASE_CONFIG.url ||
  !SUPABASE_CONFIG.publishableKey
) {
  throw new Error(
    "La configuración pública de Supabase está incompleta."
  );
}


/* Extrae la función createClient de la librería global. */

const { createClient } = window.supabase;


/* Crea la única instancia compartida por toda la aplicación. */

export const supabaseClient = createClient(
  SUPABASE_CONFIG.url,
  SUPABASE_CONFIG.publishableKey
);
