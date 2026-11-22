/**
 * Configuración: datos del negocio, logo, moneda e impuestos, ticket, inventario y backups.
 */
import { api } from '../api.js';
import { state, clearSession } from '../state.js';
import { $, esc, icon, icons, toast, toastError, withLoading, formData, showErrors, check, req, resizeImage, confirmDialog, downloadBlob, animateIn } from '../ui.js';
import { loadSettings, renderShell, logoUrl } from '../main.js';

export async function render(root) {
  const s = await loadSettings();

  root.innerHTML = `
    <div class="page-head"><div><h2>Configuración</h2><p>Datos del negocio, impuestos, ticket y copias de seguridad.</p></div>
      <div class="actions"><button class="btn btn-primary" id="save">${icon('save')}Guardar cambios</button></div></div>
    <form id="cfg" novalidate>
      <div class="grid grid-2 mb">
        <div class="card">
          <div class="card-head"><div><h3>${icon('store')} Datos del negocio</h3><div class="hint">Aparecen en el ticket, reportes y pantalla de inicio</div></div></div>
          <div class="card-body form-grid">
            <div class="field span-2"><label>Nombre comercial <span class="req">*</span></label><input class="input" name="business_name" maxlength="100" value="${esc(s.business_name)}"></div>
            <div class="field"><label>RUC</label><input class="input" name="business_ruc" maxlength="11" inputmode="numeric" value="${esc(s.business_ruc)}" placeholder="20XXXXXXXXX"></div>
            <div class="field"><label>Teléfono</label><input class="input" name="business_phone" maxlength="30" value="${esc(s.business_phone)}"></div>
            <div class="field span-2"><label>Dirección</label><input class="input" name="business_address" maxlength="200" value="${esc(s.business_address)}"></div>
          </div>
        </div>
        <div class="card">
          <div class="card-head"><div><h3>${icon('image')} Logo</h3><div class="hint">Se muestra en el menú, el login y el ticket</div></div></div>
          <div class="card-body">
            <div class="image-drop" id="logoDrop">
              <div class="preview" id="logoPrev">${s.has_logo ? `<img src="${logoUrl()}" alt="">` : icon('image-plus')}</div>
              <div><strong>Subir logo</strong><div class="text-sm text-faint">PNG con fondo transparente recomendado</div></div>
              <input type="file" id="logoFile" accept="image/png,image/jpeg,image/webp" hidden>
            </div>
            <button type="button" class="btn btn-ghost btn-sm mt-3" id="logoRm" ${s.has_logo ? '' : 'hidden'} style="color:var(--danger)">${icon('trash-2')}Quitar logo</button>
          </div>
        </div>
      </div>

      <div class="grid grid-3 mb">
        <div class="card">
          <div class="card-head"><h3>${icon('coins')} Moneda e impuestos</h3></div>
          <div class="card-body form-grid">
            <div class="field"><label>Símbolo</label><input class="input" name="currency_symbol" maxlength="5" value="${esc(s.currency_symbol)}"></div>
            <div class="field"><label>Código</label><input class="input" name="currency_code" maxlength="3" value="${esc(s.currency_code)}"></div>
            <div class="field"><label>Impuesto</label><input class="input" name="tax_name" maxlength="10" value="${esc(s.tax_name)}"></div>
            <div class="field"><label>Tasa (%)</label><input class="input" name="tax_rate" type="number" min="0" max="100" step="0.01" value="${esc(s.tax_rate)}"></div>
            <div class="span-2"><label class="switch"><input type="checkbox" name="tax_included" ${s.tax_included === '1' ? 'checked' : ''}><span class="track"></span><span>Los precios de venta <strong>incluyen</strong> el impuesto</span></label></div>
          </div>
        </div>
        <div class="card">
          <div class="card-head"><h3>${icon('receipt-text')} Ticket de venta</h3></div>
          <div class="card-body form-grid">
            <div class="field"><label>Serie</label><input class="input" name="ticket_series" maxlength="6" value="${esc(s.ticket_series)}"></div>
            <div class="field"><label>Próximo número</label><input class="input" value="${esc(s.ticket_next_number)}" disabled></div>
            <div class="field span-2"><label>Mensaje al pie</label><textarea class="textarea" name="ticket_footer" maxlength="200" style="min-height:64px">${esc(s.ticket_footer)}</textarea></div>
          </div>
        </div>
        <div class="card">
          <div class="card-head"><h3>${icon('package')} Inventario</h3></div>
          <div class="card-body form-grid">
            <div class="field span-2"><label>Avisar vencimientos con (días)</label><input class="input" name="expiry_alert_days" type="number" min="1" max="365" value="${esc(s.expiry_alert_days)}"></div>
            <div class="span-2"><label class="switch"><input type="checkbox" name="allow_negative_stock" ${s.allow_negative_stock === '1' ? 'checked' : ''}><span class="track"></span><span>Permitir vender sin stock</span></label>
              <p class="text-sm text-faint mt-2">Si está desactivado, el sistema no deja vender más de lo que hay.</p></div>
          </div>
        </div>
      </div>
    </form>

    <div class="card">
      <div class="card-head"><div><h3>${icon('database-backup')} Copias de seguridad</h3><div class="hint">Descarga todos los datos (productos, ventas, usuarios, configuración) en un archivo</div></div></div>
      <div class="card-body">
        <div class="grid grid-2-even">
          <div>
            <p class="text-muted mb">Recomendación: descarga una copia <strong>cada semana</strong> y guárdala en otro lugar (USB, Google Drive).</p>
            <button class="btn btn-success" id="backupBtn" data-loading="Generando...">${icon('download')}Descargar copia de seguridad</button>
          </div>
          <div>
            <div class="alert alert-danger mb">${icon('triangle-alert')}<div>Restaurar <strong>reemplaza todos los datos actuales</strong> por los del archivo. Descarga primero una copia de lo actual.</div></div>
            <button class="btn btn-outline" id="restoreBtn" data-loading="Restaurando...">${icon('upload')}Restaurar desde archivo</button>
            <input type="file" id="restoreFile" accept=".json,application/json" hidden>
          </div>
        </div>
      </div>
    </div>`;
  icons();
  animateIn([...root.querySelectorAll('.card')], { y: 12, stagger: 0.05 });

  const form = $('#cfg');
  form.business_ruc.oninput = () => { form.business_ruc.value = form.business_ruc.value.replace(/\D/g, ''); };

  $('#save').onclick = () => withLoading($('#save'), async () => {
    const d = formData(form);
    const errors = check(d, {
      business_name: [req('El nombre del negocio')],
      business_ruc: [(v) => (v && !/^\d{11}$/.test(v) ? 'El RUC debe tener 11 dígitos' : null)],
      currency_symbol: [req('El símbolo')],
      currency_code: [req('El código')],
      tax_name: [req('El nombre del impuesto')],
      tax_rate: [req('La tasa'), (v) => (Number(v) < 0 || Number(v) > 100 ? 'Entre 0 y 100' : null)],
      ticket_series: [req('La serie'), (v) => (!/^[A-Za-z0-9]{1,6}$/.test(v) ? 'Solo letras y números' : null)],
      expiry_alert_days: [req('Los días'), (v) => (Number(v) < 1 || Number(v) > 365 ? 'Entre 1 y 365' : null)],
    });
    if (errors) return showErrors(form, errors);
    try {
      await api.put('/settings', d);
      await loadSettings();
      toast('success', 'Configuración guardada');
      renderShell(); // refresca nombre del negocio en el menú
      window.dispatchEvent(new HashChangeEvent('hashchange')); // vuelve a pintar esta vista
    } catch (err) { if (err.details) showErrors(form, err.details); else toastError(err); }
  });

  // ---- Logo
  const logoFile = $('#logoFile');
  $('#logoDrop').onclick = () => logoFile.click();
  logoFile.onchange = async () => {
    const f = logoFile.files[0];
    if (!f) return;
    try {
      const data = await resizeImage(f, 360, 0.9);
      await api.put('/settings/logo', { image: data });
      await loadSettings();
      $('#logoPrev').innerHTML = `<img src="${data}" alt="">`;
      $('#logoRm').hidden = false;
      toast('success', 'Logo actualizado');
      const mark = document.querySelector('.sidebar-brand .logo-mark');
      if (mark) mark.innerHTML = `<img src="${data}" alt="">`;
    } catch (err) { toastError(err); }
  };
  $('#logoRm').onclick = async () => {
    try {
      await api.del('/settings/logo');
      await loadSettings();
      $('#logoPrev').innerHTML = icon('image-plus');
      $('#logoRm').hidden = true;
      icons();
      toast('success', 'Logo eliminado');
    } catch (err) { toastError(err); }
  };

  // ---- Backup
  $('#backupBtn').onclick = () => withLoading($('#backupBtn'), async () => {
    try {
      const res = await fetch('/api/settings/backup', { headers: { Authorization: `Bearer ${state.token}` } });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'No se pudo generar la copia');
      const blob = await res.blob();
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
      downloadBlob(blob, `backup-inventario-${stamp}.json`);
      toast('success', 'Copia de seguridad descargada', 'Guárdala en un lugar seguro');
    } catch (err) { toastError(err); }
  });

  const restoreFile = $('#restoreFile');
  $('#restoreBtn').onclick = () => restoreFile.click();
  restoreFile.onchange = async () => {
    const f = restoreFile.files[0];
    restoreFile.value = '';
    if (!f) return;
    let backup;
    try {
      backup = JSON.parse(await f.text());
      if (backup.app !== 'inventario-pos') throw new Error('El archivo no es una copia de seguridad de este sistema');
    } catch (err) { return toastError(err, 'Archivo no válido'); }
    const counts = Object.entries(backup.tables || {}).map(([t, rows]) => `${t}: ${rows.length}`).join(', ');
    const ok = await confirmDialog({
      title: '¿Restaurar copia de seguridad?',
      message: `Copia del <strong>${esc(new Date(backup.created_at).toLocaleString('es-PE'))}</strong>.<br><span class="text-sm">${esc(counts)}</span><br><br>Se <strong>borrarán todos los datos actuales</strong>. Deberás iniciar sesión otra vez.`,
      confirmText: 'Sí, restaurar',
    });
    if (!ok) return;
    await withLoading($('#restoreBtn'), async () => {
      try {
        const r = await api.post('/settings/restore', backup);
        toast('success', 'Restauración completa', r.message, 6000);
        setTimeout(() => { clearSession(); location.hash = ''; location.reload(); }, 1500);
      } catch (err) { toastError(err, 'No se pudo restaurar'); }
    });
  };
}
