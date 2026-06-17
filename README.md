# Impressive_Todo_List
 Lista de tareas compartida con organización por grupos, presión temporal y arquitectura modular.


La aplicación permite capturar, organizar, visualizar y completar tareas desde varios dispositivos. Las tareas cambian gradualmente de estado visual conforme pasa el tiempo sin resolverse.

## Objetivo del MVP

- Lista compartida entre múltiples usuarios.
- Clasificación manual por grupos.
- Tareas generales y descripción detallada.
- Cambio progresivo de color según antigüedad.
- Organización mediante reglas deterministas.
- Preferencias visuales almacenadas localmente.
- Base de datos remota reemplazable.
- Supabase como primer proveedor de datos.
- GitHub Pages como alojamiento de la interfaz.

## Arquitectura

```text
Interfaz HTML/CSS/JavaScript
            ↓
      TaskService
            ↓
      TaskRepository
       ↙           ↘
LocalRepository   SupabaseRepository