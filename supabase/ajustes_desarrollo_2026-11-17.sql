-- =====================================================================
-- Ajustes SOLO PARA DESARROLLO, para que quede igual a producción.
-- =====================================================================
begin;

-- Índice duplicado: medicos_usuario_unico ya hace lo mismo
drop index if exists public.medicos_usuario_key;

-- Igualar el índice de series al de producción (parcial)
drop index if exists public.citas_serie_id_idx;
create index citas_serie_id_idx on public.citas (serie_id) where serie_id is not null;

-- Columna que el código no usa (el control de "un correo por cita" lo hace correos_enviados).
-- Comentar esta línea si se creó para otro propósito.
alter table public.citas drop column if exists correo_confirmacion_at;

-- Agenda pública: permitir a los visitantes sin sesión listar médicos (solo columnas públicas).
-- Sin esto, con RLS activado en medicos, la página /agendar no muestra ningún médico.
drop policy if exists "medicos_lectura_publica" on public.medicos;
create policy "medicos_lectura_publica" on public.medicos
  for select to anon using (rol is distinct from 'admin');
revoke select on public.medicos from anon;
grant select (id, nombre, especialidad, especialidad_id, direccion, consultorio, rol) on public.medicos to anon;

commit;

notify pgrst, 'reload schema';
