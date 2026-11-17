-- =====================================================================
-- 04) RLS en pacientes, citas, disponibilidad_medico y recetas_medicas
--
-- Corrige la alerta de Supabase "Table publicly accessible"
-- (rls_disabled_in_public): sin RLS, cualquiera con la URL del proyecto y la
-- clave anon (que es pública, va en el navegador) podía leer, editar y borrar
-- estas tablas.
--
-- Quién accede después de este script:
--   * Navegador SIN sesión (anon): nada. La agenda pública y "Consultar mis
--     citas" pasan por las rutas /api/agenda/* del servidor (service role,
--     que no está sujeto a RLS).
--   * Médico con sesión: sus propias citas, horarios y recetas; el directorio
--     de pacientes es compartido entre los médicos del sistema.
--   * Administrador (rol = 'admin'): todo.
--   * Un usuario de Auth que no esté vinculado a un médico: nada.
--
-- IMPORTANTE: desplegar primero la versión de la app que usa /api/agenda/mis-citas
-- y /api/agenda/cancelar; si no, la página /consultar deja de mostrar citas.
--
-- Se puede ejecutar más de una vez. Ejecutar en DESARROLLO y en PRODUCCIÓN.
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- pacientes: directorio compartido por los médicos del sistema
-- ---------------------------------------------------------------------
alter table public.pacientes enable row level security;
drop policy if exists "pacientes_medicos" on public.pacientes;
create policy "pacientes_medicos" on public.pacientes
  for all to authenticated
  using ((select public.mi_medico_id()) is not null)
  with check ((select public.mi_medico_id()) is not null);

-- ---------------------------------------------------------------------
-- citas: cada médico las suyas; el admin, todas
-- ---------------------------------------------------------------------
alter table public.citas enable row level security;
drop policy if exists "citas_propias" on public.citas;
create policy "citas_propias" on public.citas
  for all to authenticated
  using (medico_id = (select public.mi_medico_id()) or (select public.soy_admin()))
  with check (medico_id = (select public.mi_medico_id()) or (select public.soy_admin()));

-- ---------------------------------------------------------------------
-- disponibilidad_medico: cada médico sus horarios; el admin, todos
-- ---------------------------------------------------------------------
alter table public.disponibilidad_medico enable row level security;
drop policy if exists "disponibilidad_propia" on public.disponibilidad_medico;
create policy "disponibilidad_propia" on public.disponibilidad_medico
  for all to authenticated
  using (medico_id = (select public.mi_medico_id()) or (select public.soy_admin()))
  with check (medico_id = (select public.mi_medico_id()) or (select public.soy_admin()));

-- ---------------------------------------------------------------------
-- recetas_medicas: cada médico las suyas; el admin, todas
-- ---------------------------------------------------------------------
alter table public.recetas_medicas enable row level security;
drop policy if exists "recetas_propias" on public.recetas_medicas;
create policy "recetas_propias" on public.recetas_medicas
  for all to authenticated
  using (medico_id = (select public.mi_medico_id()) or (select public.soy_admin()))
  with check (medico_id = (select public.mi_medico_id()) or (select public.soy_admin()));

-- Defensa adicional: el rol anon no tiene ningún permiso sobre estas tablas
revoke all on public.pacientes, public.citas, public.disponibilidad_medico, public.recetas_medicas from anon;

commit;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------
-- Verificación: todas las tablas de public deben tener rls = true
-- ---------------------------------------------------------------------
-- select c.relname as tabla, c.relrowsecurity as rls
-- from pg_class c join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public' and c.relkind = 'r'
-- order by 1;
