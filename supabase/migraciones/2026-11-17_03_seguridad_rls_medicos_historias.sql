-- =====================================================================
-- Migración: seguridad (RLS) de médicos e historias clínicas + estados de cita.
-- Replica en PROD lo que ya existe en DESARROLLO. Idempotente.
--
-- ANTES DE EJECUTAR EN PROD:
--   1) Compara las funciones con las de desarrollo (ver consulta al final).
--   2) Revisa que no haya citas con estados fuera de la lista (consulta al final).
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- 1) Funciones auxiliares para las políticas
--    SECURITY DEFINER: leen medicos sin depender de su RLS.
--    Texto idéntico al de desarrollo (para que la comparación de esquema coincida).
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
-- 2) medicos: solo lectura desde el navegador; las escrituras van por la API (service role)
-- ---------------------------------------------------------------------
alter table public.medicos enable row level security;

drop policy if exists "medicos_lectura" on public.medicos;
create policy "medicos_lectura" on public.medicos
  for select to authenticated using (true);

-- La agenda pública (sin sesión) necesita listar médicos. Se le permite leer solo
-- los médicos (no el admin) y solo columnas públicas: nunca email, usuario ni auth_user_id.
drop policy if exists "medicos_lectura_publica" on public.medicos;
create policy "medicos_lectura_publica" on public.medicos
  for select to anon using (rol is distinct from 'admin');

revoke select on public.medicos from anon;
grant select (id, nombre, especialidad, especialidad_id, direccion, consultorio, rol) on public.medicos to anon;

-- ---------------------------------------------------------------------
-- 3) historias_clinicas: cada médico ve y crea solo las suyas (el admin, todas)
-- ---------------------------------------------------------------------
alter table public.historias_clinicas enable row level security;

drop policy if exists "ver historias propias" on public.historias_clinicas;
create policy "ver historias propias" on public.historias_clinicas
  for select to authenticated
  using ((medico_id = public.mi_medico_id()) or public.soy_admin());

drop policy if exists "crear historias propias" on public.historias_clinicas;
create policy "crear historias propias" on public.historias_clinicas
  for insert to authenticated
  with check ((medico_id = public.mi_medico_id()) or public.soy_admin());

-- ---------------------------------------------------------------------
-- 4) Estados válidos de una cita
--    NOT VALID: se aplica a citas nuevas o modificadas sin fallar por datos antiguos.
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'citas_estado_check') then
    alter table public.citas add constraint citas_estado_check
      check (estado = any (array['pendiente', 'confirmada', 'atendida', 'completada', 'cancelada', 'no_asistio']))
      not valid;
  end if;
end $$;

commit;

notify pgrst, 'reload schema';

-- =====================================================================
-- CONSULTAS DE APOYO (ejecutar por separado)
-- =====================================================================

-- a) Definición de las funciones en DESARROLLO (para confirmar que son equivalentes a las de arriba):
-- select pg_get_functiondef('public.mi_medico_id'::regproc);
-- select pg_get_functiondef('public.soy_admin'::regproc);

-- b) Citas con estados que la restricción no permite (debe devolver 0 filas):
-- select estado, count(*) from public.citas
-- where estado is not null
--   and estado not in ('pendiente', 'confirmada', 'atendida', 'completada', 'cancelada', 'no_asistio')
-- group by estado;

-- c) Si (b) no devuelve filas, validar la restricción también para los datos antiguos:
-- alter table public.citas validate constraint citas_estado_check;
