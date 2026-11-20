// Genera una factura electrónica: valida los datos, recalcula los totales en el servidor
// (no se confía en los del navegador) y reenvía la factura a la API de facturación.
//
// Variables de entorno:
//   FACTURACION_API_URL  URL completa del endpoint que genera la factura (POST, JSON)
//   FACTURACION_API_KEY  opcional; se envía como "Authorization: Bearer <clave>"
//
// JSON que recibe la API de facturación:
// {
//   facturaId: string,                                // id del registro en la tabla facturas
//   medico:   { id, nombre, especialidad }            // para elegir el emisor (RUC, firma)
//   pacienteId: string | null,
//   cita:     { id, fechaHora } | null,               // cuando se factura una cita atendida
//   comprador: { tipoIdentificacion, identificacion, razonSocial, direccion, email, telefono },
//   detalles: [{ codigo, descripcion, cantidad, precioUnitario, descuento, codigoIva, tarifaIva, subtotal }],
//   totales:  { subtotalSinImpuestos, totalDescuento, totalIva, importeTotal,
//               impuestos: [{ codigoIva, tarifa, base, valor }] },
//   pagos:    [{ formaPago, total }],
//   informacionAdicional: [{ nombre, valor }]
// }
// Se espera que responda JSON; si trae { numero, claveAcceso, estado, mensaje } se muestran al médico.
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { obtenerMedicoSesion, leerBody, responderError, conManejoErrores } from '@/lib/adminAuth';
import {
  CONSUMIDOR_FINAL, FORMAS_PAGO, LIMITE_CONSUMIDOR_FINAL, TARIFAS_IVA, TIPOS_IDENTIFICACION,
  calcularTotales, validarComprador, validarDetalles,
  type CodigoFormaPago, type CodigoIva, type CompradorFactura, type DetalleFactura, type TipoIdentificacion,
} from '@/lib/facturacion';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_DETALLES = 50;
const ESTADOS_FACTURABLES = ['atendida', 'completada'];
const VIOLACION_UNICA = '23505';

const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const numero = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : NaN;
};

