-- =====================================================================
-- ESQUEMA COMPLETO - Sistema de Agendamiento de Citas Médicas
-- Crea todos los objetos en un proyecto de Supabase NUEVO (vacío).
--
-- Generado a partir del esquema de desarrollo del 2026-11-17
-- (incluye las migraciones 01, 02 y 03 de supabase/migraciones).
--
-- Uso: SQL Editor del proyecto nuevo > pegar todo > Run.
-- Después seguir los pasos de "DATOS INICIALES" al final.
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- 1) Catálogo de especialidades
-- ---------------------------------------------------------------------
create table public.especialidades (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  tipo_atencion text not null default 'medica'
                constraint especialidades_tipo_atencion_check check (tipo_atencion = any (array['medica', 'psicologica'])),
  activo        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index especialidades_nombre_unico on public.especialidades (lower(nombre));

-- ---------------------------------------------------------------------
-- 2) Médicos (y el administrador, con rol = 'admin')
-- ---------------------------------------------------------------------
create table public.medicos (
  id                     uuid primary key default gen_random_uuid(),
  nombre                 text not null,
  especialidad           text not null,  -- copia del nombre de la especialidad (la mantiene la API)
  especialidad_id        uuid constraint medicos_especialidad_id_fkey references public.especialidades(id),
  email                  text not null constraint medicos_email_key unique,
  telefono               text,
  direccion              text default 'Av. San Jorge y Calle 10ma, Guayaquil',
  consultorio            text default 'Piso 2, Consultorio 204',
  rol                    text default 'medico',
  usuario                text,
  auth_user_id           uuid constraint medicos_auth_user_id_fkey references auth.users(id) on delete set null,
  tiene_historia_clinica boolean not null default true,
  created_at             timestamp default now()
);
create unique index medicos_usuario_unico   on public.medicos (usuario)      where usuario is not null;
create unique index medicos_auth_user_id_key on public.medicos (auth_user_id) where auth_user_id is not null;

-- ---------------------------------------------------------------------
-- 3) Pacientes
-- ---------------------------------------------------------------------
create table public.pacientes (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  cedula     text constraint pacientes_cedula_key unique,
  telefono   text not null,
  email      text,
  created_at timestamp default now()
);

-- ---------------------------------------------------------------------
-- 4) Disponibilidad (horarios) de cada médico
-- ---------------------------------------------------------------------
create table public.disponibilidad_medico (
  id                    uuid primary key default gen_random_uuid(),
  medico_id             uuid constraint disponibilidad_medico_medico_id_fkey references public.medicos(id) on delete cascade,
  dia_semana            integer not null,  -- 0 = domingo ... 6 = sábado
  fecha_especifica      date,              -- si se llena, la regla aplica solo a esa fecha
  hora_inicio           time not null,
  hora_fin              time not null,
  hora_inicio_almuerzo  time,
  hora_fin_almuerzo     time,
  duracion_cita_minutos integer default 30
);

-- ---------------------------------------------------------------------
-- 5) Citas
-- ---------------------------------------------------------------------
create table public.citas (
  id                  uuid primary key default gen_random_uuid(),
  medico_id           uuid constraint citas_medico_id_fkey references public.medicos(id) on delete cascade,
  paciente_id         uuid constraint citas_paciente_id_fkey references public.pacientes(id) on delete cascade,
  fecha_hora          timestamp not null,
  estado              text default 'pendiente'
                      constraint citas_estado_check check (estado = any (array['pendiente', 'confirmada', 'atendida', 'completada', 'cancelada', 'no_asistio'])),
  tipo_consulta       text default 'presencial',
  enlace_videollamada text,
  serie_id            uuid,  -- agrupa las citas recurrentes de una misma serie
  created_at          timestamp default now()
);
create index citas_serie_id_idx on public.citas (serie_id) where serie_id is not null;
-- Un paciente no puede tener dos citas activas a la misma hora
create unique index idx_citas_paciente_horario on public.citas (paciente_id, fecha_hora) where estado <> 'cancelada';

-- ---------------------------------------------------------------------
-- 6) Historias clínicas (una por atención)
-- ---------------------------------------------------------------------
create table public.historias_clinicas (
  id                       uuid primary key default gen_random_uuid(),
  cita_id                  uuid constraint historias_clinicas_cita_id_fkey references public.citas(id) on delete set null,
  paciente_id              uuid constraint historias_clinicas_paciente_id_fkey references public.pacientes(id) on delete cascade,
  medico_id                uuid constraint historias_clinicas_medico_id_fkey references public.medicos(id) on delete cascade,
  motivo_consulta          text,  -- en psicología: actividades realizadas
  diagnostico              text,
  tratamiento_prescripcion text,  -- en psicología: actividades próxima sesión
  notas_privadas           text,
  fecha_registro           timestamptz default now()
);

-- ---------------------------------------------------------------------
-- 7) Recetas médicas
-- ---------------------------------------------------------------------
create table public.recetas_medicas (
  id            uuid primary key default gen_random_uuid(),
  historia_id   uuid constraint recetas_medicas_historia_id_fkey references public.historias_clinicas(id) on delete cascade,
  paciente_id   uuid constraint recetas_medicas_paciente_id_fkey references public.pacientes(id) on delete cascade,
  medico_id     uuid constraint recetas_medicas_medico_id_fkey references public.medicos(id) on delete cascade,
  medicamentos  text not null,
  indicaciones  text not null,
  fecha_emision timestamptz default now()
);

