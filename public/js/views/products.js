/**
 * Gestión de productos: listado con filtros/orden/paginación, CRUD, imagen,
 * kardex por producto, categorías e importación/exportación Excel o CSV.
 */
import { api } from '../api.js';
import { can, state } from '../state.js';
import {
  $, $$, esc, icon, icons, money, num, fmtDate, fmtTime, debounce, toast, toastError, openModal, confirmDialog,
  withLoading, formData, showErrors, check, req, minNum, isInt, tableHead, skeletonRows, emptyState,
  renderPagination, stockBadge, stockMeter, productThumb, animateIn, exportExcel, exportPdf, loadXlsx,
  resizeImage, MOVEMENT,
} from '../ui.js';
import { refreshLowBadge } from '../main.js';

const STATUS = [
  { key: '', label: 'Todos' },
  { key: 'alert', label: 'Stock bajo', icon: 'triangle-alert' },
  { key: 'out', label: 'Agotados', icon: 'circle-x' },
  { key: 'expiring', label: 'Por vencer', icon: 'calendar-clock' },
];

export async function render(root, params) {
  const filters = { q: '', category_id: '', supplier_id: params.supplier_id || '', status: params.status || '', sort: 'name', order: 'asc', page: 1, limit: 15 };
  const showCost = can('products.cost');
  let categories = [];
  let suppliers = [];

  root.innerHTML = `
    <div class="page-head">
      <div><h2>Productos</h2><p>Catálogo, precios y existencias de tu negocio.</p></div>
      <div class="actions">
        ${can('products.write') ? `
          <button class="btn btn-outline" id="catBtn">${icon('tags')}Categorías</button>
          <button class="btn btn-outline" id="importBtn">${icon('upload')}Importar</button>` : ''}
        <div class="dropdown">
          <button class="btn btn-outline" id="exportBtn">${icon('download')}Exportar</button>
          <div class="dropdown-menu" id="exportMenu" hidden>
            <button data-exp="xlsx">${icon('file-spreadsheet')}Excel (.xlsx)</button>
            <button data-exp="csv">${icon('file-text')}CSV</button>
            <button data-exp="pdf">${icon('file-type')}PDF</button>
          </div>
        </div>
        ${can('products.write') ? `<button class="btn btn-primary" id="newBtn">${icon('plus')}Nuevo producto</button>` : ''}
      </div>
    </div>
    <div class="card">
      <div class="toolbar">
        <div class="grow input-icon">${icon('search')}<input class="input" id="q" placeholder="Buscar por nombre, código, marca o categoría..." autocomplete="off"></div>
        <select class="select" id="cat"><option value="">Todas las categorías</option></select>
        <select class="select" id="sup"><option value="">Todos los proveedores</option></select>
      </div>
      <div class="toolbar" style="padding-top:0;border-bottom:1px solid var(--border)">
        <div class="chips" id="chips">
          ${STATUS.map((s) => `<button class="chip ${filters.status === s.key ? 'active' : ''}" data-status="${s.key}">${s.icon ? icon(s.icon) : ''}${s.label}</button>`).join('')}
        </div>
      </div>
      <div class="table-wrap"><table class="table" id="table"></table></div>
      <div class="pagination" id="pager"></div>
    </div>`;

  const columns = [
    { key: 'name', label: 'Producto', sortable: true },
    { key: 'category', label: 'Categoría', sortable: true, cls: 'hide-sm' },
    ...(showCost ? [{ key: 'purchase_price', label: 'P. compra', sortable: true, cls: 'num hide-sm' }] : []),
    { key: 'sale_price', label: 'P. venta', sortable: true, cls: 'num' },
    { key: 'stock', label: 'Stock', sortable: true },
    { key: 'status', label: 'Estado', cls: 'hide-sm' },
    { key: 'expiry_date', label: 'Vence', sortable: true, cls: 'hide-sm' },
    { key: 'actions', label: '', cls: 'actions-cell' },
  ];

  // ---------------------------------------------------------- carga
  async function loadLookups() {
    [categories, suppliers] = await Promise.all([
      api.get('/categories'),
      showCost || state.user.role === 'almacenero' ? api.get('/suppliers', { limit: 'all' }).then((r) => r.data).catch(() => []) : Promise.resolve([]),
    ]);
    $('#cat').innerHTML = `<option value="">Todas las categorías</option>${categories.map((c) => `<option value="${c.id}">${esc(c.name)} (${c.product_count})</option>`).join('')}`;
    $('#cat').value = filters.category_id;
    const sup = $('#sup');
    if (suppliers.length) {
      sup.innerHTML = `<option value="">Todos los proveedores</option>${suppliers.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}`;
      sup.value = filters.supplier_id;
    } else sup.hidden = true;
  }

  async function load() {
    const table = $('#table');
    table.innerHTML = tableHead(columns, { key: filters.sort, order: filters.order }) + `<tbody>${skeletonRows(columns.length)}</tbody>`;
    icons();
    bindSort();
    try {
      const res = await api.get('/products', filters);
      const body = res.data.length
        ? res.data.map(rowHtml).join('')
        : `<tr><td colspan="${columns.length}">${emptyState({
          iconName: 'package-search',
          title: filters.q || filters.status || filters.category_id ? 'No hay productos con esos filtros' : 'Aún no tienes productos',
          text: filters.q ? `No encontramos resultados para "${filters.q}".` : 'Agrega tu primer producto o importa tu catálogo desde Excel.',
          action: can('products.write') && !filters.q ? `<button class="btn btn-primary" data-new>${icon('plus')}Agregar producto</button>` : '',
        })}</td></tr>`;
      $('tbody', table).innerHTML = body;
      icons();
      animateIn($$('tbody tr', table), { y: 6, stagger: 0.02, duration: 0.3 });
      bindRows(res.data);
      renderPagination($('#pager'), res, (p) => { filters.page = p; load(); });
    } catch (err) {
      $('tbody', table).innerHTML = `<tr><td colspan="${columns.length}">${emptyState({ iconName: 'cloud-off', title: 'No se pudieron cargar los productos', text: err.message })}</td></tr>`;
      icons();
    }
  }

  function rowHtml(p) {
    const rowCls = p.stock <= 0 ? 'row-alert' : p.stock <= p.min_stock ? 'row-warn' : '';
    const expiring = p.expiry_date && p.expiry_date <= addDays(Number(state.settings?.expiry_alert_days) || 30);
    const expired = p.expiry_date && p.expiry_date < addDays(0);
    const margin = p.sale_price > 0 ? ((p.sale_price - p.purchase_price) / p.sale_price) * 100 : 0;
    return `<tr class="${rowCls}">
      <td><div class="prod-cell">${productThumb(p)}<div><strong>${esc(p.name)}</strong><small class="mono">${esc(p.code)}</small>${p.presentation ? `<small> · ${esc(p.presentation)}</small>` : ''}</div></div></td>
      <td class="hide-sm">${p.category_name ? `<span class="badge"><span class="dot" style="background:${esc(p.category_color)}"></span>${esc(p.category_name)}</span>` : '<span class="muted">—</span>'}</td>
      ${showCost ? `<td class="num hide-sm">${money(p.purchase_price)}</td>` : ''}
      <td class="num"><strong>${money(p.sale_price)}</strong>${showCost ? `<div class="muted">margen ${margin.toFixed(0)}%</div>` : ''}</td>
      <td>${stockMeter(p)}<div class="muted">mín. ${num(p.min_stock)}</div></td>
      <td class="hide-sm">${stockBadge(p)}</td>
      <td class="hide-sm">${p.expiry_date ? `<span class="${expired ? 'text-danger fw-6' : expiring ? 'text-warning fw-6' : ''}">${fmtDate(p.expiry_date)}</span>` : '<span class="muted">—</span>'}</td>
      <td class="actions-cell">
        <button class="btn btn-ghost btn-icon btn-sm" data-kardex="${p.id}" title="Ver kardex">${icon('history')}</button>
        ${can('products.write') ? `<button class="btn btn-ghost btn-icon btn-sm" data-edit="${p.id}" title="Editar">${icon('pencil')}</button>` : ''}
        ${can('products.delete') ? `<button class="btn btn-ghost btn-icon btn-sm" data-del="${p.id}" title="Eliminar" style="color:var(--danger)">${icon('trash-2')}</button>` : ''}
      </td>
    </tr>`;
  }

  function bindSort() {
    $$('th[data-sort]', root).forEach((th) => {
      th.onclick = () => {
        if (filters.sort === th.dataset.sort) filters.order = filters.order === 'asc' ? 'desc' : 'asc';
        else { filters.sort = th.dataset.sort; filters.order = 'asc'; }
        filters.page = 1;
        load();
      };
    });
  }

  function bindRows(rows) {
    const find = (id) => rows.find((r) => r.id === Number(id));
    $$('[data-edit]', root).forEach((b) => { b.onclick = () => productForm(find(b.dataset.edit)); });
    $$('[data-kardex]', root).forEach((b) => { b.onclick = () => kardex(find(b.dataset.kardex)); });
    $$('[data-del]', root).forEach((b) => { b.onclick = () => remove(find(b.dataset.del)); });
    $$('[data-new]', root).forEach((b) => { b.onclick = () => productForm(); });
  }

  // ---------------------------------------------------------- formulario
  function productForm(p = null) {
    const isNew = !p;
    let imageData = undefined; // undefined = sin cambios, null = quitar, string = nueva
    const m = openModal({
      title: isNew ? 'Nuevo producto' : 'Editar producto',
      sub: isNew ? 'Completa los datos del producto' : esc(p.code),
      size: 'lg',
      body: `
      <form id="pForm" class="form-grid" novalidate>
        <div class="span-2 image-drop" id="drop">
          <div class="preview" id="preview">${!isNew && p.has_image ? `<img src="/api/products/${p.id}/image?v=${encodeURIComponent(p.updated_at)}" alt="">` : icon('image-plus')}</div>
          <div style="flex:1"><strong>Imagen del producto</strong><div class="text-sm text-faint">Arrastra una foto o haz clic para elegirla (JPG, PNG o WEBP). Se optimiza automáticamente.</div>
          <button type="button" class="btn btn-ghost btn-sm mt-1" id="rmImg" ${!isNew && p.has_image ? '' : 'hidden'} style="color:var(--danger);padding:0 6px">${icon('trash-2')}Quitar imagen</button></div>
          <input type="file" id="file" accept="image/png,image/jpeg,image/webp" hidden>
        </div>

        <div class="form-section">Información general</div>
        <div class="field span-2"><label>Nombre <span class="req">*</span></label><input class="input" name="name" maxlength="120" placeholder="Ej: Inca Kola 500 ml" value="${esc(p?.name)}" autofocus></div>
        <div class="field"><label>Código de barras / código</label>
          <div class="input-icon">${icon('barcode')}<input class="input" name="code" maxlength="60" placeholder="Escanea o déjalo vacío para generarlo" value="${esc(p?.code)}"></div></div>
        <div class="field"><label>Categoría</label><select class="select" name="category_id"><option value="">Sin categoría</option>${categories.map((c) => `<option value="${c.id}" ${p?.category_id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Marca</label><input class="input" name="brand" maxlength="60" placeholder="Ej: Inca Kola" value="${esc(p?.brand)}"></div>
        <div class="field"><label>Presentación</label><input class="input" name="presentation" maxlength="60" list="presList" placeholder="Ej: Botella 500 ml" value="${esc(p?.presentation)}">
          <datalist id="presList">${['Lata 355 ml', 'Botella 500 ml', 'Botella 625 ml', 'Botella 1 L', 'Botella 1.5 L', 'Botella 3 L', 'Botella 620 ml', 'Pack 6 unidades', 'Caja x12', 'Bolsa'].map((x) => `<option value="${x}">`).join('')}</datalist></div>
        <div class="field span-2"><label>Proveedor</label><select class="select" name="supplier_id"><option value="">Sin proveedor</option>${suppliers.map((s) => `<option value="${s.id}" ${p?.supplier_id === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>

        <div class="form-section">Precios y stock</div>
        <div class="field"><label>Precio de compra <span class="req">*</span></label><div class="input-group"><span class="addon">${esc(state.settings?.currency_symbol || 'S/')}</span><input class="input" name="purchase_price" type="number" step="0.01" min="0" inputmode="decimal" value="${p?.purchase_price ?? ''}" placeholder="0.00"></div></div>
        <div class="field"><label>Precio de venta <span class="req">*</span></label><div class="input-group"><span class="addon">${esc(state.settings?.currency_symbol || 'S/')}</span><input class="input" name="sale_price" type="number" step="0.01" min="0" inputmode="decimal" value="${p?.sale_price ?? ''}" placeholder="0.00"></div><span class="help" id="marginHelp"></span></div>
        ${isNew
          ? '<div class="field"><label>Stock inicial</label><input class="input" name="stock" type="number" min="0" step="1" inputmode="numeric" value="0"><span class="help">Se registrará como entrada en el kardex</span></div>'
          : `<div class="field"><label>Stock actual</label><input class="input" value="${num(p.stock)} unidades" disabled><span class="help">Para cambiarlo usa <a href="#/stock">Control de stock</a></span></div>`}
        <div class="field"><label>Stock mínimo</label><input class="input" name="min_stock" type="number" min="0" step="1" inputmode="numeric" value="${p?.min_stock ?? 0}"><span class="help">Te avisaremos cuando llegue a este nivel</span></div>
        <div class="field"><label>Fecha de vencimiento</label><input class="input" name="expiry_date" type="date" value="${esc(p?.expiry_date || '')}"><span class="help">Opcional</span></div>
      </form>`,
      footer: `<button class="btn btn-outline" data-close>Cancelar</button><button class="btn btn-primary" id="save">${icon('save')}${isNew ? 'Crear producto' : 'Guardar cambios'}</button>`,
    });

    const form = $('#pForm', m.el);
    const drop = $('#drop', m.el);
    const file = $('#file', m.el);

    const updateMargin = () => {
      const pc = Number(form.purchase_price.value);
      const pv = Number(form.sale_price.value);
      const h = $('#marginHelp', m.el);
      if (pv > 0 && form.purchase_price.value !== '') {
        const g = pv - pc;
        h.innerHTML = `Ganancia por unidad: <strong class="${g >= 0 ? 'text-success' : 'text-danger'}">${money(g)} (${((g / pv) * 100).toFixed(1)}%)</strong>`;
      } else h.textContent = '';
    };
    form.purchase_price.oninput = updateMargin;
    form.sale_price.oninput = updateMargin;
    updateMargin();

    async function pick(f) {
      try {
        imageData = await resizeImage(f);
        $('#preview', m.el).innerHTML = `<img src="${imageData}" alt="">`;
        $('#rmImg', m.el).hidden = false;
      } catch (err) { toastError(err, 'Imagen no válida'); }
    }
    drop.onclick = (e) => { if (!e.target.closest('#rmImg')) file.click(); };
    file.onchange = () => file.files[0] && pick(file.files[0]);
    drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('drag'); };
    drop.ondragleave = () => drop.classList.remove('drag');
    drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('drag'); if (e.dataTransfer.files[0]) pick(e.dataTransfer.files[0]); };
    $('#rmImg', m.el).onclick = (e) => {
      e.stopPropagation();
      imageData = null;
      $('#preview', m.el).innerHTML = icon('image-plus');
      $('#rmImg', m.el).hidden = true;
      icons();
    };

    // El lector de código de barras "teclea" y envía Enter: no debe enviar el formulario
    form.code.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); form.brand.focus(); } });

    const save = () => withLoading($('#save', m.el), async () => {
      const d = formData(form);
      const errors = check(d, {
        name: [req('El nombre'), (v) => (v.length < 2 ? 'El nombre es muy corto' : null)],
        purchase_price: [req('El precio de compra'), minNum('El precio de compra')],
        sale_price: [req('El precio de venta'), minNum('El precio de venta')],
        min_stock: [minNum('El stock mínimo'), isInt('El stock mínimo')],
        ...(isNew ? { stock: [minNum('El stock'), isInt('El stock')] } : {}),
      });
      if (errors) return showErrors(form, errors);
      if (Number(d.sale_price) < Number(d.purchase_price)) {
        const ok = await confirmDialog({ title: 'Precio de venta menor al de compra', message: 'Estarías vendiendo con pérdida. ¿Deseas guardar de todas formas?', confirmText: 'Guardar igual', tone: 'warning' });
        if (!ok) return;
      }
      try {
        const saved = isNew ? await api.post('/products', d) : await api.put(`/products/${p.id}`, d);
        if (imageData) await api.put(`/products/${saved.id}/image`, { image: imageData });
        else if (imageData === null && !isNew) await api.del(`/products/${saved.id}/image`);
        toast('success', isNew ? 'Producto creado' : 'Cambios guardados', saved.name);
        m.close();
        load();
        refreshLowBadge();
      } catch (err) {
        if (err.details) showErrors(form, err.details);
        else toastError(err);
      }
    });
    $('#save', m.el).onclick = save;
    form.onsubmit = (e) => { e.preventDefault(); save(); };
  }

  async function remove(p) {
    const ok = await confirmDialog({
      title: 'Eliminar producto',
      message: `¿Seguro que deseas eliminar <strong>${esc(p.name)}</strong>? Si tiene ventas o movimientos registrados se conservará en el historial.`,
      confirmText: 'Eliminar',
    });
    if (!ok) return;
    try {
      await api.del(`/products/${p.id}`);
      toast('success', 'Producto eliminado', p.name);
      load();
      refreshLowBadge();
    } catch (err) { toastError(err); }
  }

  // ---------------------------------------------------------- kardex
  async function kardex(p) {
    const m = openModal({
      title: `Kardex: ${p.name}`,
      sub: `${esc(p.code)} · Stock actual: <strong>${num(p.stock)}</strong>`,
      size: 'lg',
      body: '<div class="loading-block"><span class="spinner"></span></div>',
    });
    try {
      const rows = await api.get(`/products/${p.id}/movements`);
      m.body.innerHTML = rows.length ? `
        <div class="table-wrap"><table class="table compact">
          <thead><tr><th>Fecha</th><th>Tipo</th><th class="num">Cant.</th><th class="num">Saldo</th><th class="hide-sm">Detalle</th><th class="hide-sm">Usuario</th></tr></thead>
          <tbody>${rows.map((r) => `<tr>
            <td>${fmtDate(r.created_at)}<div class="muted">${fmtTime(r.created_at)}</div></td>
            <td><span class="badge ${MOVEMENT[r.type]?.badge || ''}">${MOVEMENT[r.type]?.label || r.type}</span></td>
            <td class="num fw-7 ${r.quantity > 0 ? 'text-success' : 'text-danger'}">${r.quantity > 0 ? '+' : ''}${num(r.quantity)}</td>
            <td class="num">${num(r.stock_after)}</td>
            <td class="hide-sm">${esc(r.reason || '')}${r.reference ? ` <span class="muted mono">${esc(r.reference)}</span>` : ''}</td>
            <td class="hide-sm muted">${esc(r.user_name || '—')}</td></tr>`).join('')}</tbody>
        </table></div><p class="text-sm text-faint mt-3">Se muestran los últimos 100 movimientos.</p>`
        : emptyState({ iconName: 'history', title: 'Sin movimientos registrados' });
      icons();
    } catch (err) { m.body.innerHTML = emptyState({ iconName: 'cloud-off', title: 'Error', text: err.message }); icons(); }
  }

  // ---------------------------------------------------------- categorías
  function categoriesModal() {
    const m = openModal({ title: 'Categorías', sub: 'Organiza tus productos por tipo', body: '' });
    const draw = () => {
      m.body.innerHTML = `
        <form id="catForm" class="flex gap-2" style="margin-bottom:16px" novalidate>
          <input type="color" name="color" value="#2563eb" class="input" style="width:48px;padding:4px" title="Color">
          <input class="input" name="name" placeholder="Nueva categoría (ej. Licores)" maxlength="60" style="flex:1">
          <button class="btn btn-primary">${icon('plus')}Agregar</button>
        </form>
        <ul class="list card">${categories.map((c) => `
          <li class="list-item">
            <span class="dot" style="background:${esc(c.color)};width:12px;height:12px"></span>
            <div class="grow"><strong>${esc(c.name)}</strong><small>${c.product_count} producto(s)</small></div>
            <button class="btn btn-ghost btn-icon btn-sm" data-cedit="${c.id}" title="Renombrar">${icon('pencil')}</button>
            ${can('categories.delete') ? `<button class="btn btn-ghost btn-icon btn-sm" data-cdel="${c.id}" title="Eliminar" style="color:var(--danger)">${icon('trash-2')}</button>` : ''}
          </li>`).join('') || `<li>${emptyState({ iconName: 'tags', title: 'Sin categorías' })}</li>`}</ul>`;
      icons();
      $('#catForm', m.el).onsubmit = async (e) => {
        e.preventDefault();
        const d = formData(e.target);
        if (!d.name) return showErrors(e.target, { name: 'Escribe un nombre' });
        try {
          await api.post('/categories', d);
          toast('success', 'Categoría creada', d.name);
          await loadLookups();
          draw();
        } catch (err) { toastError(err); }
      };
      $$('[data-cedit]', m.el).forEach((b) => {
        b.onclick = async () => {
          const c = categories.find((x) => x.id === Number(b.dataset.cedit));
          const li = b.closest('li');
          li.innerHTML = `<input type="color" value="${esc(c.color)}" class="input" style="width:44px;padding:4px"><input class="input" value="${esc(c.name)}" maxlength="60" style="flex:1"><button class="btn btn-primary btn-sm">${icon('check')}</button>`;
          icons();
          const [colorIn, nameIn] = $$('input', li);
          nameIn.focus();
          const commit = async () => {
            try { await api.put(`/categories/${c.id}`, { name: nameIn.value, color: colorIn.value }); await loadLookups(); draw(); load(); } catch (err) { toastError(err); }
          };
          $('button', li).onclick = commit;
          nameIn.onkeydown = (e) => { if (e.key === 'Enter') commit(); };
        };
      });
      $$('[data-cdel]', m.el).forEach((b) => {
        b.onclick = async () => {
          const c = categories.find((x) => x.id === Number(b.dataset.cdel));
          if (!(await confirmDialog({ title: 'Eliminar categoría', message: `¿Eliminar <strong>${esc(c.name)}</strong>?`, confirmText: 'Eliminar' }))) return;
          try { await api.del(`/categories/${c.id}`); toast('success', 'Categoría eliminada'); await loadLookups(); draw(); } catch (err) { toastError(err); }
        };
      });
    };
    draw();
  }

  // ---------------------------------------------------------- exportar
  async function exportData(type) {
    try {
      toast('info', 'Preparando archivo...', '', 1800);
      const { data } = await api.get('/products', { ...filters, page: 1, limit: 'all' });
      const rows = data.map((p) => ({
        'Código': p.code,
        'Nombre': p.name,
        'Categoría': p.category_name || '',
        'Marca': p.brand || '',
        'Presentación': p.presentation || '',
        ...(showCost ? { 'Precio compra': p.purchase_price } : {}),
        'Precio venta': p.sale_price,
        'Stock': p.stock,
        'Stock mínimo': p.min_stock,
        'Proveedor': p.supplier_name || '',
        'Vencimiento': p.expiry_date || '',
      }));
      const name = `productos-${new Date().toISOString().slice(0, 10)}`;
      if (type === 'xlsx') await exportExcel(name, [{ name: 'Productos', rows }]);
      else if (type === 'csv') {
        const XLSX = await loadXlsx();
        const csv = XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(rows));
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
        a.download = `${name}.csv`;
        a.click();
      } else {
        const totalValue = data.reduce((s, p) => s + Math.max(0, p.stock) * (showCost ? p.purchase_price : p.sale_price), 0);
        await exportPdf(name, {
          title: 'Inventario de productos',
          subtitle: `${data.length} productos`,
          summary: [['Productos', num(data.length)], ['Unidades', num(data.reduce((s, p) => s + Math.max(0, p.stock), 0))], [showCost ? 'Valor (costo)' : 'Valor (venta)', money(totalValue)]],
          tables: [{
            head: ['Código', 'Producto', 'Categoría', showCost ? 'P. compra' : null, 'P. venta', 'Stock', 'Mín.'].filter(Boolean),
            body: data.map((p) => [p.code, p.name, p.category_name || '', showCost ? money(p.purchase_price) : null, money(p.sale_price), p.stock, p.min_stock].filter((v) => v !== null)),
          }],
        });
      }
      toast('success', 'Archivo descargado');
    } catch (err) { toastError(err, 'No se pudo exportar'); }
  }

  // ---------------------------------------------------------- importar
  const HEADER_MAP = {
    'código': 'code', codigo: 'code', code: 'code', 'código de barras': 'code',
    nombre: 'name', name: 'name', producto: 'name',
    'categoría': 'category', categoria: 'category', category: 'category',
    marca: 'brand', brand: 'brand',
    'presentación': 'presentation', presentacion: 'presentation',
    'precio compra': 'purchase_price', 'precio de compra': 'purchase_price', costo: 'purchase_price',
    'precio venta': 'sale_price', 'precio de venta': 'sale_price', precio: 'sale_price',
    stock: 'stock', cantidad: 'stock',
    'stock mínimo': 'min_stock', 'stock minimo': 'min_stock', 'mínimo': 'min_stock',
    proveedor: 'supplier', supplier: 'supplier',
    vencimiento: 'expiry_date', 'fecha de vencimiento': 'expiry_date',
  };

  function importModal() {
    const m = openModal({
      title: 'Importar productos',
      sub: 'Desde Excel (.xlsx) o CSV',
      size: 'lg',
      body: `
        <div class="alert alert-info mb">${icon('info')}<div>La primera fila debe tener los encabezados: <strong>Código, Nombre, Categoría, Marca, Presentación, Precio compra, Precio venta, Stock, Stock mínimo, Proveedor, Vencimiento</strong>.
          Si el código ya existe, el producto se <strong>actualiza</strong>; si no, se crea. Las categorías y proveedores nuevos se crean solos.</div></div>
        <div class="flex gap-2 wrap mb"><button class="btn btn-outline btn-sm" id="tpl">${icon('file-down')}Descargar plantilla</button></div>
        <label class="image-drop" id="impDrop" style="justify-content:center;padding:30px;flex-direction:column;text-align:center">
          ${icon('file-spreadsheet')}<strong>Arrastra tu archivo aquí o haz clic para seleccionarlo</strong><span class="text-sm text-faint">.xlsx, .xls o .csv</span>
          <input type="file" id="impFile" accept=".xlsx,.xls,.csv" hidden>
        </label>
        <div id="impPreview" class="mt-4"></div>`,
      footer: '<button class="btn btn-outline" data-close>Cancelar</button><button class="btn btn-primary" id="impGo" disabled>Importar</button>',
    });
    let rows = [];

    $('#tpl', m.el).onclick = () => exportExcel('plantilla-productos', [{
      name: 'Productos',
      rows: [{ 'Código': '7751271001019', 'Nombre': 'Inca Kola 500 ml', 'Categoría': 'Gaseosas', 'Marca': 'Inca Kola', 'Presentación': 'Botella 500 ml', 'Precio compra': 1.7, 'Precio venta': 2.5, 'Stock': 48, 'Stock mínimo': 12, 'Proveedor': 'Distribuidora XYZ', 'Vencimiento': '2027-06-30' }],
    }]);

    async function parse(f) {
      try {
        const XLSX = await loadXlsx();
        const wb = XLSX.read(await f.arrayBuffer(), { cellDates: true });
        const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
        rows = raw.map((r) => {
          const o = {};
          Object.entries(r).forEach(([k, v]) => {
            const key = HEADER_MAP[String(k).trim().toLowerCase()];
            if (!key) return;
            if (v instanceof Date) v = `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
            o[key] = typeof v === 'string' ? v.trim() : v;
          });
          return o;
        }).filter((o) => Object.values(o).some((v) => v !== ''));
        if (!rows.length) throw new Error('No se encontraron filas con encabezados reconocidos');
        $('#impPreview', m.el).innerHTML = `
          <p class="fw-6 mb">${icon('circle-check')} ${rows.length} fila(s) listas para importar — vista previa:</p>
          <div class="table-wrap card"><table class="table compact"><thead><tr><th>Código</th><th>Nombre</th><th>Categoría</th><th class="num">P. venta</th><th class="num">Stock</th></tr></thead>
          <tbody>${rows.slice(0, 8).map((r) => `<tr><td class="mono">${esc(r.code || '(auto)')}</td><td>${esc(r.name)}</td><td>${esc(r.category || '')}</td><td class="num">${esc(r.sale_price)}</td><td class="num">${esc(r.stock)}</td></tr>`).join('')}</tbody></table></div>
          ${rows.length > 8 ? `<p class="text-sm text-faint mt-2">… y ${rows.length - 8} más</p>` : ''}`;
        icons();
        $('#impGo', m.el).disabled = false;
      } catch (err) { toastError(err, 'Archivo no válido'); }
    }
    const fileIn = $('#impFile', m.el);
    fileIn.onchange = () => fileIn.files[0] && parse(fileIn.files[0]);
    const dz = $('#impDrop', m.el);
    dz.ondragover = (e) => { e.preventDefault(); dz.classList.add('drag'); };
    dz.ondragleave = () => dz.classList.remove('drag');
    dz.ondrop = (e) => { e.preventDefault(); dz.classList.remove('drag'); if (e.dataTransfer.files[0]) parse(e.dataTransfer.files[0]); };

    $('#impGo', m.el).onclick = () => withLoading($('#impGo', m.el), async () => {
      try {
        const r = await api.post('/products/import', { rows });
        $('#impPreview', m.el).innerHTML = `
          <div class="alert ${r.errors.length ? 'alert-warning' : 'alert-info'}">${icon(r.errors.length ? 'triangle-alert' : 'circle-check')}
          <div><strong>${r.created} creado(s), ${r.updated} actualizado(s)</strong>${r.errors.length ? `, ${r.errors.length} con errores:<ul style="margin:6px 0 0;padding-left:18px">${r.errors.slice(0, 10).map((e) => `<li>Fila ${e.row}: ${esc(e.message)}</li>`).join('')}</ul>` : ''}</div></div>`;
        icons();
        $('#impGo', m.el).hidden = true;
        toast('success', 'Importación completada', `${r.created + r.updated} producto(s)`);
        await loadLookups();
        load();
        refreshLowBadge();
      } catch (err) { toastError(err); }
    });
  }

  // ---------------------------------------------------------- eventos
  $('#q').oninput = debounce((e) => { filters.q = e.target.value.trim(); filters.page = 1; load(); }, 300);
  $('#cat').onchange = (e) => { filters.category_id = e.target.value; filters.page = 1; load(); };
  $('#sup').onchange = (e) => { filters.supplier_id = e.target.value; filters.page = 1; load(); };
  $$('#chips .chip').forEach((c) => {
    c.onclick = () => {
      filters.status = c.dataset.status;
      filters.page = 1;
      $$('#chips .chip').forEach((x) => x.classList.toggle('active', x === c));
      load();
    };
  });
  $('#newBtn')?.addEventListener('click', () => productForm());
  $('#catBtn')?.addEventListener('click', categoriesModal);
  $('#importBtn')?.addEventListener('click', importModal);
  $('#exportBtn').onclick = (e) => { e.stopPropagation(); $('#exportMenu').hidden = !$('#exportMenu').hidden; };
  $$('[data-exp]').forEach((b) => { b.onclick = () => { $('#exportMenu').hidden = true; exportData(b.dataset.exp); }; });
  const closeMenu = () => { const mnu = $('#exportMenu'); if (mnu) mnu.hidden = true; };
  document.addEventListener('click', closeMenu);

  // Atajo: "/" enfoca la búsqueda
  const onKey = (e) => { if (e.key === '/' && !e.target.closest('input,textarea,select')) { e.preventDefault(); $('#q')?.focus(); } };
  document.addEventListener('keydown', onKey);

  await loadLookups().catch(toastError);
  await load();
  return () => { document.removeEventListener('click', closeMenu); document.removeEventListener('keydown', onKey); };
}

function addDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
