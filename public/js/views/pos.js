/**
 * Punto de venta (POS): búsqueda por código de barras o nombre, carrito,
 * cobro con varios métodos de pago, cálculo de vuelto e impresión del ticket.
 *
 * Atajos: F2 = cobrar · F4 = vaciar carrito · Esc = volver al buscador
 * El lector de código de barras funciona como teclado: escribe el código + Enter.
 */
import { api } from '../api.js';
import { state, store } from '../state.js';
import {
  $, $$, esc, icon, icons, money, num, dec, toast, toastError, openModal, confirmDialog, withLoading,
  productThumb, animate, animateIn, shake, PAYMENT, emptyState,
} from '../ui.js';
import { printTicket } from '../ticket.js';
import { refreshLowBadge } from '../main.js';

const CART_KEY = 'pos-cart';

export async function render(root) {
  let products = [];
  let categories = [];
  let catFilter = '';
  let query = '';
  /** carrito: [{ id, name, code, price, stock, qty }] */
  let cart = (store.get(CART_KEY) || []).filter((l) => l && l.id && l.qty > 0);
  let discount = 0;
  const allowNegative = state.settings?.allow_negative_stock === '1';

  root.innerHTML = `
    <div class="pos">
      <div class="card pos-left">
        <div class="pos-search">
          <div class="input-icon has-action">${icon('scan-barcode')}
            <input class="input" id="search" placeholder="Escanea el código de barras o escribe el nombre del producto..." autocomplete="off" autofocus>
            <span class="input-action hide-sm"><kbd>Enter</kbd></span>
          </div>
          <div class="chips" id="cats"></div>
        </div>
        <div class="pos-grid" id="grid"><div class="loading-block" style="grid-column:1/-1"><span class="spinner"></span></div></div>
      </div>

      <div class="card pos-cart">
        <div class="cart-head">
          <h3>${icon('shopping-cart')}Venta actual <span class="badge badge-blue" id="cartCount">0</span></h3>
          <button class="btn btn-ghost btn-sm" id="clearBtn" title="Vaciar (F4)">${icon('trash-2')}Vaciar</button>
        </div>
        <div class="cart-items" id="cart"></div>
        <div class="cart-summary">
          <div class="sum-row"><span>Subtotal</span><span id="sGross">${money(0)}</span></div>
          <div class="sum-row" style="align-items:center"><span>Descuento</span>
            <span class="input-group" style="width:130px"><span class="addon" style="padding:0 8px">${esc(state.settings?.currency_symbol || 'S/')}</span><input class="input" id="discount" type="number" min="0" step="0.10" value="" placeholder="0.00" style="height:32px;text-align:right"></span>
          </div>
          <div class="sum-row"><span id="taxLabel">${esc(state.settings?.tax_name || 'IGV')}</span><span id="sTax">${money(0)}</span></div>
          <div class="sum-total"><span>Total</span><strong id="sTotal">${money(0)}</strong></div>
        </div>
        <div class="cart-actions">
          <button class="btn btn-outline btn-lg btn-icon" id="holdBtn" title="Actualizar productos">${icon('refresh-cw')}</button>
          <button class="btn btn-success btn-lg" id="payBtn" disabled>${icon('banknote')}Cobrar <kbd style="margin-left:4px;background:rgba(255,255,255,.2);color:#fff;border-color:rgba(255,255,255,.3)">F2</kbd></button>
        </div>
      </div>
    </div>
    <button class="mobile-cart-bar" id="mobileBar" hidden>
      <span>${icon('shopping-cart')} <span id="mbCount">0</span> producto(s)</span>
      <span>Ver carrito · <span id="mbTotal">${money(0)}</span></span>
    </button>`;
  icons();

  const search = $('#search');
  $('#mobileBar').onclick = () => $('.pos-cart').scrollIntoView({ behavior: 'smooth', block: 'start' });

  // ---------------------------------------------------------- catálogo
  async function loadCatalog() {
    try {
      const [res, cats] = await Promise.all([api.get('/products', { limit: 'all', sort: 'name' }), api.get('/categories')]);
      products = res.data;
      categories = cats.filter((c) => c.product_count > 0);
      // Sincroniza precios/stock del carrito guardado
      cart = cart.map((l) => {
        const p = products.find((x) => x.id === l.id);
        return p ? { ...l, name: p.name, price: p.sale_price, stock: p.stock } : null;
      }).filter(Boolean);
      drawCats();
      drawGrid();
      drawCart();
    } catch (err) {
      $('#grid').innerHTML = `<div style="grid-column:1/-1">${emptyState({ iconName: 'cloud-off', title: 'No se pudo cargar el catálogo', text: err.message })}</div>`;
      icons();
    }
  }

  function drawCats() {
    $('#cats').innerHTML = [{ id: '', name: 'Todos' }, ...categories]
      .map((c) => `<button class="chip ${String(catFilter) === String(c.id) ? 'active' : ''}" data-cat="${c.id}">${c.color ? `<span class="dot" style="background:${esc(c.color)}"></span>` : ''}${esc(c.name)}</button>`)
      .join('');
    $$('#cats .chip').forEach((b) => {
      b.onclick = () => { catFilter = b.dataset.cat; drawCats(); drawGrid(); search.focus(); };
    });
  }

  function filtered() {
    const q = query.toLowerCase();
    return products.filter((p) =>
      (!catFilter || String(p.category_id) === String(catFilter)) &&
      (!q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || (p.brand || '').toLowerCase().includes(q)));
  }

  function drawGrid() {
    const list = filtered().slice(0, 120);
    const grid = $('#grid');
    if (!list.length) {
      grid.innerHTML = `<div style="grid-column:1/-1">${emptyState({ iconName: 'search-x', title: 'Sin coincidencias', text: query ? `No hay productos para "${query}"` : 'No hay productos en esta categoría' })}</div>`;
      icons();
      return;
    }
    grid.innerHTML = list.map((p) => {
      const out = p.stock <= 0 && !allowNegative;
      const stkCls = p.stock <= 0 ? 'out' : p.stock <= p.min_stock ? 'low' : '';
      return `<button class="pos-item ${out ? 'disabled' : ''}" data-id="${p.id}" ${out ? 'aria-disabled="true"' : ''} title="${esc(p.name)}">
        ${productThumb(p, 'thumb')}
        <span class="name">${esc(p.name)}</span>
        <span class="row"><span class="price">${money(p.sale_price)}</span><span class="stk ${stkCls}">${p.stock <= 0 ? 'Agotado' : `${num(p.stock)} und.`}</span></span>
      </button>`;
    }).join('');
    icons();
    $$('.pos-item', grid).forEach((b) => {
      b.onclick = () => {
        const p = products.find((x) => x.id === Number(b.dataset.id));
        if (addToCart(p)) animate(b, { scale: [1, 0.94, 1] }, { duration: 0.25 });
      };
    });
  }

  // ---------------------------------------------------------- carrito
  function save() { store.set(CART_KEY, cart); }

  function addToCart(p, qty = 1) {
    if (!p) return false;
    const line = cart.find((l) => l.id === p.id);
    const newQty = (line ? line.qty : 0) + qty;
    if (!allowNegative && newQty > p.stock) {
      toast('warning', 'Stock insuficiente', `${p.name}: solo quedan ${num(p.stock)} unidad(es)`);
      return false;
    }
    if (line) line.qty = newQty;
    else cart.push({ id: p.id, name: p.name, code: p.code, price: p.sale_price, stock: p.stock, qty });
    save();
    drawCart(p.id);
    return true;
  }

  function setQty(id, qty) {
    const line = cart.find((l) => l.id === id);
    if (!line) return;
    qty = Math.floor(Number(qty) || 0);
    if (qty <= 0) cart = cart.filter((l) => l.id !== id);
    else if (!allowNegative && qty > line.stock) {
      toast('warning', 'Stock insuficiente', `Solo hay ${num(line.stock)} unidad(es) de ${line.name}`);
      line.qty = line.stock;
    } else line.qty = qty;
    save();
    drawCart();
  }

  function totals() {
    const gross = round2(cart.reduce((s, l) => s + l.price * l.qty, 0));
    const disc = Math.min(Math.max(0, discount), gross);
    const rate = (Number(state.settings?.tax_rate) || 0) / 100;
    const net = round2(gross - disc);
    if (state.settings?.tax_included !== '0') {
      const sub = round2(net / (1 + rate));
      return { gross, disc, subtotal: sub, tax: round2(net - sub), total: net };
    }
    const tax = round2(net * rate);
    return { gross, disc, subtotal: net, tax, total: round2(net + tax) };
  }

  function drawCart(highlightId) {
    const box = $('#cart');
    $('#cartCount').textContent = cart.reduce((s, l) => s + l.qty, 0);
    if (!cart.length) {
      box.innerHTML = `<div class="cart-empty"><div>${icon('shopping-basket')}<p class="fw-6" style="color:var(--text-2)">El carrito está vacío</p><p class="text-sm">Escanea un producto o tócalo en la lista para agregarlo</p></div></div>`;
    } else {
      box.innerHTML = cart.map((l) => `
        <div class="cart-line" data-line="${l.id}">
          <div><div class="nm">${esc(l.name)}</div><div class="unit">${money(l.price)} c/u</div></div>
          <button class="btn btn-ghost btn-icon btn-sm" data-rm="${l.id}" title="Quitar" style="color:var(--text-3)">${icon('x')}</button>
          <div class="qty">
            <button data-dec="${l.id}" aria-label="Menos">${icon('minus')}</button>
            <input type="number" min="1" value="${l.qty}" data-qty="${l.id}" aria-label="Cantidad">
            <button data-inc="${l.id}" aria-label="Más">${icon('plus')}</button>
          </div>
          <div class="line-total">${money(l.price * l.qty)}</div>
        </div>`).join('');
    }
    icons();

    $$('[data-inc]', box).forEach((b) => { b.onclick = () => { const p = products.find((x) => x.id === Number(b.dataset.inc)); addToCart(p || cart.find((l) => l.id === Number(b.dataset.inc))); }; });
    $$('[data-dec]', box).forEach((b) => { b.onclick = () => { const l = cart.find((x) => x.id === Number(b.dataset.dec)); setQty(l.id, l.qty - 1); }; });
    $$('[data-rm]', box).forEach((b) => { b.onclick = () => setQty(Number(b.dataset.rm), 0); });
    $$('[data-qty]', box).forEach((inp) => {
      inp.onchange = () => setQty(Number(inp.dataset.qty), inp.value);
      inp.onkeydown = (e) => { if (e.key === 'Enter') { inp.blur(); search.focus(); } };
    });

    if (highlightId) {
      const el = $(`[data-line="${highlightId}"]`, box);
      if (el) {
        el.scrollIntoView({ block: 'nearest' });
        el.classList.remove('flash');
        void el.offsetWidth; // reinicia la animación CSS
        el.classList.add('flash');
      }
    }

    const t = totals();
    $('#sGross').textContent = money(t.gross);
    $('#sTax').textContent = money(t.tax);
    $('#taxLabel').textContent = `${state.settings?.tax_name || 'IGV'} (${state.settings?.tax_rate || 18}%)${state.settings?.tax_included !== '0' ? ' incluido' : ''}`;
    const totalEl = $('#sTotal');
    if (totalEl.textContent !== money(t.total)) {
      totalEl.textContent = money(t.total);
      animate(totalEl, { scale: [1.06, 1] }, { duration: 0.25 });
    }
    $('#payBtn').disabled = !cart.length;
    $('#mobileBar').hidden = !cart.length;
    $('#mbCount').textContent = cart.reduce((s, l) => s + l.qty, 0);
    $('#mbTotal').textContent = money(t.total);
  }

  // ---------------------------------------------------------- búsqueda / escáner
  async function onEnter() {
    const q = search.value.trim();
    if (!q) return;
    let p = products.find((x) => x.code === q);
    if (!p) {
      const matches = filtered();
      if (matches.length === 1) p = matches[0];
    }
    if (!p) {
      // Puede ser un producto creado después de abrir el POS
      try {
        const r = await api.get('/products/lookup', { q });
        if (r.length === 1) { p = r[0]; if (!products.some((x) => x.id === p.id)) products.push(p); }
      } catch { /* noop */ }
    }
    if (p) {
      if (p.stock <= 0 && !allowNegative) {
        toast('warning', 'Producto agotado', p.name);
        shake(search);
      } else addToCart(p);
      search.value = '';
      query = '';
      drawGrid();
    } else {
      toast('warning', 'Producto no encontrado', `No existe un producto con el código "${q}"`);
      shake(search);
      search.select();
    }
  }

  let typingTimer;
  search.addEventListener('input', () => {
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => { query = search.value.trim(); drawGrid(); }, 120);
  });
  search.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); onEnter(); } });

  $('#discount').addEventListener('input', (e) => {
    discount = Math.max(0, Number(e.target.value) || 0);
    const t = totals();
    if (discount > t.gross) { e.target.classList.add('invalid'); } else e.target.classList.remove('invalid');
    drawCart();
  });

  $('#clearBtn').onclick = clearCart;
  $('#holdBtn').onclick = () => withLoading($('#holdBtn'), async () => { await loadCatalog(); toast('success', 'Catálogo actualizado'); });
  $('#payBtn').onclick = checkout;

  async function clearCart() {
    if (!cart.length) return;
    if (!(await confirmDialog({ title: 'Vaciar carrito', message: '¿Quitar todos los productos de la venta actual?', confirmText: 'Vaciar', tone: 'warning' }))) return;
    cart = [];
    discount = 0;
    $('#discount').value = '';
    save();
    drawCart();
    search.focus();
  }

  // ---------------------------------------------------------- cobro
  function checkout() {
    if (!cart.length) return;
    const t = totals();
    if (discount > t.gross) return toast('warning', 'Descuento inválido', 'El descuento no puede superar el subtotal');
    let method = 'efectivo';

    const quick = [...new Set([Math.ceil(t.total), Math.ceil(t.total / 5) * 5, Math.ceil(t.total / 10) * 10, 20, 50, 100, 200])]
      .filter((v) => v >= t.total).sort((a, b) => a - b).slice(0, 5);

    const m = openModal({
      title: 'Cobrar venta',
      sub: `${cart.reduce((s, l) => s + l.qty, 0)} producto(s)`,
      size: 'lg',
      body: `
        <div class="pay-total"><span>Total a pagar</span><strong>${money(t.total)}</strong></div>
        <div class="field mb"><label>Método de pago</label>
          <div class="pay-methods">${Object.entries(PAYMENT).map(([k, p]) => `
            <button type="button" class="pay-method ${k === method ? 'active' : ''}" data-m="${k}">
              ${k === 'yape' || k === 'plin' ? `<span class="pm-logo" style="background:${p.color}">${p.label[0]}</span>` : icon(p.icon)}${p.label}
            </button>`).join('')}</div>
        </div>
        <div id="cashBox">
          <div class="field"><label>Monto recibido</label>
            <div class="input-group"><span class="addon">${esc(state.settings?.currency_symbol || 'S/')}</span>
            <input class="input" id="received" type="number" step="0.10" min="0" inputmode="decimal" style="height:52px;font-size:22px;font-weight:700" placeholder="${dec(t.total)}"></div>
          </div>
          <div class="quick-cash">
            <button type="button" class="btn btn-outline" data-q="${t.total}">Exacto</button>
            ${quick.map((v) => `<button type="button" class="btn btn-outline" data-q="${v}">${money(v)}</button>`).join('')}
          </div>
          <div class="change-box" id="changeBox"><span class="fw-6">Vuelto</span><strong id="change">${money(0)}</strong></div>
        </div>
        <div id="digitalBox" hidden class="alert alert-info">${icon('info')}<div id="digitalMsg"></div></div>
        <details class="mt-4"><summary class="fw-6" style="cursor:pointer">Datos del cliente (opcional)</summary>
          <div class="form-grid mt-3">
            <div class="field"><label>Nombre</label><input class="input" id="cName" maxlength="120" placeholder="Cliente varios"></div>
            <div class="field"><label>DNI / RUC</label><input class="input" id="cDoc" maxlength="15" inputmode="numeric" placeholder="Opcional"></div>
          </div>
        </details>`,
      footer: `<button class="btn btn-outline" data-close>Cancelar</button>
               <button class="btn btn-success btn-lg" id="confirmPay" data-loading="Procesando...">${icon('check')}Confirmar venta</button>`,
    });

    const received = $('#received', m.el);
    const updateChange = () => {
      const r = Number(received.value || t.total);
      const ch = round2(r - t.total);
      const box = $('#changeBox', m.el);
      box.classList.toggle('neg', ch < 0);
      $('span', box).textContent = ch < 0 ? 'Falta' : 'Vuelto';
      $('#change', m.el).textContent = money(Math.abs(ch));
    };
    received.oninput = updateChange;
    $$('[data-q]', m.el).forEach((b) => { b.onclick = () => { received.value = Number(b.dataset.q).toFixed(2); updateChange(); received.focus(); }; });
    $$('[data-m]', m.el).forEach((b) => {
      b.onclick = () => {
        method = b.dataset.m;
        $$('[data-m]', m.el).forEach((x) => x.classList.toggle('active', x === b));
        const cash = method === 'efectivo';
        $('#cashBox', m.el).hidden = !cash;
        $('#digitalBox', m.el).hidden = cash;
        const msgs = {
          tarjeta: 'Procesa el cobro en el POS de la tarjeta y confirma cuando la transacción sea aprobada.',
          transferencia: 'Verifica que la transferencia se haya recibido en la cuenta del negocio antes de confirmar.',
          yape: 'Pide al cliente que yapee el monto exacto y verifica la notificación antes de confirmar.',
          plin: 'Pide al cliente que envíe el Plin por el monto exacto y verifica antes de confirmar.',
        };
        $('#digitalMsg', m.el).textContent = msgs[method] || '';
        if (cash) received.focus();
      };
    });
    received.onkeydown = (e) => { if (e.key === 'Enter') $('#confirmPay', m.el).click(); };
    setTimeout(() => received.focus(), 80);

    $('#confirmPay', m.el).onclick = () => withLoading($('#confirmPay', m.el), async () => {
      const amount = method === 'efectivo' ? Number(received.value || t.total) : t.total;
      if (method === 'efectivo' && amount + 0.001 < t.total) {
        shake(received);
        return toast('warning', 'Monto insuficiente', `Faltan ${money(t.total - amount)}`);
      }
      try {
        const sale = await api.post('/sales', {
          items: cart.map((l) => ({ product_id: l.id, quantity: l.qty })),
          payment_method: method,
          amount_received: amount,
          discount: t.disc,
          customer_name: $('#cName', m.el).value,
          customer_doc: $('#cDoc', m.el).value,
        });
        m.close();
        cart = [];
        discount = 0;
        $('#discount').value = '';
        save();
        drawCart();
        success(sale);
        loadCatalog();
        refreshLowBadge();
      } catch (err) {
        toastError(err, 'No se pudo registrar la venta');
        if (err.status === 409) loadCatalog();
      }
    });
  }

  function success(sale) {
    const m = openModal({
      title: 'Venta registrada',
      size: 'sm',
      body: `
        <div class="success-check">${icon('check')}</div>
        <div class="c" style="text-align:center">
          <div class="text-muted">Ticket <strong class="mono">${esc(sale.number)}</strong></div>
          <div style="font-size:32px;font-weight:800;letter-spacing:-.02em;margin:6px 0">${money(sale.total)}</div>
          ${sale.payment_method === 'efectivo' ? `<div class="change-box" style="justify-content:center;gap:12px"><span class="fw-6">Vuelto</span><strong>${money(sale.change_given)}</strong></div>` : `<span class="badge badge-blue">${PAYMENT[sale.payment_method].label}</span>`}
        </div>`,
      footer: `<button class="btn btn-outline" id="printBtn">${icon('printer')}Imprimir ticket</button>
               <button class="btn btn-primary" data-close id="newSale">${icon('plus')}Nueva venta</button>`,
      onClose: () => search.focus(),
    });
    animate($('.success-check', m.el), { scale: [0.4, 1.1, 1], rotate: [-20, 0] }, { duration: 0.55, ease: [0.22, 1, 0.36, 1] });
    $('#printBtn', m.el).onclick = () => printTicket(sale);
    setTimeout(() => $('#newSale', m.el)?.focus(), 100);
  }

  // ---------------------------------------------------------- atajos
  const onKey = (e) => {
    if ($('#modals').children.length) return;
    if (e.key === 'F2') { e.preventDefault(); checkout(); }
    else if (e.key === 'F4') { e.preventDefault(); clearCart(); }
    else if (e.key === 'Escape') { search.value = ''; query = ''; drawGrid(); search.focus(); }
  };
  document.addEventListener('keydown', onKey);

  drawCart();
  await loadCatalog();
  animateIn($$('.pos-item').slice(0, 24), { y: 10, stagger: 0.015, duration: 0.3 });
  search.focus();
  return () => document.removeEventListener('keydown', onKey);
}

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
