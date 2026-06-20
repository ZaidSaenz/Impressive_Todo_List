export const APP_CONFIG = {
  defaultIdentity: "nuestra_lista",
  defaultTheme: "violet",

  identities: [
    {
      id: "nuestra_lista",
      name: "Nuestra Lista",
      subtitle: "Pendientes compartidos"
    },
    {
      id: "juntos",
      name: "Juntos",
      subtitle: "Lo que tenemos por hacer"
    },
    {
      id: "al_dia",
      name: "Al Día",
      subtitle: "Un pendiente a la vez"
    },
    {
      id: "en_orden",
      name: "En Orden",
      subtitle: "Nuestra organización diaria"
    },
    {
      id: "nuestra_casa",
      name: "Nuestra Casa",
      subtitle: "Tareas y pendientes"
    }
  ],

  themes: [
    { id: "obsidian", name: "Obsidiana", swatch: "#d7d9df" },
    { id: "violet", name: "Violeta", swatch: "#8b6ff0" },
    { id: "ocean", name: "Océano", swatch: "#4a91d9" },
    { id: "forest", name: "Bosque", swatch: "#5e9b77" },
    { id: "rose", name: "Rosa", swatch: "#c97891" },
    { id: "amber", name: "Ámbar", swatch: "#c98b43" }
  ],

  groups: [
    { id: "hogar", name: "Hogar", icon: "⌂", sortOrder: 10 },
    { id: "limpieza", name: "Limpieza", icon: "✦", sortOrder: 20 },
    { id: "compras", name: "Compras", icon: "▣", sortOrder: 30 },
    { id: "tramites", name: "Trámites", icon: "▤", sortOrder: 40 },
    { id: "mascotas", name: "Mascotas", icon: "●", sortOrder: 50 },
    { id: "boda", name: "Boda", icon: "◇", sortOrder: 60 },
    { id: "finanzas", name: "Finanzas", icon: "$", sortOrder: 70 },
    { id: "tecnologia", name: "Tecnología", icon: "⌘", sortOrder: 80 },
    { id: "personal", name: "Personal", icon: "○", sortOrder: 90 },
    { id: "otros", name: "Otros", icon: "…", sortOrder: 100 }
  ],

  pressure: {
    freshMaxDays: 1,
    attentionMaxDays: 3,
    urgentMaxDays: 6
  }
};
/* =========================================================
   CONFIGURACIÓN DE SUPABASE

   La Publishable Key puede utilizarse en el navegador.
   La seguridad real depende de las políticas RLS.
   ========================================================= */

export const SUPABASE_CONFIG = {
  url: "https://knchtbipbtxnpioykjzb.supabase.co",

  publishableKey:
    "sb_publishable_fCBc8XdzoJcfYOC018lBwQ_ap1MXmCb"
};