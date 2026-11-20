'use client';

// Pestaña "Facturación Electrónica": busca al paciente, precarga sus datos de facturación
// (los de su última factura o, si no tiene, los de su ficha), permite completarlos o editarlos
// y genera la factura a través de /api/facturacion/generar.
// La página lo monta con key={medicoId}: al cambiar de médico (admin) empieza una factura nueva.
import { useEffect, useMemo, useRef, useState } from 'react';
import { MedicoService } from '@/services/medico.service';
import { FacturacionService, type CitaPorFacturar, type ResultadoFactura } from '@/services/facturacion.service';
import {
  CONSUMIDOR_FINAL, FORMAS_PAGO, LIMITE_CONSUMIDOR_FINAL, TARIFAS_IVA, TIPOS_IDENTIFICACION,
  calcularTotales, deducirTipoIdentificacion, validarComprador, validarDetalles,
  type CodigoFormaPago, type CodigoIva, type CompradorFactura, type DetalleFactura, type TipoIdentificacion,
} from '@/lib/facturacion';

interface PacienteBusqueda {
  id: string;
  nombre: string;
  cedula?: string | null;
  telefono?: string | null;
  email?: string | null;
}

// Las cantidades se editan como texto para permitir escribir "12." o dejar el campo vacío.
interface LineaEditable {
  clave: number;
  codigo: string;
  descripcion: string;
  cantidad: string;
  precioUnitario: string;
  descuento: string;
  codigoIva: CodigoIva;
}

interface Props {
  medicoId: string;
  especialidad?: string;
  // Cita a facturar al abrir la pestaña (botón "Facturar ahora" tras atender una consulta)
  citaInicialId?: string | null;
  onCitaInicialUsada?: () => void;
}

