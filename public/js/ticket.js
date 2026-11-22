/**
 * Ticket de venta imprimible (formato 80 mm para impresoras térmicas;
 * también se imprime bien en A4). Se imprime desde un iframe oculto.
 */
import { state } from './state.js';
import { esc, money, fmtDate, fmtTime, PAYMENT } from './ui.js';

export function ticketHtml(sale) {
  const s = state.settings || {};
  const logo = s.has_logo ? `<img src="${location.origin}/api/settings/logo" class="logo" alt="">` : '';
  const items = sale.items.map((i) => `
    <tr><td colspan="3" class="name">${esc(i.product_name)}</td></tr>
    <tr><td>${i.quantity} x ${money(i.unit_price)}</td><td></td><td class="r">${money(i.subtotal)}</td></tr>`).join('');
  const gross = sale.items.reduce((a, i) => a + Number(i.subtotal), 0);

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(sale.number)}</title>
  <style>
    @page { size: 80mm auto; margin: 4mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Courier New', ui-monospace, monospace; font-size: 12px; color: #000; width: 72mm; margin: 0 auto; }
    .c { text-align: center; } .r { text-align: right; } .b { font-weight: bold; }
    .logo { max-width: 40mm; max-height: 22mm; margin: 0 auto 4px; display: block; }
    h1 { font-size: 15px; margin: 2px 0; }
    hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 1px 0; vertical-align: top; }
    td.name { padding-top: 4px; }
    .tot td { font-size: 14px; font-weight: bold; padding-top: 4px; }
    .muted { font-size: 10.5px; }
    .anulada { border: 2px solid #000; padding: 4px; text-align: center; font-weight: bold; font-size: 14px; margin: 6px 0; }
  </style></head><body>
    <div class="c">
      ${logo}
      <h1>${esc(s.business_name || 'Mi negocio')}</h1>
      ${s.business_ruc ? `<div>RUC: ${esc(s.business_ruc)}</div>` : ''}
      ${s.business_address ? `<div class="muted">${esc(s.business_address)}</div>` : ''}
      ${s.business_phone ? `<div class="muted">Tel: ${esc(s.business_phone)}</div>` : ''}
    </div>
    <hr>
    <div class="c b">TICKET DE VENTA</div>
    <div class="c b">${esc(sale.number)}</div>
    <div>Fecha: ${fmtDate(sale.created_at)} ${fmtTime(sale.created_at)}</div>
    <div>Cajero: ${esc(sale.user_name || '')}</div>
    ${sale.customer_name ? `<div>Cliente: ${esc(sale.customer_name)}</div>` : ''}
    ${sale.customer_doc ? `<div>Doc.: ${esc(sale.customer_doc)}</div>` : ''}
    ${sale.status === 'anulada' ? '<div class="anulada">*** VENTA ANULADA ***</div>' : ''}
    <hr>
    <table>${items}</table>
    <hr>
    <table>
      ${Number(sale.discount) ? `<tr><td>Subtotal</td><td class="r">${money(gross)}</td></tr><tr><td>Descuento</td><td class="r">-${money(sale.discount)}</td></tr>` : ''}
      <tr><td>Op. gravada</td><td class="r">${money(sale.subtotal)}</td></tr>
      <tr><td>${esc(s.tax_name || 'IGV')} (${esc(s.tax_rate || 18)}%)</td><td class="r">${money(sale.tax)}</td></tr>
      <tr class="tot"><td>TOTAL</td><td class="r">${money(sale.total)}</td></tr>
    </table>
    <hr>
    <table>
      <tr><td>Pago: ${PAYMENT[sale.payment_method]?.label || sale.payment_method}</td><td class="r">${money(sale.amount_received)}</td></tr>
      ${sale.payment_method === 'efectivo' ? `<tr><td>Vuelto</td><td class="r">${money(sale.change_given)}</td></tr>` : ''}
    </table>
    <hr>
    <div class="c">${esc(s.ticket_footer || '¡Gracias por su compra!')}</div>
    <div class="c muted" style="margin-top:6px">Representación interna de venta.<br>No válido como comprobante electrónico SUNAT.</div>
  </body></html>`;
}

/** Imprime el ticket usando un iframe oculto (no abre ventanas nuevas). */
export function printTicket(sale) {
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(frame);
  const doc = frame.contentWindow.document;
  doc.open();
  doc.write(ticketHtml(sale));
  doc.close();
  const go = () => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(() => frame.remove(), 2000);
  };
  const img = doc.querySelector('img');
  if (img && !img.complete) { img.onload = go; img.onerror = go; } else setTimeout(go, 150);
}
