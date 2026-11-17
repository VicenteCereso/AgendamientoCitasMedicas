'use client';

// Calendario mensual de horarios del médico.
// - Muestra qué días tienen horario (verde suave), cuáles no (rosa tenue) y los pasados (gris).
// - Clic en un día futuro: lo agrega/quita de la selección para aplicarle un horario.
// - Clic en cualquier día: muestra su detalle (reglas y citas) para revisar o eliminar.
import { useMemo, useState } from 'react';

export interface ReglaHorario {
  id: string;
  dia_semana: number;
  fecha_especifica?: string | null;
  hora_inicio: string;
  hora_fin: string;
  hora_inicio_almuerzo?: string | null;
  hora_fin_almuerzo?: string | null;
  duracion_cita_minutos?: number | null;
}

interface Props {
  disponibilidades: ReglaHorario[];
  citas: { fecha_hora: string; estado?: string | null }[];
  hoy: string; // YYYY-MM-DD (vacío durante el prerender)
  fechasSeleccionadas: string[];
  onCambiarSeleccion: (fechas: string[]) => void;
  onBorrarRegla: (id: string) => void;
}

const NOMBRES_DIA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const ENCABEZADO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (h?: string | null) => (h || '').slice(0, 5);
const aFecha = (a: number, m: number, d: number) => `${a}-${pad(m + 1)}-${pad(d)}`;

function reglasDelDia(reglas: ReglaHorario[], fecha: string) {
  const [a, m, d] = fecha.split('-').map(Number);
  const dia = new Date(a, m - 1, d).getDay();
  return reglas.filter((r) => (r.fecha_especifica ? r.fecha_especifica.slice(0, 10) === fecha : r.dia_semana === dia));
}

