-- =====================================================================
-- Migración: credenciales de médicos, especialidades, atención psicológica
-- y citas recurrentes. Replica en PROD lo aplicado en DESARROLLO.
--
-- Es idempotente: puede ejecutarse más de una vez sin duplicar nada.
-- Ejecutar completo en el SQL Editor de Supabase (proyecto de producción).
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- 0) Columnas previas que usa el login por usuario (por si prod no las tiene)
-- ---------------------------------------------------------------------
alter table public.medicos add column if not exists usuario text;
alter table public.medicos add column if not exists auth_user_id uuid;

-- ---------------------------------------------------------------------
-- 1) Médicos: módulo de historia clínica y usuario único
-- ---------------------------------------------------------------------
alter table public.medicos
  add column if not exists tiene_historia_clinica boolean not null default true;

create unique index if not exists medicos_usuario_unico
  on public.medicos (usuario) where usuario is not null;

-- ---------------------------------------------------------------------
-- 2) Diagnóstico único por paciente y médico (psicología)
-- ---------------------------------------------------------------------
create table if not exists public.diagnosticos_pacientes (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  medico_id   uuid not null references public.medicos(id)   on delete cascade,
  diagnostico text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (paciente_id, medico_id)
);

alter table public.diagnosticos_pacientes enable row level security;

drop policy if exists "diagnosticos_propios" on public.diagnosticos_pacientes;
create policy "diagnosticos_propios" on public.diagnosticos_pacientes
  for all to authenticated
  using (exists (select 1 from public.medicos m
                 where m.auth_user_id = auth.uid()
                   and (m.id = diagnosticos_pacientes.medico_id or m.rol = 'admin')))
  with check (exists (select 1 from public.medicos m
                      where m.auth_user_id = auth.uid()
                        and (m.id = diagnosticos_pacientes.medico_id or m.rol = 'admin')));

-- ---------------------------------------------------------------------
-- 3) Catálogo de especialidades
-- ---------------------------------------------------------------------
create table if not exists public.especialidades (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo_atencion text not null default 'medica' check (tipo_atencion in ('medica', 'psicologica')),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists especialidades_nombre_unico on public.especialidades (lower(nombre));

alter table public.medicos
  add column if not exists especialidad_id uuid references public.especialidades(id);

-- Pasar al catálogo las especialidades que ya tienen los médicos de PROD
insert into public.especialidades (nombre, tipo_atencion)
select distinct on (lower(trim(especialidad))) trim(especialidad),
       case when translate(lower(especialidad), 'áéíóú', 'aeiou') like '%psicolog%' then 'psicologica' else 'medica' end
from public.medicos
where rol <> 'admin' and coalesce(trim(especialidad), '') <> ''
on conflict ((lower(nombre))) do nothing;

update public.medicos m
set especialidad_id = e.id
from public.especialidades e
where m.rol <> 'admin' and m.especialidad_id is null
  and lower(trim(m.especialidad)) = lower(e.nombre);

-- Lectura pública; las escrituras solo desde el servidor (API de administrador)
alter table public.especialidades enable row level security;
drop policy if exists "especialidades_lectura" on public.especialidades;
create policy "especialidades_lectura" on public.especialidades
  for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------
-- 4) Citas recurrentes
-- ---------------------------------------------------------------------
alter table public.citas add column if not exists serie_id uuid;
create index if not exists citas_serie_id_idx on public.citas (serie_id) where serie_id is not null;

commit;

-- Refresca la caché de esquema de la API de Supabase
notify pgrst, 'reload schema';
