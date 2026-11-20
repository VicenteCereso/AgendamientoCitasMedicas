import { supabase } from '@/lib/supabaseClient';
import type { CodigoFormaPago, CompradorFactura, DetalleFactura, TipoIdentificacion } from '@/lib/facturacion';

export interface DatosFacturacionGuardados {
  tipoIdentificacion: Exclude<TipoIdentificacion, '07'>;
  identificacion: string;
  razonSocial: string;
  direccion: string;
  email: string;
  telefono: string;
  actualizado: string;
}

export interface ResultadoFactura {
  numero?: string;
  claveAcceso?: string;
  estado?: string;
  mensaje?: string;
  [clave: string]: unknown;
}

export interface CitaPorFacturar {
  id: string;
  fecha_hora: string;
  tipo_consulta: string;
  pacientes: { id: string; nombre: string; cedula: string | null; telefono: string | null; email: string | null } | null;
}

export const FacturacionService = {
  // Citas atendidas del médico que todavía no tienen una factura vigente (los intentos con error no cuentan),
  // de la más reciente a la más antigua.
  async obtenerCitasPorFacturar(medicoId: string, limite = 30): Promise<CitaPorFacturar[]> {
    if (!medicoId) return [];
    const { data, error } = await supabase
      .from('citas')
      .select('id, fecha_hora, tipo_consulta, pacientes(id, nombre, cedula, telefono, email), facturas!left(id)')
      .eq('medico_id', medicoId)
      .in('estado', ['atendida', 'completada'])
      .neq('facturas.estado', 'error')
      .is('facturas', null)
      .order('fecha_hora', { ascending: false })
      .limit(limite);

    if (error) throw error;
    return (data || []) as unknown as CitaPorFacturar[];
  },

  // Datos con los que se facturó al paciente la última vez (null si nunca se le facturó).
  async obtenerDatosPaciente(pacienteId: string): Promise<DatosFacturacionGuardados | null> {
    const { data, error } = await supabase
      .from('datos_facturacion')
      .select('tipo_identificacion, identificacion, razon_social, direccion, email, telefono, updated_at')
      .eq('paciente_id', pacienteId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return {
      tipoIdentificacion: data.tipo_identificacion,
      identificacion: data.identificacion,
      razonSocial: data.razon_social,
      direccion: data.direccion || '',
      email: data.email || '',
      telefono: data.telefono || '',
      actualizado: data.updated_at,
    };
  },

  async guardarDatosPaciente(pacienteId: string, medicoId: string, c: CompradorFactura) {
    if (c.tipoIdentificacion === '07') return; // consumidor final: no se guarda
    const { error } = await supabase.from('datos_facturacion').upsert(
      [{
        paciente_id: pacienteId,
        tipo_identificacion: c.tipoIdentificacion,
        identificacion: c.identificacion.trim().toUpperCase(),
        razon_social: c.razonSocial.trim(),
        direccion: c.direccion.trim() || null,
        email: c.email.trim().toLowerCase() || null,
        telefono: c.telefono.trim() || null,
        updated_at: new Date().toISOString(),
        updated_by: medicoId || null,
      }],
      { onConflict: 'paciente_id' }
    );
    if (error) throw error;
  },

  async generarFactura(datos: {
    medicoId: string;
    pacienteId: string | null;
    citaId: string | null;
    comprador: CompradorFactura;
    detalles: DetalleFactura[];
    formaPago: CodigoFormaPago;
    observacion: string;
  }): Promise<ResultadoFactura | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');

    const res = await fetch('/api/facturacion/generar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(datos),
    });
    const json = await res.json().catch(() => null);
    if (!json) throw new Error(`El servidor respondió con un error inesperado (${res.status}).`);
    if (!res.ok) throw new Error(json.error || 'No se pudo generar la factura.');
    return json.resultado ?? null;
  },
};
