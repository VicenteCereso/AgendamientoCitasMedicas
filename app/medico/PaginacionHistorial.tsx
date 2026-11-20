'use client';

// Controles de página del historial clínico. La página 0 son las atenciones más recientes;
// avanzar lleva hacia las más antiguas. No se muestra si todo cabe en una página.
interface Props {
  pagina: number;
  total: number;
  porPagina: number;
  ocupado?: boolean;
  onCambiar: (pagina: number) => void;
}

const claseBtn =
  'px-2.5 py-1.5 rounded-lg border border-indigo-100 bg-white text-indigo-700 font-bold hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed transition';

export default function PaginacionHistorial({ pagina, total, porPagina, ocupado = false, onCambiar }: Props) {
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  if (totalPaginas <= 1) return null;

  const enPrimera = ocupado || pagina === 0;
  const enUltima = ocupado || pagina >= totalPaginas - 1;

  return (
    <div className="flex items-center justify-between gap-1 text-[11px]">
      <button type="button" className={claseBtn} disabled={enPrimera} onClick={() => onCambiar(0)} title="Ir a las más recientes">«</button>
      <button type="button" className={claseBtn} disabled={enPrimera} onClick={() => onCambiar(pagina - 1)} title="Atenciones más recientes">‹ Recientes</button>
      <span className="font-semibold text-slate-600 whitespace-nowrap">{pagina + 1} / {totalPaginas}</span>
      <button type="button" className={claseBtn} disabled={enUltima} onClick={() => onCambiar(pagina + 1)} title="Atenciones más antiguas">Antiguas ›</button>
      <button type="button" className={claseBtn} disabled={enUltima} onClick={() => onCambiar(totalPaginas - 1)} title="Ir a las más antiguas">»</button>
    </div>
  );
}

// Texto "Atenciones 6–10 de 37" para la cabecera del historial.
export function rangoAtenciones(pagina: number, enPagina: number, total: number, porPagina: number) {
  const desde = pagina * porPagina;
  return `Atenciones ${desde + 1}–${desde + enPagina} de ${total} (de la más reciente a la más antigua)`;
}