const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString('es-EC');
const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString('es-EC', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const COMPRADOR_VACIO: CompradorFactura = {
  tipoIdentificacion: '05', identificacion: '', razonSocial: '', direccion: '', email: '', telefono: '',
};

const claseInput = 'w-full p-2.5 border border-slate-200 rounded-xl text-xs bg-white font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600/20 disabled:bg-slate-100 disabled:text-slate-500';
const claseLabel = 'block text-[11px] font-bold text-slate-700 mb-1';
const dinero = (n: number) => `$${n.toFixed(2)}`;
const aNumero = (s: string) => (s.trim() === '' ? 0 : Number(s.replace(',', '.')));

let siguienteClave = 1;
function lineaNueva(descripcion = ''): LineaEditable {
  return { clave: siguienteClave++, codigo: 'CONSULTA', descripcion, cantidad: '1', precioUnitario: '', descuento: '', codigoIva: '0' };
}

export default function Facturacion({ medicoId, especialidad, citaInicialId, onCitaInicialUsada }: Props) {
  const descripcionInicial = `Consulta ${especialidad ? `de ${especialidad}` : 'médica'}`;

  // ---- Citas atendidas pendientes de facturar
  const [citasPorFacturar, setCitasPorFacturar] = useState<CitaPorFacturar[]>([]);
  const [cargandoCitas, setCargandoCitas] = useState(true);
  const [errorCitas, setErrorCitas] = useState('');
  const [citaSeleccionada, setCitaSeleccionada] = useState<CitaPorFacturar | null>(null);

  // ---- Búsqueda de paciente
  const [busqueda, setBusqueda] = useState('');
  const [sugerencias, setSugerencias] = useState<PacienteBusqueda[]>([]);
  const [buscando, setBuscando] = useState(false);
  const busquedaIdRef = useRef(0);

  // ---- Datos de la factura
  const [paciente, setPaciente] = useState<PacienteBusqueda | null>(null);
  const [origenDatos, setOrigenDatos] = useState<{ tipo: 'guardados' | 'ficha'; fecha?: string } | null>(null);
  const [cargandoDatos, setCargandoDatos] = useState(false);
  const [comprador, setComprador] = useState<CompradorFactura>(COMPRADOR_VACIO);
  const [lineas, setLineas] = useState<LineaEditable[]>(() => [lineaNueva(descripcionInicial)]);
  const [formaPago, setFormaPago] = useState<CodigoFormaPago>('01');
  const [observacion, setObservacion] = useState('');

  const [intentado, setIntentado] = useState(false);
  const [guardandoDatos, setGuardandoDatos] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState('');
  const [aviso, setAviso] = useState('');
  const [resultado, setResultado] = useState<ResultadoFactura | null>(null);

  const esConsumidorFinal = comprador.tipoIdentificacion === '07';

  // Búsqueda con espera de 300 ms; se descartan respuestas de búsquedas anteriores.
  useEffect(() => {
    const termino = busqueda.trim();
    const id = ++busquedaIdRef.current;
    if (!termino || paciente) return;
    const t = window.setTimeout(async () => {
      setBuscando(true);
      try {
        const res = await MedicoService.buscarPacientesPorCriterio(termino);
        if (id === busquedaIdRef.current) setSugerencias(res as PacienteBusqueda[]);
      } catch (err) {
        console.error('Error buscando pacientes:', err);
      } finally {
        if (id === busquedaIdRef.current) setBuscando(false);
      }
    }, 300);
    return () => window.clearTimeout(t);
  }, [busqueda, paciente]);

  function recargarCitasPorFacturar() {
    return FacturacionService.obtenerCitasPorFacturar(medicoId)
      .then((lista) => { setCitasPorFacturar(lista); setErrorCitas(''); return lista; })
      .catch((err) => {
        setErrorCitas('No se pudieron cargar las citas atendidas: ' + (err instanceof Error ? err.message : String(err)));
        return [] as CitaPorFacturar[];
      })
      .finally(() => setCargandoCitas(false));
  }

  async function facturarCita(cita: CitaPorFacturar) {
    if (!cita.pacientes) return;
    await seleccionarPaciente(cita.pacientes);
    setCitaSeleccionada(cita);
    setLineas([lineaNueva(`${descripcionInicial} — ${fechaCorta(cita.fecha_hora)}`)]);
  }

  async function seleccionarPaciente(p: PacienteBusqueda) {
    setCitaSeleccionada(null);
    setPaciente(p);
    setBusqueda(p.nombre);
    setSugerencias([]);
    setBuscando(false);
    setResultado(null);
    setErrorGeneral('');
    setAviso('');
    setIntentado(false);
    setCargandoDatos(true);
    try {
      const guardados = await FacturacionService.obtenerDatosPaciente(p.id);
      if (guardados) {
        const { actualizado, ...datos } = guardados;
        setComprador(datos);
        setOrigenDatos({ tipo: 'guardados', fecha: actualizado });
      } else {
        const cedula = (p.cedula || '').trim();
        setComprador({
          tipoIdentificacion: cedula ? deducirTipoIdentificacion(cedula) : '05',
          identificacion: cedula,
          razonSocial: p.nombre || '',
          direccion: '',
          email: p.email || '',
          telefono: p.telefono || '',
        });
        setOrigenDatos({ tipo: 'ficha' });
      }
    } catch (err) {
      setErrorGeneral('No se pudieron cargar los datos de facturación: ' + (err instanceof Error ? err.message : String(err)));
    }
    setCargandoDatos(false);
  }

  // Carga inicial; si se llegó con una cita para facturar, se abre directamente.
  useEffect(() => {
    if (!medicoId) return;
    recargarCitasPorFacturar().then((lista) => {
      if (!citaInicialId) return;
      const cita = lista.find((c) => c.id === citaInicialId);
      if (cita) facturarCita(cita);
      onCitaInicialUsada?.();
    });
    // Solo al montar: la página remonta el componente al cambiar de médico (key).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function facturarConsumidorFinal() {
    setCitaSeleccionada(null);
    setPaciente(null);
    setBusqueda('');
    setSugerencias([]);
    setOrigenDatos(null);
    setResultado(null);
    setErrorGeneral('');
    setAviso('');
    setIntentado(false);
    setComprador({ ...COMPRADOR_VACIO, tipoIdentificacion: '07', ...CONSUMIDOR_FINAL });
  }

  function nuevaFactura() {
    setCitaSeleccionada(null);
    setPaciente(null);
    setBusqueda('');
    setSugerencias([]);
    setOrigenDatos(null);
    setComprador(COMPRADOR_VACIO);
    setLineas([lineaNueva(descripcionInicial)]);
    setFormaPago('01');
    setObservacion('');
    setResultado(null);
    setErrorGeneral('');
    setAviso('');
    setIntentado(false);
  }

  function cambiarTipo(tipo: TipoIdentificacion) {
    if (tipo === '07') {
      setComprador((c) => ({ ...c, tipoIdentificacion: '07', ...CONSUMIDOR_FINAL }));
    } else if (comprador.tipoIdentificacion === '07') {
      // Al salir de consumidor final se limpian los valores fijos.
      setComprador((c) => ({ ...c, tipoIdentificacion: tipo, identificacion: '', razonSocial: paciente?.nombre || '' }));
    } else {
      setComprador((c) => ({ ...c, tipoIdentificacion: tipo }));
    }
  }

  const campo = (k: keyof CompradorFactura) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setComprador((c) => ({ ...c, [k]: e.target.value }));

  function cambiarLinea(clave: number, cambios: Partial<LineaEditable>) {
    setLineas((ls) => ls.map((l) => (l.clave === clave ? { ...l, ...cambios } : l)));
  }

  // ---- Cálculos y validaciones (en vivo)
  const detalles: DetalleFactura[] = useMemo(
    () => lineas.map((l) => ({
      codigo: l.codigo.trim() || 'SERV',
      descripcion: l.descripcion,
      cantidad: aNumero(l.cantidad),
      precioUnitario: aNumero(l.precioUnitario),
      descuento: aNumero(l.descuento),
      codigoIva: l.codigoIva,
    })),
    [lineas]
  );

  const totales = useMemo(() => {
    const validos = detalles.map((d) => ({
      ...d,
      cantidad: Number.isFinite(d.cantidad) ? d.cantidad : 0,
      precioUnitario: Number.isFinite(d.precioUnitario) ? d.precioUnitario : 0,
      descuento: Number.isFinite(d.descuento) ? d.descuento : 0,
    }));
    return calcularTotales(validos);
  }, [detalles]);

  const errores = useMemo(() => {
    const lista = [...validarComprador(comprador), ...validarDetalles(detalles)];
    if (esConsumidorFinal && totales.importeTotal > LIMITE_CONSUMIDOR_FINAL) {
      lista.push(`El SRI no permite facturar a consumidor final más de ${dinero(LIMITE_CONSUMIDOR_FINAL)}. Ingrese los datos del cliente.`);
    }
    return lista;
  }, [comprador, detalles, esConsumidorFinal, totales.importeTotal]);

  const hayComprador = !!paciente || esConsumidorFinal;
  const ocupado = generando || guardandoDatos || cargandoDatos;

  async function guardarDatos() {
    if (!paciente || esConsumidorFinal) return;
    const problemas = validarComprador(comprador);
    if (problemas.length) {
      setIntentado(true);
      return;
    }
    setGuardandoDatos(true);
    setErrorGeneral('');
    try {
      await FacturacionService.guardarDatosPaciente(paciente.id, medicoId, comprador);
      setOrigenDatos({ tipo: 'guardados', fecha: new Date().toISOString() });
      setAviso('Datos de facturación guardados.');
    } catch (err) {
      setErrorGeneral('No se pudieron guardar los datos: ' + (err instanceof Error ? err.message : String(err)));
    }
    setGuardandoDatos(false);
  }

  async function generar() {
    setIntentado(true);
    setAviso('');
    setErrorGeneral('');
    if (errores.length || !medicoId) return;
    if (!window.confirm(`¿Generar la factura por ${dinero(totales.importeTotal)} a nombre de ${comprador.razonSocial}?`)) return;

    setGenerando(true);
    try {
      // Se guardan primero los datos del cliente para la próxima vez, aunque la API falle.
      if (paciente && !esConsumidorFinal) {
        await FacturacionService.guardarDatosPaciente(paciente.id, medicoId, comprador);
      }
      const res = await FacturacionService.generarFactura({
        medicoId,
        pacienteId: paciente?.id || null,
        citaId: citaSeleccionada?.id || null,
        comprador,
        detalles,
        formaPago,
        observacion: observacion.trim(),
      });
      setResultado(res || { mensaje: 'Factura generada.' });
    } catch (err) {
      setErrorGeneral(err instanceof Error ? err.message : String(err));
    }
    setGenerando(false);
    // La cita pudo quedar facturada (o facturarla otro médico mientras tanto): se actualiza la lista.
    if (citaSeleccionada) recargarCitasPorFacturar();
  }

  // ---------------------------------------------------------------- Vista
  if (resultado) {
    return (
      <div className="bg-slate-50/70 p-6 rounded-3xl border border-slate-200/80 space-y-4">
        <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2">
          <h3 className="text-sm font-extrabold text-emerald-900">✅ {resultado.mensaje || 'Factura generada'}</h3>
          <div className="text-xs text-emerald-800 space-y-1">
            <p><strong>Cliente:</strong> {comprador.razonSocial} ({comprador.identificacion})</p>
            {citaSeleccionada && <p><strong>Cita:</strong> {fechaHora(citaSeleccionada.fecha_hora)}</p>}
            <p><strong>Total:</strong> {dinero(totales.importeTotal)}</p>
            {resultado.numero && <p><strong>Número:</strong> {resultado.numero}</p>}
            {resultado.estado && <p><strong>Estado SRI:</strong> {resultado.estado}</p>}
            {resultado.claveAcceso && <p className="break-all"><strong>Clave de acceso:</strong> {resultado.claveAcceso}</p>}
          </div>
        </div>
        <button onClick={nuevaFactura} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2.5 px-5 rounded-xl shadow-sm transition">
          ➕ Nueva factura
        </button>
      </div>
    );
  }

  return (
    <div className="bg-slate-50/70 p-6 rounded-3xl border border-slate-200/80 space-y-6">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div className="space-y-1">
          <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">🧾 Facturación Electrónica</h3>
          <p className="text-xs text-slate-500 font-medium">
            Busque al paciente para cargar sus datos de facturación, complételos o edítelos y genere la factura.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={facturarConsumidorFinal}
            className="bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold py-2.5 px-4 rounded-xl border border-slate-200 transition"
          >
            👤 Consumidor final
          </button>
          {hayComprador && (
            <button
              type="button"
              onClick={nuevaFactura}
              className="bg-white hover:bg-slate-100 text-slate-500 text-xs font-bold py-2.5 px-4 rounded-xl border border-slate-200 transition"
            >
              ✕ Limpiar
            </button>
          )}
        </div>
      </div>

      {/* CITAS ATENDIDAS PENDIENTES DE FACTURAR */}
      {!hayComprador && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
              🩺 Citas atendidas pendientes de facturar {!cargandoCitas && `(${citasPorFacturar.length})`}
            </h4>
            <button
              type="button"
              onClick={() => { setCargandoCitas(true); recargarCitasPorFacturar(); }}
              className="text-[11px] font-bold text-blue-600 hover:text-blue-800"
            >
              ↻ Actualizar
            </button>
          </div>

          {cargandoCitas ? (
            <p className="text-xs text-slate-500 py-2">Cargando citas atendidas...</p>
          ) : errorCitas ? (
            <p className="text-xs text-rose-600 font-semibold py-2">⚠️ {errorCitas}</p>
          ) : citasPorFacturar.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-2">No hay citas atendidas pendientes de facturar.</p>
          ) : (
            <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-xl">
              {citasPorFacturar.map((c) => (
                <div key={c.id} className="flex justify-between items-center gap-3 p-3 text-xs hover:bg-slate-50">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate">{c.pacientes?.nombre || 'Paciente eliminado'}</p>
                    <p className="text-[11px] text-slate-500">
                      🗓️ {fechaHora(c.fecha_hora)} · {c.tipo_consulta === 'telemedicina' ? '🎥 Telemedicina' : '🏥 Presencial'}
                      {c.pacientes?.cedula ? ` · 🪪 ${c.pacientes.cedula}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => facturarCita(c)}
                    disabled={!c.pacientes}
                    className="shrink-0 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-[11px] font-bold py-2 px-3.5 rounded-xl transition"
                  >
                    🧾 Facturar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* BUSCAR PACIENTE (factura sin cita) */}
      <div className="relative">
        <label className={claseLabel}>
          {hayComprador ? 'Paciente' : 'O busque un paciente para facturar sin cita (cédula o nombre)'}
        </label>
        <input
          type="text"
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value);
            if (paciente) { setPaciente(null); setOrigenDatos(null); setCitaSeleccionada(null); }
            if (!e.target.value.trim()) { setSugerencias([]); setBuscando(false); }
          }}
          placeholder="Ej: 0923710594 o Juan Pérez..."
          className="w-full p-3.5 bg-white border border-slate-200 rounded-2xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600/20 shadow-sm"
        />
        {buscando && <span className="absolute right-4 top-9 text-xs font-bold text-blue-600 animate-pulse">Buscando...</span>}

        {sugerencias.length > 0 && !paciente && busqueda.trim() && (
          <div className="absolute left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 max-h-60 overflow-y-auto divide-y divide-slate-100">
            {sugerencias.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => seleccionarPaciente(p)}
                className="w-full text-left p-3.5 hover:bg-blue-50/70 transition flex justify-between items-center text-xs"
              >
                <div>
                  <p className="font-bold text-slate-900">{p.nombre}</p>
                  <p className="text-[11px] text-slate-500">🪪 {p.cedula || 'Sin cédula'} | 📱 {p.telefono || 'Sin teléfono'}</p>
                </div>
                <span className="bg-blue-100 text-blue-700 font-bold px-2.5 py-1 rounded-lg text-[10px]">Seleccionar ➔</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {cargandoDatos && <p className="text-xs text-slate-500 text-center">Cargando datos de facturación...</p>}

      {hayComprador && !cargandoDatos && (
        <>
          {citaSeleccionada && (
            <div className="flex justify-between items-center flex-wrap gap-2 p-3.5 bg-blue-50 border border-blue-200 rounded-2xl text-xs">
              <span className="text-blue-900 font-semibold">
                🩺 Facturando la cita atendida del <strong>{fechaHora(citaSeleccionada.fecha_hora)}</strong>
              </span>
              <button
                type="button"
                onClick={nuevaFactura}
                className="text-[11px] font-bold text-slate-600 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"
              >
                ← Elegir otra cita
              </button>
            </div>
          )}

          {/* 2. DATOS DEL CLIENTE */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-center flex-wrap gap-2 border-b pb-3">
              <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">2. Datos del cliente</h4>
              {origenDatos?.tipo === 'guardados' && (
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                  ✔ Datos de su última factura{origenDatos.fecha ? ` (${new Date(origenDatos.fecha).toLocaleDateString('es-EC')})` : ''}
                </span>
              )}
              {origenDatos?.tipo === 'ficha' && (
                <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                  Primera factura: datos tomados de la ficha del paciente, revíselos
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className={claseLabel}>Tipo de identificación *</label>
                <select
                  value={comprador.tipoIdentificacion}
                  onChange={(e) => cambiarTipo(e.target.value as TipoIdentificacion)}
                  className={claseInput}
                >
                  {Object.entries(TIPOS_IDENTIFICACION).map(([cod, nombre]) => (
                    <option key={cod} value={cod}>{nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={claseLabel}>
                  {comprador.tipoIdentificacion === '04' ? 'RUC *' : comprador.tipoIdentificacion === '05' ? 'Cédula *' : 'Identificación *'}
                </label>
                <input
                  type="text"
                  value={comprador.identificacion}
                  onChange={campo('identificacion')}
                  disabled={esConsumidorFinal}
                  maxLength={20}
                  placeholder={comprador.tipoIdentificacion === '04' ? 'Ej: 0923710594001' : 'Ej: 0923710594'}
                  className={claseInput}
                />
              </div>
              <div>
                <label className={claseLabel}>Nombres / Razón social *</label>
                <input
                  type="text"
                  value={comprador.razonSocial}
                  onChange={campo('razonSocial')}
                  disabled={esConsumidorFinal}
                  maxLength={300}
                  className={claseInput}
                />
              </div>
              <div className="md:col-span-3">
                <label className={claseLabel}>Dirección</label>
                <input
                  type="text"
                  value={comprador.direccion}
                  onChange={campo('direccion')}
                  disabled={esConsumidorFinal}
                  maxLength={300}
                  placeholder="Ej: Av. 9 de Octubre y Malecón, Guayaquil"
                  className={claseInput}
                />
              </div>
              <div className="md:col-span-2">
                <label className={claseLabel}>Correo electrónico (para enviar la factura)</label>
                <input type="email" value={comprador.email} onChange={campo('email')} maxLength={254} placeholder="Ej: paciente@email.com" className={claseInput} />
              </div>
              <div>
                <label className={claseLabel}>Teléfono</label>
                <input type="text" value={comprador.telefono} onChange={campo('telefono')} maxLength={20} placeholder="Ej: 0991234567" className={claseInput} />
              </div>
            </div>

            {paciente && !esConsumidorFinal && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={guardarDatos}
                  disabled={ocupado}
                  className="bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-700 text-xs font-bold py-2 px-4 rounded-xl border border-slate-200 transition"
                >
                  {guardandoDatos ? 'Guardando...' : '💾 Guardar datos del cliente'}
                </button>
              </div>
            )}
          </div>

          {/* 3. DETALLE */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3">
            <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider border-b pb-3">3. Detalle de servicios</h4>

            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[760px]">
                <thead>
                  <tr className="text-left text-[11px] text-slate-500 uppercase">
                    <th className="pb-2 pr-2 w-28">Código</th>
                    <th className="pb-2 pr-2">Descripción *</th>
                    <th className="pb-2 pr-2 w-20">Cant. *</th>
                    <th className="pb-2 pr-2 w-28">P. unitario *</th>
                    <th className="pb-2 pr-2 w-24">Descuento</th>
                    <th className="pb-2 pr-2 w-36">IVA</th>
                    <th className="pb-2 pr-2 w-24 text-right">Subtotal</th>
                    <th className="pb-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {lineas.map((l, i) => (
                    <tr key={l.clave} className="align-top">
                      <td className="py-1 pr-2"><input value={l.codigo} maxLength={25} onChange={(e) => cambiarLinea(l.clave, { codigo: e.target.value })} className={claseInput} /></td>
                      <td className="py-1 pr-2"><input value={l.descripcion} maxLength={300} onChange={(e) => cambiarLinea(l.clave, { descripcion: e.target.value })} className={claseInput} /></td>
                      <td className="py-1 pr-2"><input inputMode="decimal" value={l.cantidad} onChange={(e) => cambiarLinea(l.clave, { cantidad: e.target.value })} className={claseInput} /></td>
                      <td className="py-1 pr-2"><input inputMode="decimal" value={l.precioUnitario} placeholder="0.00" onChange={(e) => cambiarLinea(l.clave, { precioUnitario: e.target.value })} className={claseInput} /></td>
                      <td className="py-1 pr-2"><input inputMode="decimal" value={l.descuento} placeholder="0.00" onChange={(e) => cambiarLinea(l.clave, { descuento: e.target.value })} className={claseInput} /></td>
                      <td className="py-1 pr-2">
                        <select value={l.codigoIva} onChange={(e) => cambiarLinea(l.clave, { codigoIva: e.target.value as CodigoIva })} className={claseInput}>
                          {Object.entries(TARIFAS_IVA).map(([cod, t]) => <option key={cod} value={cod}>{t.etiqueta}</option>)}
                        </select>
                      </td>
                      <td className="py-1 pr-2 text-right font-bold text-slate-800 pt-3.5">{dinero(totales.lineas[i]?.subtotal || 0)}</td>
                      <td className="py-1 pt-2">
                        <button
                          type="button"
                          onClick={() => setLineas((ls) => ls.filter((x) => x.clave !== l.clave))}
                          disabled={lineas.length === 1}
                          title="Quitar línea"
                          className="text-rose-500 hover:text-rose-700 disabled:opacity-30 font-bold px-2 py-1"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              onClick={() => setLineas((ls) => [...ls, lineaNueva()])}
              className="text-xs font-bold text-blue-600 hover:text-blue-800"
            >
              + Agregar línea
            </button>
          </div>

          {/* 4. PAGO Y TOTALES */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3">
              <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider border-b pb-3">4. Forma de pago</h4>
              <select value={formaPago} onChange={(e) => setFormaPago(e.target.value as CodigoFormaPago)} className={claseInput}>
                {Object.entries(FORMAS_PAGO).map(([cod, nombre]) => <option key={cod} value={cod}>{nombre}</option>)}
              </select>
              <div>
                <label className={claseLabel}>Observación (opcional)</label>
                <textarea
                  value={observacion}
                  onChange={(e) => setObservacion(e.target.value)}
                  maxLength={300}
                  placeholder="Aparece como información adicional en la factura"
                  className={`${claseInput} h-20`}
                />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 text-xs space-y-2">
              <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider border-b pb-3">Totales</h4>
              {totales.impuestos.map((imp) => (
                <div key={imp.codigoIva} className="flex justify-between text-slate-600">
                  <span>Subtotal {TARIFAS_IVA[imp.codigoIva].etiqueta}</span>
                  <span className="font-semibold">{dinero(imp.base)}</span>
                </div>
              ))}
              <div className="flex justify-between text-slate-600">
                <span>Descuento</span>
                <span className="font-semibold">{dinero(totales.totalDescuento)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Subtotal sin impuestos</span>
                <span className="font-semibold">{dinero(totales.subtotalSinImpuestos)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>IVA</span>
                <span className="font-semibold">{dinero(totales.totalIva)}</span>
              </div>
              <div className="flex justify-between text-base font-extrabold text-slate-900 border-t pt-2">
                <span>Total</span>
                <span>{dinero(totales.importeTotal)}</span>
              </div>
            </div>
          </div>

          {intentado && errores.length > 0 && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 space-y-1">
              <p className="font-bold">Revise lo siguiente antes de continuar:</p>
              <ul className="list-disc pl-5 space-y-0.5">
                {errores.map((e) => <li key={e}>{e}</li>)}
              </ul>
            </div>
          )}
          {errorGeneral && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-semibold">⚠️ {errorGeneral}</div>
          )}
          {aviso && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-700 font-semibold">✔ {aviso}</div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={generar}
              disabled={ocupado || !medicoId}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold py-3 px-8 rounded-xl shadow-sm transition"
            >
              {generando ? 'Generando factura...' : `🧾 Generar factura por ${dinero(totales.importeTotal)}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
