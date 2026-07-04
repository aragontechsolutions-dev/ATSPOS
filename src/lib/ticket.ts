import * as Print from 'expo-print';

import { formatMoney } from './money';

export interface TicketItem {
  nombre: string;
  cantidad: number;
  precioUnitario: number;
}

export interface TicketData {
  fecha: Date;
  items: TicketItem[];
  subtotal: number;
  descuento: number;
  total: number;
  metodoPago: string;
  montoRecibido?: number | null;
  vuelto?: number | null;
  anulada?: boolean;
}

const NEGOCIO = 'ATSPOS';

function fechaLegible(d: Date): string {
  return d.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] ?? c);
}

function ticketHtml(data: TicketData): string {
  const filas = data.items
    .map(
      (i) => `
      <tr>
        <td>${escapeHtml(i.nombre)}<br/><small>${i.cantidad} x ${formatMoney(i.precioUnitario)}</small></td>
        <td style="text-align:right;vertical-align:top;">${formatMoney(i.precioUnitario * i.cantidad)}</td>
      </tr>`,
    )
    .join('');

  const efectivo =
    data.metodoPago === 'efectivo' && data.montoRecibido != null
      ? `<div>Recibido: ${formatMoney(data.montoRecibido)}</div>
         <div>Vuelto: ${formatMoney(data.vuelto ?? 0)}</div>`
      : '';

  return `
    <html>
      <head><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
      <body style="font-family:monospace;max-width:360px;margin:0 auto;padding:12px;font-size:14px;">
        <div style="text-align:center;">
          <div style="font-size:20px;font-weight:bold;">${NEGOCIO}</div>
          <div>Comprobante no fiscal</div>
          <div>${fechaLegible(data.fecha)}</div>
          ${data.anulada ? '<div style="color:#B00020;font-weight:bold;">** ANULADA **</div>' : ''}
        </div>
        <hr/>
        <table style="width:100%;border-collapse:collapse;">${filas}</table>
        <hr/>
        <div style="display:flex;justify-content:space-between;"><span>Subtotal</span><span>${formatMoney(data.subtotal)}</span></div>
        ${data.descuento > 0 ? `<div style="display:flex;justify-content:space-between;"><span>Descuento</span><span>-${formatMoney(data.descuento)}</span></div>` : ''}
        <div style="display:flex;justify-content:space-between;font-size:18px;font-weight:bold;"><span>TOTAL</span><span>${formatMoney(data.total)}</span></div>
        <div style="margin-top:6px;">Pago: ${escapeHtml(data.metodoPago)}</div>
        ${efectivo}
        <hr/>
        <div style="text-align:center;">¡Gracias por su compra!</div>
      </body>
    </html>`;
}

/** Opens the system print dialog (print or save/share as PDF) with the receipt. */
export async function imprimirTicket(data: TicketData): Promise<void> {
  await Print.printAsync({ html: ticketHtml(data) });
}
