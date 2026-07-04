// All money is stored as integer cents; these helpers convert to/from the
// decimal string a cashier types or reads on screen.

export function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function parseMoneyInput(text: string): number {
  const normalized = text.trim().replace(',', '.');
  const value = Number.parseFloat(normalized);
  if (Number.isNaN(value)) return 0;
  return Math.round(value * 100);
}

/** Formats a quantity: integer for units, up to 3 decimals for weighed goods. */
export function formatCantidad(cantidad: number, unidadMedida: string): string {
  if (unidadMedida === 'kg') {
    return `${Number.parseFloat(cantidad.toFixed(3))} kg`;
  }
  return String(cantidad);
}
