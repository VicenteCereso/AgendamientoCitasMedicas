// Cálculo de turnos de agenda. Funciones puras: se usan en el navegador (panel del médico)
// y en el servidor (agenda pública), así ambos calculan exactamente lo mismo.
//
// Las fechas/horas de las citas se guardan como hora local de Ecuador sin zona horaria
// ("2026-11-17T15:00:00"), por eso aquí se trabaja con textos y no con objetos Date en UTC.

// Ecuador continental: UTC-5 sin horario de verano
const OFFSET_ECUADOR_MIN = -5 * 60;

export interface DisponibilidadAgenda {
  dia_semana: number;
  fecha_especifica?: string | null;
  hora_inicio: string;
  hora_fin: string;
  hora_inicio_almuerzo?: string | null;
  hora_fin_almuerzo?: string | null;
  duracion_cita_minutos?: number | null;
}

export interface CitaAgenda {
  fecha_hora: string;
  estado?: string | null;
}

const pad = (n: number) => String(n).padStart(2, '0');

// Normaliza YYYY-MM-DD, YYYY/MM/DD o DD/MM/YYYY a YYYY-MM-DD
export function normalizarFecha(fechaStr: string) {
  let fechaLimpia = fechaStr.trim();
  if (fechaLimpia.includes('/')) {
    const p = fechaLimpia.split('/');
    fechaLimpia = p[0].length === 4
      ? `${p[0]}-${p[1].padStart(2, '0')}-${p[2].padStart(2, '0')}`
      : `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
  }
  return fechaLimpia;
}

// Fecha y minuto actuales en Ecuador, sin importar la zona horaria del equipo o del servidor
export function ahoraEcuador(): { fecha: string; minutos: number } {
  const d = new Date(Date.now() + OFFSET_ECUADOR_MIN * 60_000);
  return {
    fecha: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
    minutos: d.getUTCHours() * 60 + d.getUTCMinutes(),
  };
}

export function hoyEcuador(): string {
  return ahoraEcuador().fecha;
}

function aMinutos(hora: string) {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

// ¿La fecha/hora ya pasó (o es este mismo minuto)?
export function esPasado(fecha: string, hora: string, ahora = ahoraEcuador()) {
  if (fecha < ahora.fecha) return true;
  if (fecha > ahora.fecha) return false;
  return aMinutos(hora) <= ahora.minutos;
}

// Enlace de videollamada con nombre de sala aleatorio (UUID): no se puede adivinar
// a partir del médico, la fecha o la hora. Cada cita tiene su propia sala.
export function generarEnlaceVideollamada() {
  return `https://meet.jit.si/AgendaMedica-${crypto.randomUUID()}`;
}

// "0912345678" -> "091****678": oculta los 4 caracteres del medio
export function enmascararCedula(cedula: string) {
  const c = cedula.trim();
  if (c.length <= 4) return '*'.repeat(c.length);
  const inicio = Math.floor((c.length - 4) / 2);
  return c.slice(0, inicio) + '****' + c.slice(inicio + 4);
}

// "2026-11-17T15:00:00" -> { fecha: "2026-11-17", hora: "15:00" }
export function partesFechaHora(fechaHora: string) {
  return { fecha: fechaHora.slice(0, 10), hora: fechaHora.slice(11, 16) };
}

// Turnos configurados para una fecha (según disponibilidad del médico) y horas ya ocupadas.
// Las citas canceladas NO ocupan el turno: ese horario vuelve a quedar libre.
export function calcularTurnosFecha(todasDisponibilidades: DisponibilidadAgenda[], citasTomadas: CitaAgenda[], fechaLimpia: string) {
  const [anio, mes, dia] = fechaLimpia.split('-').map(Number);
  const diaSemanaIndex = new Date(anio, mes - 1, dia).getDay();

  // Reglas por fecha específica (coincidencia exacta) + reglas semanales de ese día
  const disponibilidades = todasDisponibilidades.filter((d) =>
    d.fecha_especifica ? d.fecha_especifica.slice(0, 10) === fechaLimpia : d.dia_semana === diaSemanaIndex
  );

  const ocupadas = new Set<string>(
    citasTomadas
      .filter((c) => c.fecha_hora && c.estado !== 'cancelada' && partesFechaHora(c.fecha_hora).fecha === fechaLimpia)
      .map((c) => partesFechaHora(c.fecha_hora).hora)
  );

  const turnos = new Set<string>();
  disponibilidades.forEach((disp) => {
    const duracion = disp.duracion_cita_minutos || 30;
    const inicioAlmuerzo = disp.hora_inicio_almuerzo && disp.hora_fin_almuerzo ? aMinutos(disp.hora_inicio_almuerzo) : null;
    const finAlmuerzo = disp.hora_inicio_almuerzo && disp.hora_fin_almuerzo ? aMinutos(disp.hora_fin_almuerzo) : null;

    let actual = aMinutos(disp.hora_inicio);
    const finMin = aMinutos(disp.hora_fin);
    while (actual + duracion <= finMin) {
      const caeEnAlmuerzo = inicioAlmuerzo !== null && finAlmuerzo !== null && actual >= inicioAlmuerzo && actual < finAlmuerzo;
      if (!caeEnAlmuerzo) turnos.add(`${pad(Math.floor(actual / 60))}:${pad(actual % 60)}`);
      actual += duracion;
    }
  });

  return { turnos: [...turnos].sort(), ocupadas };
}

// Turnos que se pueden reservar: configurados, no ocupados y en el futuro
export function turnosLibres(todasDisponibilidades: DisponibilidadAgenda[], citasTomadas: CitaAgenda[], fecha: string) {
  const fechaLimpia = normalizarFecha(fecha);
  const ahora = ahoraEcuador();
  if (fechaLimpia < ahora.fecha) return [];
  const { turnos, ocupadas } = calcularTurnosFecha(todasDisponibilidades, citasTomadas, fechaLimpia);
  return turnos.filter((h) => !ocupadas.has(h) && !esPasado(fechaLimpia, h, ahora));
}
