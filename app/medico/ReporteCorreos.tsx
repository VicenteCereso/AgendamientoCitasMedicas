'use client';

// Control de correos enviados por Brevo (solo administrador).
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface RegistroCorreo {
  id: string;
  created_at: string;
  tipo: string;
  destinatario: string;
  asunto: string | null;
  estado: 'enviado' | 'error' | 'omitido_limite';
  error: string | null;
  origen: string | null;
  pacientes: { nombre: string } | null;
  medicos: { nombre: string } | null;
}

interface Reporte {
  hoy: string;
  desde: string;
  hasta: string;
  limiteDiario: number;
  limiteMensual: number;
  enviadosHoy: number;
  enviadosMes: number;
  total: number;
  truncado: boolean;
  registros: RegistroCorreo[];
}

const ETIQUETA_TIPO: Record<string, string> = {
  confirmacion_cita: 'Confirmación de cita',
  factura: 'Factura electrónica',
};

const ETIQUETA_ESTADO: Record<RegistroCorreo['estado'], { texto: string; clase: string }> = {
  enviado: { texto: 'Enviado', clase: 'bg-emerald-100 text-emerald-700' },
  error: { texto: 'Error', clase: 'bg-rose-100 text-rose-700' },
  omitido_limite: { texto: 'Omitido (límite)', clase: 'bg-amber-100 text-amber-700' },
};

const ETIQUETA_ORIGEN: Record<string, string> = {
  medico: 'Panel médico',
  agenda_publica: 'Agenda pública',
};

function fechaHoraLocal(iso: string) {
  return new Date(iso).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' });
}

function Medidor({ titulo, usados, limite }: { titulo: string; usados: number; limite: number }) {
  const pct = limite > 0 ? Math.min(100, Math.round((usados / limite) * 100)) : 0;
  const color = pct >= 90 ? 'bg-rose-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-2">
      <p className="text-[11px] font-bold text-slate-500 uppercase">{titulo}</p>
      <p className="text-2xl font-extrabold text-slate-800">
        {usados}
        {limite > 0 && <span className="text-sm font-bold text-slate-400"> / {limite}</span>}
      </p>
      {limite > 0 ? (
        <>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[11px] text-slate-500">{pct}% usado · quedan {Math.max(0, limite - usados)}</p>
        </>
      ) : (
        <p className="text-[11px] text-slate-500">Sin límite configurado</p>
      )}
    </div>
  );
}

