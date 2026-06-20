/* =========================================================
   IMPRESSIVE TODO LIST
   MIGRACIÓN 002

   Añade:
   - Código secreto por lista.
   - Creación pública controlada de listas.
   - Entrada mediante código único + secreto.
   - Nombre local del integrante.
   ========================================================= */


/* =========================================================
   CÓDIGO SECRETO DE LA LISTA

   Nunca almacenamos el secreto original.
   Solo almacenamos su hash.
   ========================================================= */

alter table public.households
add column if not exists access_secret_hash text;


/* =========================================================
   ELIMINAR FUNCIONES ANTERIORES

   Las funciones anteriores permitían crear o entrar
   sin código secreto, por lo que deben desaparecer.
   ========================================================= */

drop function if exists public.create_household(text);

drop function if exists public.join_household(text);


/* =========================================================
   CREAR UNA LISTA NUEVA

   Parámetros:
   p_name         → nombre visible de la lista
   p_secret       → código secreto
   p_display_name → nombre de quien crea la lista
   ========================================================= */

create or replace function public.create_household(
    p_name text,
    p_secret text,
    p_display_name text
)
returns table (
    household_id uuid,
    household_name text,
    join_code text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    new_household_id uuid;
    new_household_name text;
    new_join_code text;
begin
    /* Debe existir una sesión, aunque sea anónima. */

    if auth.uid() is null then
        raise exception
            'Se requiere una sesión activa.';
    end if;


    /* Validación del nombre de la lista. */

    if char_length(trim(coalesce(p_name, ''))) < 2 then
        raise exception
            'El nombre de la lista es demasiado corto.';
    end if;

    if char_length(trim(p_name)) > 60 then
        raise exception
            'El nombre de la lista es demasiado largo.';
    end if;


    /* Validación del código secreto. */

    if char_length(coalesce(p_secret, '')) < 8 then
        raise exception
            'El código secreto debe tener al menos 8 caracteres.';
    end if;

    if char_length(p_secret) > 128 then
        raise exception
            'El código secreto es demasiado largo.';
    end if;


    /* Validación del nombre del integrante. */

    if char_length(trim(coalesce(p_display_name, ''))) < 1 then
        raise exception
            'Escribe tu nombre.';
    end if;

    if char_length(trim(p_display_name)) > 40 then
        raise exception
            'El nombre del integrante es demasiado largo.';
    end if;


    /*
      Actualiza el perfil técnico del usuario anónimo
      con el nombre elegido en este dispositivo.
    */

    update public.profiles
    set display_name = trim(p_display_name)
    where id = auth.uid();


    /*
      Crea la lista.

      crypt() genera un hash irreversible usando bcrypt.
      El secreto original no queda guardado.
    */

    insert into public.households (
        name,
        access_secret_hash,
        created_by
    )
    values (
        trim(p_name),

        extensions.crypt(
            p_secret,
            extensions.gen_salt('bf', 10)
        ),

        auth.uid()
    )
    returning
        id,
        name,
        households.join_code
    into
        new_household_id,
        new_household_name,
        new_join_code;


    /* El creador se convierte en propietario. */

    insert into public.household_members (
        household_id,
        user_id,
        role
    )
    values (
        new_household_id,
        auth.uid(),
        'owner'
    );


    /* Grupos predeterminados de la lista. */

    insert into public.task_groups (
        household_id,
        name,
        slug,
        sort_order
    )
    values
        (new_household_id, 'Hogar',      'hogar',      10),
        (new_household_id, 'Limpieza',   'limpieza',   20),
        (new_household_id, 'Compras',    'compras',    30),
        (new_household_id, 'Trámites',   'tramites',   40),
        (new_household_id, 'Mascotas',   'mascotas',   50),
        (new_household_id, 'Boda',       'boda',       60),
        (new_household_id, 'Finanzas',   'finanzas',   70),
        (new_household_id, 'Tecnología', 'tecnologia', 80),
        (new_household_id, 'Personal',   'personal',   90),
        (new_household_id, 'Otros',      'otros',      100);


    /* Devuelve la información necesaria al frontend. */

    return query
    select
        new_household_id,
        new_household_name,
        new_join_code;
end;
$$;


/* =========================================================
   ENTRAR A UNA LISTA EXISTENTE

   Parámetros:
   p_join_code    → código único de la lista
   p_secret       → código secreto
   p_display_name → nombre del integrante
   ========================================================= */

create or replace function public.join_household(
    p_join_code text,
    p_secret text,
    p_display_name text
)
returns table (
    household_id uuid,
    household_name text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    found_household_id uuid;
    found_household_name text;
begin
    if auth.uid() is null then
        raise exception
            'Se requiere una sesión activa.';
    end if;


    if nullif(trim(coalesce(p_join_code, '')), '') is null then
        raise exception
            'Escribe el código de la lista.';
    end if;


    if nullif(coalesce(p_secret, ''), '') is null then
        raise exception
            'Escribe el código secreto.';
    end if;


    if nullif(trim(coalesce(p_display_name, '')), '') is null then
        raise exception
            'Escribe tu nombre.';
    end if;


    /*
      Busca la lista y compara el secreto ingresado
      con el hash almacenado.
    */

    select
        id,
        name
    into
        found_household_id,
        found_household_name
    from public.households
    where upper(join_code) =
          upper(trim(p_join_code))

      and access_secret_hash is not null

      and extensions.crypt(
          p_secret,
          access_secret_hash
      ) = access_secret_hash;


    /*
      El mensaje no indica si falló el código o el secreto.
      Así no revelamos información innecesaria.
    */

    if found_household_id is null then
        raise exception
            'El código de la lista o el código secreto no son correctos.';
    end if;


    /* Guarda el nombre elegido para este integrante. */

    update public.profiles
    set display_name = trim(p_display_name)
    where id = auth.uid();


    /* Agrega al usuario como miembro. */

    insert into public.household_members (
        household_id,
        user_id,
        role
    )
    values (
        found_household_id,
        auth.uid(),
        'member'
    )
    on conflict (
        household_id,
        user_id
    )
    do nothing;


    return query
    select
        found_household_id,
        found_household_name;
end;
$$;


/* =========================================================
   PERMISOS DE LAS FUNCIONES

   Solo una sesión autenticada —incluidas las anónimas—
   puede crear o entrar a una lista.
   ========================================================= */

revoke all
on function public.create_household(
    text,
    text,
    text
)
from public;


revoke all
on function public.join_household(
    text,
    text,
    text
)
from public;


grant execute
on function public.create_household(
    text,
    text,
    text
)
to authenticated;


grant execute
on function public.join_household(
    text,
    text,
    text
)
to authenticated;