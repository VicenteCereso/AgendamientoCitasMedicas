-- =====================================================================
-- Migración: registro de correos enviados (control del cupo de Brevo).
-- Idempotente. Ejecutar en cada ambiente (desarrollo y producción).
-- =====================================================================
create table if not exists public.correos_enviados (
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
create index if not exists correos_enviados_created_idx on public.correos_enviados (created_at desc);
create index if not exists correos_enviados_cita_idx on public.correos_enviados (cita_id);

-- Sin políticas: solo el servidor (service role) puede leer y escribir
alter table public.correos_enviados enable row level security;

notify pgrst, 'reload schema';