export default function CalendarioHorarios({ disponibilidades, citas, hoy, fechasSeleccionadas, onCambiarSeleccion, onBorrarRegla }: Props) {
  const base = hoy || new Date().toISOString().slice(0, 10);
  const [mes, setMes] = useState<{ a: number; m: number }>(() => ({ a: Number(base.slice(0, 4)), m: Number(base.slice(5, 7)) - 1 }));
  const [diaActivo, setDiaActivo] = useState<string>('');

  // Citas activas por fecha (las canceladas no cuentan)
  const citasPorFecha = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const c of citas) {
      if (!c.fecha_hora || c.estado === 'cancelada') continue;
      const f = c.fecha_hora.slice(0, 10);
      mapa.set(f, (mapa.get(f) || 0) + 1);
    }
    return mapa;
  }, [citas]);

  // Celdas del mes, semana de lunes a domingo
  const celdas = useMemo(() => {
    const primerDia = new Date(mes.a, mes.m, 1).getDay(); // 0 = domingo
    const vaciasInicio = (primerDia + 6) % 7;
    const diasMes = new Date(mes.a, mes.m + 1, 0).getDate();
    const lista: (string | null)[] = Array(vaciasInicio).fill(null);
    for (let d = 1; d <= diasMes; d++) lista.push(aFecha(mes.a, mes.m, d));
    while (lista.length % 7 !== 0) lista.push(null);
    return lista;
  }, [mes]);

  const resumen = useMemo(() => {
    let configurados = 0;
    let habilesSinHorario = 0;
    for (const f of celdas) {
      if (!f || (hoy && f < hoy)) continue;
      const tiene = reglasDelDia(disponibilidades, f).length > 0;
      if (tiene) configurados++;
      else {
        const [a, m, d] = f.split('-').map(Number);
        const dia = new Date(a, m - 1, d).getDay();
        if (dia >= 1 && dia <= 5) habilesSinHorario++;
      }
    }
    return { configurados, habilesSinHorario };
  }, [celdas, disponibilidades, hoy]);

  function cambiarMes(delta: number) {
    const d = new Date(mes.a, mes.m + delta, 1);
    setMes({ a: d.getFullYear(), m: d.getMonth() });
  }

  function clicDia(fecha: string) {
    setDiaActivo(fecha);
    if (hoy && fecha < hoy) return; // los días pasados solo se consultan
    onCambiarSeleccion(
      fechasSeleccionadas.includes(fecha)
        ? fechasSeleccionadas.filter((f) => f !== fecha)
        : [...fechasSeleccionadas, fecha].sort()
    );
  }

  // Atajo: selecciona los días hábiles futuros de este mes que aún no tienen horario
  function seleccionarHabilesSinHorario() {
    const nuevas = celdas.filter((f): f is string => {
      if (!f || (hoy && f < hoy)) return false;
      const [a, m, d] = f.split('-').map(Number);
      const dia = new Date(a, m - 1, d).getDay();
      return dia >= 1 && dia <= 5 && reglasDelDia(disponibilidades, f).length === 0;
    });
    onCambiarSeleccion([...new Set([...fechasSeleccionadas, ...nuevas])].sort());
  }

  const nombreMes = new Date(mes.a, mes.m, 1).toLocaleDateString('es-EC', { month: 'long', year: 'numeric' });
  const reglasActivas = diaActivo ? reglasDelDia(disponibilidades, diaActivo) : [];

  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-4">
      {/* Navegación del mes */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => cambiarMes(-1)} className="w-8 h-8 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold" aria-label="Mes anterior">‹</button>
          <h4 className="w-44 text-center text-sm font-extrabold text-slate-800 capitalize">{nombreMes}</h4>
          <button type="button" onClick={() => cambiarMes(1)} className="w-8 h-8 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold" aria-label="Mes siguiente">›</button>
          {hoy && (
            <button
              type="button"
              onClick={() => setMes({ a: Number(hoy.slice(0, 4)), m: Number(hoy.slice(5, 7)) - 1 })}
              className="ml-1 text-[11px] font-bold text-blue-700 hover:underline"
            >
              Hoy
            </button>
          )}
        </div>
        <div className="flex gap-3 text-[11px] font-bold">
          <button type="button" onClick={seleccionarHabilesSinHorario} className="text-indigo-700 hover:underline">
            Seleccionar días hábiles sin horario
          </button>
          {fechasSeleccionadas.length > 0 && (
            <button type="button" onClick={() => onCambiarSeleccion([])} className="text-slate-500 hover:underline">
              Limpiar selección ({fechasSeleccionadas.length})
            </button>
          )}
        </div>
      </div>

      {/* Resumen del mes */}
      <div className="flex flex-wrap gap-2 text-[11px] font-bold">
        <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
          ✓ {resumen.configurados} días con horario
        </span>
        <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
          {resumen.habilesSinHorario} días hábiles sin horario
        </span>
      </div>

      {/* Calendario */}
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {ENCABEZADO.map((d) => (
          <div key={d} className="text-center text-[10px] sm:text-[11px] font-extrabold text-slate-500 uppercase py-1">{d}</div>
        ))}

        {celdas.map((fecha, i) => {
          if (!fecha) return <div key={`v${i}`} />;

          const reglas = reglasDelDia(disponibilidades, fecha);
          const pasado = !!hoy && fecha < hoy;
          const esHoy = fecha === hoy;
          const seleccionado = fechasSeleccionadas.includes(fecha);
          const activo = fecha === diaActivo;
          const nCitas = citasPorFecha.get(fecha) || 0;
          const configurado = reglas.length > 0;
          const almuerzo = reglas.some((r) => r.hora_inicio_almuerzo);

          let estilo: string;
          if (seleccionado) estilo = 'bg-indigo-600 border-indigo-600 text-white shadow-sm';
          else if (pasado) estilo = 'bg-slate-50 border-slate-100 text-slate-400';
          else if (configurado) estilo = 'bg-emerald-50 border-emerald-200 text-emerald-900 hover:border-emerald-400';
          else estilo = 'bg-rose-50/60 border-rose-200 border-dashed text-rose-800 hover:border-rose-400';

          const sub = seleccionado ? 'text-indigo-100' : pasado ? 'text-slate-400' : configurado ? 'text-emerald-700' : 'text-rose-600/80';

          return (
            <button
              key={fecha}
              type="button"
              onClick={() => clicDia(fecha)}
              title={
                configurado
                  ? reglas.map((r) => `${hhmm(r.hora_inicio)}–${hhmm(r.hora_fin)} · ${r.duracion_cita_minutos || 30} min`).join('\n')
                  : pasado ? 'Día pasado' : 'Sin horario configurado'
              }
              className={`relative min-h-[64px] sm:min-h-[84px] p-1.5 sm:p-2 rounded-xl border text-left transition ${estilo}
                ${esHoy && !seleccionado ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
                ${activo && !seleccionado ? 'outline outline-2 outline-slate-400' : ''}`}
            >
              <div className="flex items-start justify-between gap-1">
                <span className={`text-xs sm:text-sm font-extrabold ${esHoy && !seleccionado ? 'text-blue-700' : ''}`}>
                  {Number(fecha.slice(8))}
                </span>
                {nCitas > 0 && (
                  <span className={`text-[9px] sm:text-[10px] font-bold px-1 sm:px-1.5 rounded-full ${seleccionado ? 'bg-white/20 text-white' : 'bg-sky-100 text-sky-700'}`}>
                    👤{nCitas}
                  </span>
                )}
              </div>

              {configurado ? (
                <div className={`mt-1 space-y-0.5 text-[9px] sm:text-[10px] font-semibold leading-tight ${sub}`}>
                  {reglas.slice(0, 2).map((r) => (
                    <p key={r.id} className="truncate">
                      {hhmm(r.hora_inicio)}–{hhmm(r.hora_fin)}
                      <span className="hidden sm:inline"> · {r.duracion_cita_minutos || 30}m</span>
                    </p>
                  ))}
                  {reglas.length > 2 && <p>+{reglas.length - 2} más</p>}
                  {almuerzo && <p className="hidden sm:block">🍱 almuerzo</p>}
                </div>
              ) : (
                !pasado && <p className={`mt-1 text-[9px] sm:text-[10px] font-semibold ${sub}`}>Sin horario</p>
              )}
            </button>
          );
        })}
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-slate-600">
        <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-emerald-50 border border-emerald-300" /> Con horario</span>
        <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-rose-50 border border-dashed border-rose-300" /> Sin horario</span>
        <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-indigo-600" /> Seleccionado para configurar</span>
        <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-slate-50 border border-slate-200" /> Pasado</span>
        <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded ring-2 ring-blue-500" /> Hoy</span>
        <span className="flex items-center gap-1.5"><span className="px-1 rounded-full bg-sky-100 text-sky-700 font-bold text-[10px]">👤2</span> Citas agendadas</span>
      </div>

      {/* Detalle del día */}
      {diaActivo && (
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
          <div className="flex justify-between items-center">
            <p className="text-xs font-extrabold text-slate-800 capitalize">
              {(() => {
                const [a, m, d] = diaActivo.split('-').map(Number);
                return new Date(a, m - 1, d).toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
              })()}
              {(citasPorFecha.get(diaActivo) || 0) > 0 && (
                <span className="ml-2 normal-case font-bold text-sky-700">· {citasPorFecha.get(diaActivo)} cita(s) agendada(s)</span>
              )}
            </p>
            <button type="button" onClick={() => setDiaActivo('')} className="text-slate-400 hover:text-slate-700 text-xs font-bold">✕</button>
          </div>

          {reglasActivas.length === 0 ? (
            <p className="text-xs text-slate-500">
              Este día no tiene horario.{' '}
              {!(hoy && diaActivo < hoy) && 'Selecciónalo en el calendario y aplica un horario con el formulario de abajo.'}
            </p>
          ) : (
            <div className="space-y-2">
              {reglasActivas.map((r) => (
                <div key={r.id} className="flex justify-between items-center gap-2 p-2.5 bg-white rounded-lg border border-slate-200">
                  <div className="text-xs">
                    <p className="font-bold text-slate-800">
                      🕒 {hhmm(r.hora_inicio)} a {hhmm(r.hora_fin)} · citas de {r.duracion_cita_minutos || 30} min
                    </p>
                    {r.hora_inicio_almuerzo && (
                      <p className="text-[11px] text-amber-700 font-bold">🍱 Almuerzo: {hhmm(r.hora_inicio_almuerzo)} – {hhmm(r.hora_fin_almuerzo)}</p>
                    )}
                    {!r.fecha_especifica && (
                      <p className="text-[11px] text-violet-700 font-bold">↻ Regla semanal: aplica todos los {NOMBRES_DIA[r.dia_semana].toLowerCase()}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onBorrarRegla(r.id)}
                    className="text-rose-600 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg text-xs font-bold transition shrink-0"
                    title={r.fecha_especifica ? 'Eliminar el horario de este día' : 'Eliminar la regla semanal (afecta a todas las semanas)'}
                  >
                    🗑️ Eliminar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
