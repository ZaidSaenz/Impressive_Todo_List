/* =========================================================
   IMPRESSIVE TODO LIST
   MIGRACIÓN 003

   Protege el hash del código secreto para que nunca pueda
   consultarse desde el navegador.
   ========================================================= */


/*
  Elimina los permisos generales concedidos anteriormente
  sobre la tabla households.
*/

revoke select, update
on public.households
from authenticated;


/*
  Los usuarios únicamente pueden consultar estas columnas.

  access_secret_hash queda fuera deliberadamente.
*/

grant select (
    id,
    name,
    join_code,
    created_by,
    created_at
)
on public.households
to authenticated;


/*
  Un propietario puede cambiar el nombre visible,
  pero no puede modificar desde el navegador:
  - created_by
  - join_code
  - access_secret_hash
*/

grant update (
    name
)
on public.households
to authenticated;