export default function ReporteCorreos() {
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'' | RegistroCorreo['estado']>('');
  const [busqueda, setBusqueda] = useState('');
  const [reporte, setReporte] = useState<Reporte | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  async function cargar(d = desde, h = hasta) {
    const { data: { session } } = await supabase.auth.getSession();
    setCargando(true);
    setError('');
    try {
      const qs = new URLSearchParams();
      if (d) qs.set('desde', d);
      if (h) qs.set('hasta', h);
      const res = await fetch(`/api/admin/correos?${qs}`, {
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
      setReporte(json);
      setDesde(json.desde);
      setHasta(json.hasta);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setCargando(false);
  }

  // Carga inicial al abrir la pestaña (mes actual)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar('', '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const registrosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return (reporte?.registros || []).filter(
      (r) =>
        (!filtroEstado || r.estado === filtroEstado) &&
        (!q ||
          r.destinatario.toLowerCase().includes(q) ||
          (r.pacientes?.nombre || '').toLowerCase().includes(q) ||
          (r.medicos?.nombre || '').toLowerCase().includes(q))
    );
  }, [reporte, filtroEstado, busqueda]);

  const resumen = useMemo(() => {
    const r = { enviado: 0, error: 0, omitido_limite: 0 };
    for (const x of reporte?.registros || []) r[x.estado]++;
    return r;
  }, [reporte]);

  // Enviados por día dentro del rango (para ver picos de uso)
  const porDia = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const x of reporte?.registros || []) {
      if (x.estado !== 'enviado') continue;
      const dia = new Date(x.created_at).toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' });
      mapa.set(dia, (mapa.get(dia) || 0) + 1);
    }
    return [...mapa.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [reporte]);

  function exportarCSV() {
    const celdas = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const filas = [
      ['Fecha', 'Tipo', 'Estado', 'Destinatario', 'Paciente', 'Médico', 'Origen', 'Asunto', 'Error'],
      ...registrosFiltrados.map((r) => [
        fechaHoraLocal(r.created_at),
        ETIQUETA_TIPO[r.tipo] || r.tipo,
        ETIQUETA_ESTADO[r.estado]?.texto || r.estado,
        r.destinatario,
        r.pacientes?.nombre || '',
        r.medicos?.nombre || '',
        ETIQUETA_ORIGEN[r.origen || ''] || r.origen || '',
        r.asunto || '',
        r.error || '',
      ]),
    ];
    const csv = '﻿' + filas.map((f) => f.map((c) => celdas(String(c))).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `correos_${desde}_${hasta}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const maxDia = Math.max(1, ...porDia.map(([, n]) => n));

  return (
    <div className="space-y-6">
      <div className="p-6 bg-sky-50/40 rounded-3xl border border-sky-100 space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-2 border-b border-sky-100 pb-3">
          <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">✉️ Control de Correos (Brevo)</h3>
          <button
            onClick={() => cargar()}
            disabled={cargando}
            className="text-[11px] font-bold text-sky-700 hover:underline disabled:opacity-50"
          >
            {cargando ? 'Actualizando...' : '↻ Actualizar'}
          </button>
        </div>

        {error && <p className="text-xs font-bold text-rose-600">{error}</p>}

        {reporte && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Medidor titulo={`Enviados hoy (${reporte.hoy})`} usados={reporte.enviadosHoy} limite={reporte.limiteDiario} />
            <Medidor titulo="Enviados este mes" usados={reporte.enviadosMes} limite={reporte.limiteMensual} />
            <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-1">
              <p className="text-[11px] font-bold text-slate-500 uppercase">En el rango seleccionado</p>
              <p className="text-xs text-slate-700"><strong className="text-emerald-700">{resumen.enviado}</strong> enviados</p>
              <p className="text-xs text-slate-700"><strong className="text-rose-700">{resumen.error}</strong> con error</p>
              <p className="text-xs text-slate-700"><strong className="text-amber-700">{resumen.omitido_limite}</strong> omitidos por límite</p>
            </div>
          </div>
        )}
        <p className="text-[11px] text-slate-500">
          Solo se cuentan los correos enviados por este sistema. El día se cuenta en hora de Ecuador; Brevo puede reiniciar su
          contador a otra hora. Cuando se alcanza el límite diario, las notificaciones se omiten y quedan registradas.
        </p>
      </div>

      <div className="p-6 bg-white rounded-3xl border border-slate-200 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Desde</label>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="p-2 border rounded-xl text-xs font-semibold" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Hasta</label>
            <input type="date" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} className="p-2 border rounded-xl text-xs font-semibold" />
          </div>
          <button
            onClick={() => cargar()}
            disabled={cargando}
            className="bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition"
          >
            Consultar
          </button>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Estado</label>
            <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value as typeof filtroEstado)} className="p-2 border rounded-xl text-xs font-semibold">
              <option value="">Todos</option>
              <option value="enviado">Enviados</option>
              <option value="error">Con error</option>
              <option value="omitido_limite">Omitidos por límite</option>
            </select>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Buscar</label>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Correo, paciente o médico"
              className="w-full p-2 border rounded-xl text-xs font-semibold"
            />
          </div>
          <button
            onClick={exportarCSV}
            disabled={registrosFiltrados.length === 0}
            className="bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-xs font-bold py-2.5 px-4 rounded-xl transition"
          >
            ⬇️ Exportar CSV
          </button>
        </div>

        {porDia.length > 0 && (
          <div className="space-y-1">
            <p className="text-[11px] font-bold text-slate-600 uppercase">Enviados por día</p>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {porDia.map(([dia, n]) => (
                <div key={dia} className="flex items-center gap-2 text-[11px]">
                  <span className="w-20 font-semibold text-slate-600">{dia}</span>
                  <div className="flex-1 h-3 bg-slate-100 rounded">
                    <div className="h-full bg-sky-500 rounded" style={{ width: `${(n / maxDia) * 100}%` }} />
                  </div>
                  <span className="w-10 text-right font-bold text-slate-700">{n}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {reporte?.truncado && (
          <p className="text-[11px] text-amber-700">
            Se muestran los {reporte.registros.length} registros más recientes de {reporte.total}. Reduce el rango para ver el resto.
          </p>
        )}

        <div className="overflow-x-auto border rounded-xl">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-600 text-left">
              <tr>
                <th className="p-2 font-bold">Fecha</th>
                <th className="p-2 font-bold">Tipo</th>
                <th className="p-2 font-bold">Estado</th>
                <th className="p-2 font-bold">Destinatario</th>
                <th className="p-2 font-bold">Paciente</th>
                <th className="p-2 font-bold">Médico</th>
                <th className="p-2 font-bold">Origen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {registrosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-slate-400 font-semibold">
                    {cargando ? 'Cargando...' : 'No hay correos en este rango.'}
                  </td>
                </tr>
              ) : (
                registrosFiltrados.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="p-2 whitespace-nowrap">{fechaHoraLocal(r.created_at)}</td>
                    <td className="p-2">{ETIQUETA_TIPO[r.tipo] || r.tipo}</td>
                    <td className="p-2">
                      <span
                        title={r.error || undefined}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ETIQUETA_ESTADO[r.estado]?.clase || ''}`}
                      >
                        {ETIQUETA_ESTADO[r.estado]?.texto || r.estado}
                      </span>
                    </td>
                    <td className="p-2">{r.destinatario}</td>
                    <td className="p-2">{r.pacientes?.nombre || '—'}</td>
                    <td className="p-2">{r.medicos?.nombre || '—'}</td>
                    <td className="p-2">{ETIQUETA_ORIGEN[r.origen || ''] || r.origen || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
