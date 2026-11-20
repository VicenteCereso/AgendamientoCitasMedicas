// Reglas de la factura electrónica del SRI (Ecuador) compartidas por el navegador y el servidor:
// catálogos, validación de identificaciones y cálculo de totales.
// No importar aquí nada que solo funcione en el servidor.

// Tabla 6 del SRI: tipo de identificación del comprador
export const TIPOS_IDENTIFICACION = {
  '05': 'Cédula',
  '04': 'RUC',
  '06': 'Pasaporte',
  '08': 'Identificación del exterior',
  '07': 'Consumidor final',
} as const;
export type TipoIdentificacion = keyof typeof TIPOS_IDENTIFICACION;

export const CONSUMIDOR_FINAL = {
  identificacion: '9999999999999',
  razonSocial: 'CONSUMIDOR FINAL',
};
// El SRI no permite facturas a consumidor final por más de este valor.
export const LIMITE_CONSUMIDOR_FINAL = 50;

// Tabla 17 del SRI: tarifas de IVA. Los servicios de salud tienen tarifa 0%.
export const TARIFAS_IVA = {
  '0': { etiqueta: 'IVA 0%', porcentaje: 0 },
  '4': { etiqueta: 'IVA 15%', porcentaje: 15 },
  '5': { etiqueta: 'IVA 5%', porcentaje: 5 },
  '6': { etiqueta: 'No objeto de IVA', porcentaje: 0 },
  '7': { etiqueta: 'Exento de IVA', porcentaje: 0 },
} as const;
export type CodigoIva = keyof typeof TARIFAS_IVA;

// Tabla 24 del SRI: formas de pago
export const FORMAS_PAGO = {
  '01': 'Efectivo (sin utilización del sistema financiero)',
  '20': 'Transferencia / otros con utilización del sistema financiero',
  '16': 'Tarjeta de débito',
  '19': 'Tarjeta de crédito',
  '17': 'Dinero electrónico',
  '18': 'Tarjeta prepago',
} as const;
export type CodigoFormaPago = keyof typeof FORMAS_PAGO;

export interface CompradorFactura {
  tipoIdentificacion: TipoIdentificacion;
  identificacion: string;
  razonSocial: string;
  direccion: string;
  email: string;
  telefono: string;
}

export interface DetalleFactura {
  codigo: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
  codigoIva: CodigoIva;
}

export const redondear2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Cédula ecuatoriana: 10 dígitos, provincia 01-24 (o 30), tercer dígito < 6 y dígito verificador módulo 10.
export function cedulaValida(cedula: string): boolean {
  if (!/^\d{10}$/.test(cedula)) return false;
  const provincia = Number(cedula.slice(0, 2));
  if (!((provincia >= 1 && provincia <= 24) || provincia === 30)) return false;
  if (Number(cedula[2]) >= 6) return false;

  let suma = 0;
  for (let i = 0; i < 9; i++) {
    let v = Number(cedula[i]) * (i % 2 === 0 ? 2 : 1);
    if (v > 9) v -= 9;
    suma += v;
  }
  const verificador = (10 - (suma % 10)) % 10;
  return verificador === Number(cedula[9]);
}

// RUC: 13 dígitos, provincia válida y establecimiento distinto de 000.
// Para personas naturales (tercer dígito < 6) los 10 primeros dígitos deben ser una cédula válida.
// Las sociedades (9) y entidades públicas (6) las termina de validar el SRI.
export function rucValido(ruc: string): boolean {
  if (!/^\d{13}$/.test(ruc)) return false;
  const provincia = Number(ruc.slice(0, 2));
  if (!((provincia >= 1 && provincia <= 24) || provincia === 30)) return false;
  if (ruc.slice(10) === '000') return false;
  const tercero = Number(ruc[2]);
  if (tercero < 6) return cedulaValida(ruc.slice(0, 10));
  return tercero === 6 || tercero === 9;
}

// Tipo de identificación más probable a partir de un número (para precargar desde la ficha del paciente).
export function deducirTipoIdentificacion(identificacion: string): TipoIdentificacion {
  const id = identificacion.trim();
  if (/^\d{13}$/.test(id)) return '04';
  if (/^\d{10}$/.test(id)) return '05';
  return '06';
}

export function calcularTotales(detalles: DetalleFactura[]) {
  const lineas = detalles.map((d) => {
    const bruto = redondear2(d.cantidad * d.precioUnitario);
    const subtotal = redondear2(bruto - d.descuento);
    return { ...d, subtotal };
  });

  // El IVA se calcula sobre la base de cada tarifa, como lo hace el SRI.
  const bases = new Map<CodigoIva, number>();
  for (const l of lineas) bases.set(l.codigoIva, redondear2((bases.get(l.codigoIva) || 0) + l.subtotal));

  const impuestos = [...bases.entries()].map(([codigoIva, base]) => {
    const tarifa = TARIFAS_IVA[codigoIva].porcentaje;
    return { codigoIva, tarifa, base, valor: redondear2((base * tarifa) / 100) };
  });

  const subtotalSinImpuestos = redondear2(lineas.reduce((s, l) => s + l.subtotal, 0));
  const totalDescuento = redondear2(lineas.reduce((s, l) => s + l.descuento, 0));
  const totalIva = redondear2(impuestos.reduce((s, i) => s + i.valor, 0));

  return {
    lineas,
    impuestos,
    subtotalSinImpuestos,
    totalDescuento,
    totalIva,
    importeTotal: redondear2(subtotalSinImpuestos + totalIva),
  };
}

// Devuelve la lista de problemas del comprador (vacía si todo está bien).
export function validarComprador(c: CompradorFactura): string[] {
  const errores: string[] = [];
  const id = c.identificacion.trim();

  if (!(c.tipoIdentificacion in TIPOS_IDENTIFICACION)) errores.push('Tipo de identificación inválido.');
  if (c.tipoIdentificacion === '05' && !cedulaValida(id)) errores.push('La cédula no es válida.');
  if (c.tipoIdentificacion === '04' && !rucValido(id)) errores.push('El RUC no es válido.');
  if ((c.tipoIdentificacion === '06' || c.tipoIdentificacion === '08') && !/^[A-Za-z0-9-]{3,20}$/.test(id)) {
    errores.push('El pasaporte o identificación del exterior debe tener entre 3 y 20 letras o números.');
  }
  if (c.tipoIdentificacion !== '07' && c.razonSocial.trim().length < 3) errores.push('Ingrese los nombres o la razón social.');
  if (c.email.trim() && !EMAIL_VALIDO.test(c.email.trim())) errores.push('El correo electrónico no es válido.');
  return errores;
}

export function validarDetalles(detalles: DetalleFactura[]): string[] {
  const errores: string[] = [];
  if (detalles.length === 0) errores.push('Agregue al menos un servicio.');
  detalles.forEach((d, i) => {
    const n = i + 1;
    if (!d.descripcion.trim()) errores.push(`Línea ${n}: falta la descripción.`);
    if (!(d.cantidad > 0)) errores.push(`Línea ${n}: la cantidad debe ser mayor a 0.`);
    if (!(d.precioUnitario > 0)) errores.push(`Línea ${n}: el precio debe ser mayor a 0.`);
    if (d.descuento < 0) errores.push(`Línea ${n}: el descuento no puede ser negativo.`);
    if (d.descuento > redondear2(d.cantidad * d.precioUnitario)) errores.push(`Línea ${n}: el descuento supera el valor de la línea.`);
    if (!(d.codigoIva in TARIFAS_IVA)) errores.push(`Línea ${n}: tarifa de IVA inválida.`);
  });
  return errores;
}
