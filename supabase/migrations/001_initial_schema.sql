/* =========================================================
   IMPRESSIVE TODO LIST
   ESQUEMA INICIAL DE BASE DE DATOS
   ========================================================= */


/* =========================================================
   EXTENSIONES
   Permite generar identificadores UUID y códigos aleatorios.
   ========================================================= */

create extension if not exists pgcrypto;


/* =========================================================
   PERFILES PÚBLICOS

   Supabase guarda las cuentas reales en auth.users.
   Esta tabla contiene únicamente los datos que nuestra
   aplicación necesita consultar desde el navegador.
   ========================================================= */

create table if not exists public.profiles (
    id uuid primary key
        references auth.users(id)
        on delete cascade,

    display_name text not null default 'Usuario',

    created_at timestamptz not null default now()
);


/* =========================================================
   HOGARES COMPARTIDOS

   Un hogar representa una lista compartida.
   En nuestro caso, ambos usuarios pertenecerán al mismo hogar.
   ========================================================= */

create table if not exists public.households (
    id uuid primary key default gen_random_uuid(),

    name text not null,

    /*
      Código que permitirá que el segundo usuario
      se una al hogar sin conocer identificadores internos.
    */
    join_code text not null unique
        default upper(encode(gen_random_bytes(5), 'hex')),

    created_by uuid not null
        references auth.users(id)
        on delete restrict,

    created_at timestamptz not null default now()
);


/* =========================================================
   MIEMBROS DEL HOGAR

   Relaciona usuarios con hogares.
   ========================================================= */

create table if not exists public.household_members (
    household_id uuid not null
        references public.households(id)
        on delete cascade,

    user_id uuid not null
        references auth.users(id)
        on delete cascade,

    role text not null default 'member'
        check (role in ('owner', 'member')),

    joined_at timestamptz not null default now(),

    primary key (household_id, user_id)
);


/* =========================================================
   GRUPOS DE TAREAS

   Hogar, limpieza, mascotas, trámites, etc.
   ========================================================= */

create table if not exists public.task_groups (
    id uuid primary key default gen_random_uuid(),

    household_id uuid not null
        references public.households(id)
        on delete cascade,

    name text not null,

    slug text not null,

    sort_order integer not null default 0,

    active boolean not null default true,

    created_at timestamptz not null default now(),

    unique (household_id, slug)
);


/* =========================================================
   TAREAS COMPARTIDAS
   ========================================================= */

create table if not exists public.tasks (
    id uuid primary key default gen_random_uuid(),

    household_id uuid not null
        references public.households(id)
        on delete cascade,

    group_id uuid
        references public.task_groups(id)
        on delete set null,

    title text not null
        check (char_length(trim(title)) between 1 and 180),

    details text not null default ''
        check (char_length(details) <= 2000),

    /*
      anyone  = cualquiera puede realizarla
      both    = corresponde a ambos
      specific = corresponde a un usuario concreto
    */
    assignment_type text not null default 'anyone'
        check (
            assignment_type in (
                'anyone',
                'both',
                'specific'
            )
        ),

    assigned_user_id uuid
        references auth.users(id)
        on delete set null,

    status text not null default 'pending'
        check (
            status in (
                'pending',
                'completed',
                'archived'
            )
        ),

    due_date date,

    sort_order integer not null default 0,

    created_by uuid not null
        references auth.users(id)
        on delete restrict,

    created_at timestamptz not null default now(),

    updated_by uuid
        references auth.users(id)
        on delete set null,

    updated_at timestamptz not null default now(),

    completed_by uuid
        references auth.users(id)
        on delete set null,

    completed_at timestamptz,

    /*
      Se usará más adelante para detectar si dos usuarios
      intentaron modificar simultáneamente la misma tarea.
    */
    version integer not null default 1,

    constraint valid_specific_assignment check (
        (
            assignment_type = 'specific'
            and assigned_user_id is not null
        )
        or
        (
            assignment_type in ('anyone', 'both')
            and assigned_user_id is null
        )
    )
);


/* =========================================================
   ÍNDICES

   Aceleran las consultas más frecuentes.
   ========================================================= */

create index if not exists tasks_household_status_idx
    on public.tasks (household_id, status);

create index if not exists tasks_household_created_idx
    on public.tasks (household_id, created_at);

create index if not exists task_groups_household_idx
    on public.task_groups (household_id);


/* =========================================================
   CREACIÓN AUTOMÁTICA DE PERFIL

   Cuando Supabase crea una cuenta en auth.users,
   se crea también su perfil público.
   ========================================================= */

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.profiles (
        id,
        display_name
    )
    values (
        new.id,
        coalesce(
            nullif(
                new.raw_user_meta_data ->> 'display_name',
                ''
            ),
            split_part(new.email, '@', 1),
            'Usuario'
        )
    )
    on conflict (id) do nothing;

    return new;
end;
$$;

drop trigger if exists on_auth_user_created
    on auth.users;

