-- =====================================================================
-- 06) Datos de facturación electrónica de cada paciente
--
-- Guarda los datos con los que se facturó al paciente la última vez para
-- precargarlos en la pestaña "Facturación Electrónica". Pueden ser distintos
-- a los de la ficha (ej. se factura al RUC de una empresa o de un familiar).
-- Las facturas a CONSUMIDOR FINAL no se guardan aquí.
--
-- Acceso: igual que pacientes (directorio compartido por los médicos con
-- sesión); el navegador sin sesión (anon) no tiene acceso.
--
-- Idempotente. Ejecutar en DESARROLLO y en PRODUCCIÓN.
-- =====================================================================
begin;

create table if not exists public.datos_facturacion (
  paciente_id         uuid primary key references public.pacientes(id) on delete cascade,
  tipo_identificacion text not null check (tipo_identificacion in ('04', '05', '06', '08')),
  identificacion      text not null,
  razon_social        text not null,
  direccion           text,
  email               text,
  telefono            text,
  updated_at          timestamptz not null default now(),
  updated_by          uuid references public.medicos(id) on delete set null
);

alter table public.datos_facturacion enable row level security;
drop policy if exists "datos_facturacion_medicos" on public.datos_facturacion;
create policy "datos_facturacion_medicos" on public.datos_facturacion
  for all to authenticated
  using ((select public.mi_medico_id()) is not null)
  with check ((select public.mi_medico_id()) is not null);

revoke all on public.datos_facturacion from anon;

commit;

notify pgrst, 'reload schema';
