import * as Print from 'expo-print';
import QRCode from 'qrcode';

import type { Producto } from '@/db/repositories/productos';
import { formatMoney } from '@/lib/money';
import { contenidoQrProducto } from '@/lib/qr';

/**
 * Builds an inline SVG QR (no rendering needed) so many codes can be embedded
 * in a single printable HTML page. Reuses the `qrcode` matrix generator that
 * already ships with react-native-qrcode-svg.
 */
function qrSvg(value: string): string {
  const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
  const n: number = qr.modules.size;
  const data = qr.modules.data;
  const quiet = 2;
  let path = '';
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (data[y * n + x]) path += `M${x + quiet} ${y + quiet}h1v1h-1z`;
    }
  }
  const total = n + quiet * 2;
  return `<svg viewBox="0 0 ${total} ${total}" width="100%" height="100%" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect width="${total}" height="${total}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] ?? c);
}

/**
 * Prints a sheet of QR labels (one per product) with name, price and QR, laid
 * out in a grid for A4. Uses the system print dialog (print or save as PDF).
 */
export async function imprimirHojaEtiquetas(productos: Producto[]): Promise<void> {
  const celdas = productos
    .map(
      (p) => `
      <div class="label"><div class="inner">
        <div class="qr">${qrSvg(contenidoQrProducto(p.id))}</div>
        <div class="nombre">${escapeHtml(p.nombre)}</div>
        <div class="precio">${formatMoney(p.precioVenta)}${p.unidadMedida === 'kg' ? '/kg' : ''}</div>
      </div></div>`,
    )
    .join('');

  const html = `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; font-family: sans-serif; }
          .grid { display: flex; flex-wrap: wrap; padding: 8px; }
          .label {
            width: 33.33%; padding: 6px; text-align: center;
            page-break-inside: avoid;
          }
          .label .inner { border: 1px solid #bbb; border-radius: 6px; padding: 8px; }
          .qr { width: 100%; aspect-ratio: 1 / 1; margin: 0 auto 4px; }
          .nombre { font-size: 12px; font-weight: bold; word-break: break-word; }
          .precio { font-size: 15px; }
        </style>
      </head>
      <body>
        <div class="grid">${celdas}</div>
      </body>
    </html>`;

  await Print.printAsync({ html });
}
