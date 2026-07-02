export type Periodo = 'hoy' | 'semana' | 'mes';

export const PERIODOS: { value: Periodo; label: string }[] = [
  { value: 'hoy', label: 'Hoy' },
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mes' },
];

export interface RangoFechas {
  desde: Date;
  hasta: Date;
}

/** Returns the [start, end) range for a period, anchored to local midnight. */
export function rangoDePeriodo(periodo: Periodo, ahora = new Date()): RangoFechas {
  const hasta = new Date(ahora);
  const desde = new Date(ahora);
  desde.setHours(0, 0, 0, 0);

  if (periodo === 'semana') {
    desde.setDate(desde.getDate() - 6);
  } else if (periodo === 'mes') {
    desde.setDate(desde.getDate() - 29);
  }

  return { desde, hasta };
}