async function manejarPOST(req: NextRequest) {
  const sesion = await obtenerMedicoSesion(req);
  if (!sesion) return responderError('No autorizado.', 403);

  const body = await leerBody(req);
  if (!body || typeof body !== 'object') return responderError('Solicitud inválida.', 400);

  // Un médico factura a su nombre; el administrador puede elegir el médico de la agenda.
  const medicoId = sesion.rol === 'admin' ? texto(body.medicoId, 40) : sesion.id;
  if (!UUID.test(medicoId)) return responderError('Seleccione el médico que emite la factura.', 400);

  const { data: medico, error: errMedico } = await supabaseAdmin
    .from('medicos')
    .select('id, nombre, especialidad, rol')
    .eq('id', medicoId)
    .maybeSingle();
  if (errMedico) return responderError('No se pudo leer el médico emisor.', 500);
  if (!medico || medico.rol === 'admin') return responderError('El médico emisor no existe.', 400);

  let pacienteId = texto(body.pacienteId, 40);
  if (pacienteId && !UUID.test(pacienteId)) return responderError('Paciente inválido.', 400);

  // Factura de una cita: debe ser del médico emisor y estar atendida.
  const citaId = texto(body.citaId, 40);
  let fechaCita: string | null = null;
  if (citaId) {
    if (!UUID.test(citaId)) return responderError('Cita inválida.', 400);
    const { data: cita, error: errCita } = await supabaseAdmin
      .from('citas')
      .select('id, medico_id, paciente_id, estado, fecha_hora')
      .eq('id', citaId)
      .maybeSingle();
    if (errCita) return responderError('No se pudo leer la cita.', 500);
    if (!cita || cita.medico_id !== medicoId) return responderError('La cita no existe.', 404);
    if (!ESTADOS_FACTURABLES.includes(cita.estado)) {
      return responderError('Solo se pueden facturar citas atendidas.', 400);
    }
    pacienteId = cita.paciente_id;
    fechaCita = cita.fecha_hora;
  }

  // ---- Comprador
  const c = body.comprador || {};
  const tipo = texto(c.tipoIdentificacion, 2) as TipoIdentificacion;
  if (!(tipo in TIPOS_IDENTIFICACION)) return responderError('Tipo de identificación inválido.', 400);
  const comprador: CompradorFactura = tipo === '07'
    ? { tipoIdentificacion: '07', ...CONSUMIDOR_FINAL, direccion: '', email: texto(c.email, 254).toLowerCase(), telefono: texto(c.telefono, 20) }
    : {
        tipoIdentificacion: tipo,
        identificacion: texto(c.identificacion, 20).toUpperCase(),
        razonSocial: texto(c.razonSocial, 300),
        direccion: texto(c.direccion, 300),
        email: texto(c.email, 254).toLowerCase(),
        telefono: texto(c.telefono, 20),
      };

  // ---- Detalles
  if (!Array.isArray(body.detalles) || body.detalles.length > MAX_DETALLES) {
    return responderError('Detalle de la factura inválido.', 400);
  }
  const detalles: DetalleFactura[] = body.detalles.map((d: Record<string, unknown>) => ({
    codigo: texto(d?.codigo, 25) || 'SERV',
    descripcion: texto(d?.descripcion, 300),
    cantidad: numero(d?.cantidad),
    precioUnitario: numero(d?.precioUnitario),
    descuento: numero(d?.descuento ?? 0),
    codigoIva: texto(d?.codigoIva, 2) as CodigoIva,
  }));

  const errores = [...validarComprador(comprador), ...validarDetalles(detalles)];
  const formaPago = texto(body.formaPago, 2) as CodigoFormaPago;
  if (!(formaPago in FORMAS_PAGO)) errores.push('Forma de pago inválida.');
  if (errores.length) return responderError(errores.join(' '), 400);

  const totales = calcularTotales(detalles);
  if (tipo === '07' && totales.importeTotal > LIMITE_CONSUMIDOR_FINAL) {
    return responderError(
      `El SRI no permite facturar a consumidor final más de $${LIMITE_CONSUMIDOR_FINAL}. Ingrese los datos del cliente.`,
      400
    );
  }

  const observacion = texto(body.observacion, 300);
  const informacionAdicional = [
    comprador.direccion && { nombre: 'Dirección', valor: comprador.direccion },
    comprador.email && { nombre: 'Email', valor: comprador.email },
    comprador.telefono && { nombre: 'Teléfono', valor: comprador.telefono },
    observacion && { nombre: 'Observación', valor: observacion },
  ].filter(Boolean);

  const factura = {
    medico: { id: medico.id, nombre: medico.nombre, especialidad: medico.especialidad },
    pacienteId: pacienteId || null,
    cita: citaId ? { id: citaId, fechaHora: fechaCita } : null,
    comprador,
    detalles: totales.lineas.map((l) => ({ ...l, tarifaIva: TARIFAS_IVA[l.codigoIva].porcentaje })),
    totales: {
      subtotalSinImpuestos: totales.subtotalSinImpuestos,
      totalDescuento: totales.totalDescuento,
      totalIva: totales.totalIva,
      importeTotal: totales.importeTotal,
      impuestos: totales.impuestos,
    },
    pagos: [{ formaPago, total: totales.importeTotal }],
    informacionAdicional,
  };

  // ---- Envío a la API de facturación
  const url = process.env.FACTURACION_API_URL;
  if (!url) {
    return responderError(
      'La API de facturación electrónica aún no está configurada (falta FACTURACION_API_URL).',
      503
    );
  }

  // Se registra la factura ANTES de llamar a la API: el índice único por cita impide
  // que dos clics (o dos médicos) facturen la misma cita al mismo tiempo.
  const { data: registro, error: errRegistro } = await supabaseAdmin
    .from('facturas')
    .insert([{
      medico_id: medicoId,
      paciente_id: pacienteId || null,
      cita_id: citaId || null,
      tipo_identificacion: comprador.tipoIdentificacion,
      identificacion: comprador.identificacion,
      razon_social: comprador.razonSocial,
      importe_total: totales.importeTotal,
      estado: 'procesando',
    }])
    .select('id')
    .single();
  if (errRegistro) {
    if (errRegistro.code === VIOLACION_UNICA) return responderError('Esta cita ya fue facturada.', 409);
    console.error('[facturacion] No se pudo registrar la factura:', errRegistro.message);
    return responderError('No se pudo registrar la factura (¿se ejecutó la migración 07?).', 500);
  }

  const marcarError = async (mensaje: string) => {
    const { error } = await supabaseAdmin.from('facturas').update({ estado: 'error', error: mensaje.slice(0, 1000) }).eq('id', registro.id);
    if (error) console.error('[facturacion] No se pudo marcar el error:', error.message);
  };

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (process.env.FACTURACION_API_KEY) headers.Authorization = `Bearer ${process.env.FACTURACION_API_KEY}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...factura, facturaId: registro.id }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (err) {
    const detalle = err instanceof Error ? err.message : String(err);
    console.error('[facturacion] No se pudo conectar con la API:', detalle);
    await marcarError('Sin conexión con la API: ' + detalle);
    return responderError('No se pudo conectar con la API de facturación. Intente nuevamente.', 502);
  }

  const respuesta = await res.json().catch(() => null);
  if (!res.ok) {
    const mensaje = (respuesta && (respuesta.error || respuesta.mensaje)) || `La API de facturación respondió ${res.status}.`;
    console.error('[facturacion] La API rechazó la factura:', res.status, mensaje);
    await marcarError(String(mensaje));
    return responderError(String(mensaje), res.status >= 500 ? 502 : 400);
  }

  const { error: errActualizar } = await supabaseAdmin
    .from('facturas')
    .update({
      estado: 'generada',
      numero: typeof respuesta?.numero === 'string' ? respuesta.numero.slice(0, 50) : null,
      clave_acceso: typeof respuesta?.claveAcceso === 'string' ? respuesta.claveAcceso.slice(0, 60) : null,
      respuesta,
    })
    .eq('id', registro.id);
  // La factura ya se emitió: no se devuelve error al médico, solo se deja constancia.
  if (errActualizar) console.error('[facturacion] Factura emitida pero no se pudo actualizar su registro:', errActualizar.message);

  return NextResponse.json({ ok: true, facturaId: registro.id, totales: factura.totales, resultado: respuesta });
}

export const POST = conManejoErrores(manejarPOST);