create trigger on_auth_user_created
    after insert on auth.users
    for each row
    execute procedure public.handle_new_user();

    /* =========================================================
   FUNCIONES DE SEGURIDAD

   Estas funciones determinan si el usuario actual pertenece
   a un hogar o si es su propietario.
   ========================================================= */

create or replace function public.is_household_member(
    target_household_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.household_members
        where household_id = target_household_id
          and user_id = (select auth.uid())
    );
$$;


create or replace function public.is_household_owner(
    target_household_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.household_members
        where household_id = target_household_id
          and user_id = (select auth.uid())
          and role = 'owner'
    );
$$;


/*
  Permite consultar nombres de otros usuarios
  únicamente cuando comparten al menos un hogar.
*/
create or replace function public.shares_household(
    target_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.household_members as current_member
        join public.household_members as target_member
          on target_member.household_id =
             current_member.household_id
        where current_member.user_id =
              (select auth.uid())
          and target_member.user_id =
              target_user_id
    );
$$;


/* =========================================================
   CREAR HOGAR

   El primer usuario crea el hogar y automáticamente se
   convierte en propietario.

   También se crean los grupos iniciales.
   ========================================================= */

create or replace function public.create_household(
    p_name text
)
returns table (
    household_id uuid,
    join_code text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    new_household_id uuid;
    new_join_code text;
begin
    if auth.uid() is null then
        raise exception 'Se requiere una sesión activa.';
    end if;

    if nullif(trim(p_name), '') is null then
        raise exception 'El hogar necesita un nombre.';
    end if;

    insert into public.households (
        name,
        created_by
    )
    values (
        trim(p_name),
        auth.uid()
    )
    returning
        id,
        households.join_code
    into
        new_household_id,
        new_join_code;

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

    /*
      Catálogo inicial de grupos.
      Después podrán modificarse desde la aplicación.
    */
    insert into public.task_groups (
        household_id,
        name,
        slug,
        sort_order
    )
    values
        (new_household_id, 'Hogar',       'hogar',       10),
        (new_household_id, 'Limpieza',    'limpieza',    20),
        (new_household_id, 'Compras',     'compras',     30),
        (new_household_id, 'Trámites',    'tramites',    40),
        (new_household_id, 'Mascotas',    'mascotas',    50),
        (new_household_id, 'Boda',        'boda',        60),
        (new_household_id, 'Finanzas',    'finanzas',    70),
        (new_household_id, 'Tecnología',  'tecnologia',  80),
        (new_household_id, 'Personal',    'personal',    90),
        (new_household_id, 'Otros',       'otros',      100);

    return query
    select
        new_household_id,
        new_join_code;
end;
$$;


/* =========================================================
   UNIRSE A UN HOGAR

   El segundo usuario introduce el código compartido.
   ========================================================= */

create or replace function public.join_household(
    p_join_code text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    found_household_id uuid;
begin
    if auth.uid() is null then
        raise exception 'Se requiere una sesión activa.';
    end if;

    select id
    into found_household_id
    from public.households
    where upper(join_code) =
          upper(trim(p_join_code));

    if found_household_id is null then
        raise exception 'El código del hogar no es válido.';
    end if;

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

    return found_household_id;
end;
$$;
/* =========================================================
   AUDITORÍA AUTOMÁTICA DE TAREAS

   La base de datos determina automáticamente:
   - Quién creó la tarea.
   - Quién la modificó.
   - Cuándo fue modificada.
   - Quién la completó.
   - La versión actual del registro.

   De esta manera, el navegador no puede inventar estos datos.
   ========================================================= */

create or replace function public.set_task_audit_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    /* -----------------------------------------------------
       CUANDO SE CREA UNA TAREA
       ----------------------------------------------------- */

    if tg_op = 'INSERT' then
        new.created_by := auth.uid();
        new.updated_by := auth.uid();

        new.created_at := now();
        new.updated_at := now();

        new.version := 1;

    /* -----------------------------------------------------
       CUANDO SE MODIFICA UNA TAREA
       ----------------------------------------------------- */

    else
        new.updated_by := auth.uid();
        new.updated_at := now();

        new.version := old.version + 1;
    end if;


    /* -----------------------------------------------------
       CUANDO SE COMPLETA UNA TAREA

       Registra automáticamente quién la completó
       y la fecha exacta.
       ----------------------------------------------------- */

    /*
  En INSERT no existe OLD.
  Por eso separamos INSERT y UPDATE.
*/

if tg_op = 'INSERT' then

    if new.status = 'completed' then
        new.completed_by := auth.uid();
        new.completed_at := now();
    end if;

elsif new.status = 'completed'
      and old.status is distinct from 'completed'
then
    new.completed_by := auth.uid();
    new.completed_at := now();
end if;


    /* -----------------------------------------------------
       CUANDO SE REABRE UNA TAREA

       Si deja de estar completada, se eliminan los datos
       anteriores de finalización.
       ----------------------------------------------------- */

    if new.status <> 'completed' then
        new.completed_by := null;
        new.completed_at := null;
    end if;

    return new;
end;
$$;


/* Elimina el trigger anterior si ya existía. */

drop trigger if exists tasks_set_audit_fields
    on public.tasks;


/* Ejecuta la función antes de crear o actualizar una tarea. */

create trigger tasks_set_audit_fields
    before insert or update
    on public.tasks
    for each row
    execute procedure public.set_task_audit_fields();
/* =========================================================
   ROW LEVEL SECURITY

   Nadie puede ver tareas de un hogar al que no pertenece.
   ========================================================= */

alter table public.profiles
    enable row level security;

alter table public.households
    enable row level security;

alter table public.household_members
    enable row level security;

alter table public.task_groups
    enable row level security;

alter table public.tasks
    enable row level security;


/* =========================================================
   POLÍTICAS DE PERFILES
   ========================================================= */

drop policy if exists profiles_select_shared
    on public.profiles;

create policy profiles_select_shared
on public.profiles
for select
to authenticated
using (
    id = (select auth.uid())
    or public.shares_household(id)
);


drop policy if exists profiles_update_own
    on public.profiles;

create policy profiles_update_own
on public.profiles
for update
to authenticated
using (
    id = (select auth.uid())
)
with check (
    id = (select auth.uid())
);


/* =========================================================
   POLÍTICAS DE HOGARES
   ========================================================= */

drop policy if exists households_select_member
    on public.households;

create policy households_select_member
on public.households
for select
to authenticated
using (
    public.is_household_member(id)
);


drop policy if exists households_update_owner
    on public.households;

create policy households_update_owner
on public.households
for update
to authenticated
using (
    public.is_household_owner(id)
)
with check (
    public.is_household_owner(id)
);


/* =========================================================
   POLÍTICAS DE MIEMBROS
   ========================================================= */

drop policy if exists members_select_household
    on public.household_members;

create policy members_select_household
on public.household_members
for select
to authenticated
using (
    public.is_household_member(household_id)
);


/* =========================================================
   POLÍTICAS DE GRUPOS
   ========================================================= */

drop policy if exists groups_select_member
    on public.task_groups;

create policy groups_select_member
on public.task_groups
for select
to authenticated
using (
    public.is_household_member(household_id)
);


drop policy if exists groups_insert_member
    on public.task_groups;

create policy groups_insert_member
on public.task_groups
for insert
to authenticated
with check (
    public.is_household_member(household_id)
);


drop policy if exists groups_update_member
    on public.task_groups;

create policy groups_update_member
on public.task_groups
for update
to authenticated
using (
    public.is_household_member(household_id)
)
with check (
    public.is_household_member(household_id)
);


drop policy if exists groups_delete_member
    on public.task_groups;

create policy groups_delete_member
on public.task_groups
for delete
to authenticated
using (
    public.is_household_member(household_id)
);


/* =========================================================
   POLÍTICAS DE TAREAS

   Ambos miembros pueden crear, editar y eliminar tareas
   pertenecientes a su hogar.
   ========================================================= */

drop policy if exists tasks_select_member
    on public.tasks;

create policy tasks_select_member
on public.tasks
for select
to authenticated
using (
    public.is_household_member(household_id)
);


drop policy if exists tasks_insert_member
    on public.tasks;

create policy tasks_insert_member
on public.tasks
for insert
to authenticated
with check (
    public.is_household_member(household_id)
);


drop policy if exists tasks_update_member
    on public.tasks;

create policy tasks_update_member
on public.tasks
for update
to authenticated
using (
    public.is_household_member(household_id)
)
with check (
    public.is_household_member(household_id)
);


drop policy if exists tasks_delete_member
    on public.tasks;

create policy tasks_delete_member
on public.tasks
for delete
to authenticated
using (
    public.is_household_member(household_id)
);

/* =========================================================
   PERMISOS PARA USUARIOS AUTENTICADOS
   ========================================================= */

grant usage on schema public
to authenticated;

grant select, update
on public.profiles
to authenticated;

grant select, update
on public.households
to authenticated;

grant select
on public.household_members
to authenticated;

grant select, insert, update, delete
on public.task_groups
to authenticated;

grant select, insert, update, delete
on public.tasks
to authenticated;


/* Las funciones no estarán disponibles para visitantes. */

revoke all
on function public.create_household(text)
from public;

revoke all
on function public.join_household(text)
from public;

grant execute
on function public.create_household(text)
to authenticated;

grant execute
on function public.join_household(text)
to authenticated;


/* =========================================================
   REALTIME

   Activa eventos para tareas y grupos.
   ========================================================= */

do $$
begin
    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'tasks'
    ) then
        alter publication supabase_realtime
        add table public.tasks;
    end if;

    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'task_groups'
    ) then
        alter publication supabase_realtime
        add table public.task_groups;
    end if;
end;
$$;