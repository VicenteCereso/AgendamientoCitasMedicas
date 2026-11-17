-- =====================================================================
-- 05) (OPCIONAL) Regenerar enlaces de videollamada adivinables
--
-- Antes, la sala de Jitsi se armaba con 5 caracteres del id del médico + fecha + hora
-- (https://meet.jit.si/ConsultaMedica-xxxxx-2026-11-20-1500), así que cualquiera que
-- conociera el id del médico podía adivinarla. Desde esta versión cada cita nueva
-- recibe una sala aleatoria (AgendaMedica-<uuid>).
--
-- Este script cambia el enlace de las citas FUTURAS que aún tienen el formato viejo.
-- ATENCIÓN: a esos pacientes ya les llegó el enlace viejo por correo. Si se cambia,
-- el paciente entraría a una sala distinta a la del médico. Antes de ejecutar el
-- UPDATE, revisar la lista del paso 1 y avisar a cada paciente su nuevo enlace
-- (el médico lo ve en su panel).
-- =====================================================================

-- Paso 1) Ver qué citas se verían afectadas
select c.id, c.fecha_hora, c.estado, m.nombre as medico, p.nombre as paciente,
       p.email, p.telefono, c.enlace_videollamada
from public.citas c
join public.medicos m   on m.id = c.medico_id
join public.pacientes p on p.id = c.paciente_id
where c.enlace_videollamada like '%meet.jit.si/ConsultaMedica-%'
  and c.fecha_hora >= (now() at time zone 'America/Guayaquil')
  and c.estado not in ('cancelada', 'atendida', 'completada', 'no_asistio')
order by c.fecha_hora;

-- Paso 2) Regenerar (descomentar para ejecutar)
-- update public.citas c
-- set enlace_videollamada = 'https://meet.jit.si/AgendaMedica-' || gen_random_uuid()
-- where c.enlace_videollamada like '%meet.jit.si/ConsultaMedica-%'
--   and c.fecha_hora >= (now() at time zone 'America/Guayaquil')
--   and c.estado not in ('cancelada', 'atendida', 'completada', 'no_asistio')
-- returning c.id, c.fecha_hora, c.enlace_videollamada;
