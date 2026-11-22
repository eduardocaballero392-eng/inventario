/**
 * Estado global de la sesión: token, usuario y configuración del negocio.
 */
const store = {
  get(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* modo privado */ }
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch { /* noop */ }
  },
};

export const state = {
  token: store.get('token'),
  user: store.get('user'),
  settings: null,
};

export function setSession(token, user) {
  state.token = token;
  state.user = user;
  store.set('token', token);
  store.set('user', user);
}

export function clearSession() {
  state.token = null;
  state.user = null;
  store.remove('token');
  store.remove('user');
}

export const ROLE_LABELS = { admin: 'Administrador', cajero: 'Cajero', almacenero: 'Almacenero' };

/**
 * Permisos del frontend (el backend valida lo mismo; esto solo oculta lo que no corresponde).
 */
const PERMS = {
  'products.write': ['admin', 'almacenero'],
  'products.delete': ['admin'],
  'products.cost': ['admin', 'almacenero'],
  'stock.write': ['admin', 'almacenero'],
  'sales.cancel': ['admin'],
  'suppliers.write': ['admin', 'almacenero'],
  'suppliers.delete': ['admin'],
  'categories.delete': ['admin'],
};

export function can(perm) {
  return Boolean(state.user && PERMS[perm] && PERMS[perm].includes(state.user.role));
}

export { store };
