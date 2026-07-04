// QR codes generated for products encode the product's UUID behind a short
// prefix, so the scanner can tell "our" product QRs apart from any other QR the
// camera might see. The value is stable (the id never changes), so a printed
// label keeps working forever.
const QR_PREFIX = 'ATSPOS:';

export function contenidoQrProducto(id: string): string {
  return QR_PREFIX + id;
}

/** Returns the product id if the scanned data is one of our product QRs. */
export function parseContenidoQr(data: string): string | null {
  return data.startsWith(QR_PREFIX) ? data.slice(QR_PREFIX.length) : null;
}