-- ---------------------------------------------------------------------
-- 8) Diagnóstico único por paciente y médico (psicología)
-- ---------------------------------------------------------------------
create table public.diagnosticos_pacientes (
  id          uuid primary key default gen_random_uuid(),
  paciente_id uuid not null constraint diagnosticos_pacientes_paciente_id_fkey references public.pacientes(id) on delete cascade,
  medico_id   uuid not null constraint diagnosticos_pacientes_medico_id_fkey references public.medicos(id) on delete cascade,
  diagnostico text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint diagnosticos_pacientes_paciente_id_medico_id_key unique (paciente_id, medico_id)
);

-- ---------------------------------------------------------------------
-- 9) Registro de correos enviados (control del cupo de Brevo)
-- ---------------------------------------------------------------------
create table public.correos_enviados (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  tipo         text not null check (tipo in ('confirmacion_cita', 'factura')),
  destinatario text not null,
  asunto       text,
  estado       text not null check (estado in ('enviado', 'error', 'omitido_limite')),
  error        text,
  origen       text,
  message_id   text,
  cita_id      uuid references public.citas(id) on delete set null,
  paciente_id  uuid references public.pacientes(id) on delete set null,
  medico_id    uuid references public.medicos(id) on delete set null
);
create index correos_enviados_created_idx on public.correos_enviados (created_at desc);
create index correos_enviados_cita_idx    on public.correos_enviados (cita_id);

-- ---------------------------------------------------------------------
-- 10) Funciones auxiliares para las políticas
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mi_medico_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select id from public.medicos
  where auth_user_id = auth.uid()
  limit 1
$function$;

CREATE OR REPLACE FUNCTION public.soy_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.medicos
    where auth_user_id = auth.uid() and rol = 'admin'
  )
$function$;

-- ---------------------------------------------------------------------
-- 11) Seguridad a nivel de fila (RLS) y políticas
--     citas, pacientes, disponibilidad_medico y recetas_medicas quedan sin RLS,
--     igual que en desarrollo y producción.
-- ---------------------------------------------------------------------

-- especialidades: lectura pública; escrituras solo desde la API (service role)
alter table public.especialidades enable row level security;
create policy "especialidades_lectura" on public.especialidades
  for select to anon, authenticated using (true);

-- medicos: lectura para usuarios con sesión; escrituras solo desde la API
alter table public.medicos enable row level security;
create policy "medicos_lectura" on public.medicos
  for select to authenticated using (true);

-- La agenda pública (sin sesión) solo ve médicos (no el admin) y solo columnas públicas
create policy "medicos_lectura_publica" on public.medicos
  for select to anon using (rol is distinct from 'admin');
revoke select on public.medicos from anon;
grant select (id, nombre, especialidad, especialidad_id, direccion, consultorio, rol) on public.medicos to anon;

-- historias_clinicas: cada médico ve y crea solo las suyas (el admin, todas)
alter table public.historias_clinicas enable row level security;
create policy "ver historias propias" on public.historias_clinicas
  for select to authenticated
  using ((medico_id = public.mi_medico_id()) or public.soy_admin());
create policy "crear historias propias" on public.historias_clinicas
  for insert to authenticated
  with check ((medico_id = public.mi_medico_id()) or public.soy_admin());

-- diagnosticos_pacientes: solo el propio médico (o un admin)
alter table public.diagnosticos_pacientes enable row level security;
create policy "diagnosticos_propios" on public.diagnosticos_pacientes
  for all to authenticated
  using (exists (select 1 from public.medicos m
                 where m.auth_user_id = auth.uid()
                   and (m.id = diagnosticos_pacientes.medico_id or m.rol = 'admin')))
  with check (exists (select 1 from public.medicos m
                      where m.auth_user_id = auth.uid()
                        and (m.id = diagnosticos_pacientes.medico_id or m.rol = 'admin')));

-- correos_enviados: sin políticas, solo el servidor (service role) lee y escribe
alter table public.correos_enviados enable row level security;

-- ---------------------------------------------------------------------
-- 12) Especialidades base (opcional, se pueden editar luego en Gestionar Médicos)
-- ---------------------------------------------------------------------
insert into public.especialidades (nombre, tipo_atencion) values
  ('Medicina General', 'medica'),
  ('Psicología',       'psicologica');

commit;

notify pgrst, 'reload schema';

-- =====================================================================
-- DATOS INICIALES: crear el usuario ADMINISTRADOR
-- =====================================================================
-- Paso A) En Supabase: Authentication > Users > "Add user" > "Create new user"
--         Email:    admin@agendamiento.internal   (el login usa "<usuario>@agendamiento.internal")
--         Password: la que quieras
--         Marcar "Auto Confirm User".
--
-- Paso B) Ejecutar esto para enlazarlo como administrador del sistema:
--
-- insert into public.medicos (nombre, especialidad, email, usuario, rol, auth_user_id, tiene_historia_clinica)
-- select 'Administrador', 'Administración', u.email, 'admin', 'admin', u.id, false
-- from auth.users u
-- where u.email = 'admin@agendamiento.internal';
--
-- Luego se ingresa al sistema con usuario "admin" y esa contraseña.
-- Los médicos se crean desde la pantalla "Gestionar Médicos".
-- =====================================================================
