-- =====================================================================
-- 07) Registro de facturas electrónicas generadas desde el sistema
--
-- Cada intento de facturación queda registrado. Sirve para:
--   * saber qué citas atendidas faltan por facturar, y
--   * impedir que una misma cita se facture dos veces: solo puede haber una
--     factura "procesando" o "generada" por cita. Si la API falla, el intento
--     queda en estado "error" y la cita se puede volver a facturar.
--
-- Escrituras: solo el servidor (/api/facturacion/generar, service role).
-- Lectura: cada médico sus facturas; el admin, todas.
--
-- Requiere la migración 06. Idempotente. Ejecutar en DESARROLLO y en PRODUCCIÓN.
-- =====================================================================
begin;

create table if not exists public.facturas (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  medico_id           uuid not null references public.medicos(id) on delete restrict,
  paciente_id         uuid references public.pacientes(id) on delete set null,
  cita_id             uuid references public.citas(id) on delete set null,
  tipo_identificacion text not null,
  identificacion      text not null,
  razon_social        text not null,
  importe_total       numeric(12, 2) not null,
  estado              text not null default 'procesando' check (estado in ('procesando', 'generada', 'error')),
  numero              text,
  clave_acceso        text,
  respuesta           jsonb,
  error               text
);

-- Una sola factura vigente por cita (los intentos con error no cuentan)
create unique index if not exists facturas_cita_vigente_uidx
  on public.facturas (cita_id) where cita_id is not null and estado <> 'error';
create index if not exists facturas_medico_created_idx on public.facturas (medico_id, created_at desc);

alter table public.facturas enable row level security;
drop policy if exists "facturas_lectura_propias" on public.facturas;
create policy "facturas_lectura_propias" on public.facturas
  for select to authenticated
  using (medico_id = (select public.mi_medico_id()) or (select public.soy_admin()));

revoke all on public.facturas from anon;

commit;

notify pgrst, 'reload schema';
