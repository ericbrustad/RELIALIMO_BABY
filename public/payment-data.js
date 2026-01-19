const STORAGE_KEYS = {
  PAYMENT_METHODS: 'relia_payment_methods',
  PAYMENT_GATEWAYS: 'relia_payment_gateways',
  DEFAULT_GATEWAY: 'relia_default_payment_gateway'
};

function safeParseJson(raw, fallback) {
  try {
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function toCode(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/[^A-Z0-9_]/g, '');
}

export function getPaymentMethods({ includeInactive = false } = {}) {
  const stored = safeParseJson(localStorage.getItem(STORAGE_KEYS.PAYMENT_METHODS), null);
  const methods = Array.isArray(stored) ? stored : [];

  const seeded = methods.length ? methods : seedPaymentMethods();
  const normalized = seeded
    .map(m => {
      const code = m.code || toCode(m.name);
      return {
        subtype: (m.subtype || 'OTHER').toString(),
        code: code,
        name: (m.name || code).toString(),
        active: m.active !== false
      };
    });

  const unique = new Map();
  normalized.forEach(m => {
    if (!m.code) return;
    if (!unique.has(m.code)) unique.set(m.code, m);
  });

  const result = Array.from(unique.values());
  return includeInactive ? result : result.filter(m => m.active);
}

export function setPaymentMethods(methods) {
  const list = Array.isArray(methods) ? methods : [];
  localStorage.setItem(STORAGE_KEYS.PAYMENT_METHODS, JSON.stringify(list));
}

export function seedPaymentMethods() {
  const defaults = [
    { subtype: 'CC', code: 'CREDIT_CARD', name: 'Credit Card', active: true },
    { subtype: 'CASH', code: 'CASH', name: 'Cash', active: true },
    { subtype: 'CHECK', code: 'CHECK', name: 'Check', active: true },
    { subtype: 'ACCOUNT', code: 'ACCOUNT', name: 'Account', active: true },
    { subtype: 'VOUCHER', code: 'VOUCHER', name: 'Voucher', active: true }
  ];
  setPaymentMethods(defaults);
  return defaults;
}

export function syncPaymentMethodsFromOfficeTable(tableRoot = document) {
  const tbody = tableRoot.querySelector('.payment-methods-table tbody');
  if (!tbody) return getPaymentMethods({ includeInactive: true });

  const rows = Array.from(tbody.querySelectorAll('tr'));
  const methods = rows
    .map(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length < 4) return null;

      const subtype = cells[0]?.textContent?.trim() || 'OTHER';
      const code = toCode(cells[1]?.textContent);
      const name = cells[2]?.textContent?.trim() || code;
      const select = cells[3]?.querySelector('select');
      const active = (select?.value || 'active') === 'active';

      if (!code) return null;
      return { subtype, code, name, active };
    })
    .filter(Boolean);

  if (methods.length) setPaymentMethods(methods);
  return methods;
}

export function getPaymentGateways({ includeInactive = false } = {}) {
  const stored = safeParseJson(localStorage.getItem(STORAGE_KEYS.PAYMENT_GATEWAYS), null);
  const gateways = Array.isArray(stored) ? stored : [];

  const seeded = gateways.length ? gateways : seedPaymentGateways();

  const normalized = seeded
    .map(g => {
      const id = g.id || toCode(g.name);
      return { id, name: (g.name || id).toString(), active: g.active !== false };
    });

  const unique = new Map();
  normalized.forEach(g => {
    if (!g.id) return;
    if (!unique.has(g.id)) unique.set(g.id, g);
  });

  const result = Array.from(unique.values());
  return includeInactive ? result : result.filter(g => g.active);
}

export function setPaymentGateways(gateways) {
  const list = Array.isArray(gateways) ? gateways : [];
  localStorage.setItem(STORAGE_KEYS.PAYMENT_GATEWAYS, JSON.stringify(list));
}

export function seedPaymentGateways() {
  const defaults = [
    { id: 'ROAM', name: 'Roam', active: true },
    { id: 'NMI', name: 'NMI', active: true },
    { id: 'AUTHORIZE_NET', name: 'Authorize.Net', active: true }
  ];
  setPaymentGateways(defaults);
  // Default to ROAM if not set
  if (!localStorage.getItem(STORAGE_KEYS.DEFAULT_GATEWAY)) {
    localStorage.setItem(STORAGE_KEYS.DEFAULT_GATEWAY, 'ROAM');
  }
  return defaults;
}

export function syncPaymentGatewaysFromOfficeSection(sectionRoot = document) {
  const tbody = sectionRoot.querySelector('#payment-section .payment-gateway-table tbody');
  const existing = getPaymentGateways({ includeInactive: true });

  if (!tbody) return existing;

  const rows = Array.from(tbody.querySelectorAll('tr'));
  const fromTable = rows
    .map(row => {
      const name = row.querySelector('td')?.textContent?.trim();
      if (!name) return null;
      return { id: toCode(name), name, active: true };
    })
    .filter(Boolean);

  const merged = [...existing];
  fromTable.forEach(g => {
    if (!merged.some(x => x.id === g.id)) merged.push(g);
  });

  if (merged.length) setPaymentGateways(merged);
  return merged;
}

export function getDefaultPaymentGatewayId() {
  const id = (localStorage.getItem(STORAGE_KEYS.DEFAULT_GATEWAY) || '').toString().trim();
  if (id) return id;
  // Ensure a default exists
  seedPaymentGateways();
  return (localStorage.getItem(STORAGE_KEYS.DEFAULT_GATEWAY) || 'ROAM').toString();
}

export function setDefaultPaymentGatewayId(id) {
  const next = toCode(id);
  if (!next) return;
  localStorage.setItem(STORAGE_KEYS.DEFAULT_GATEWAY, next);
}

export function maskCardNumber(cardNumber) {
  const digits = String(cardNumber || '').replace(/\D/g, '');
  if (digits.length < 4) return '';
  return `•••• •••• •••• ${digits.slice(-4)}`;
}

export function getCardLast4(cardNumber) {
  const digits = String(cardNumber || '').replace(/\D/g, '');
  if (digits.length < 4) return '';
  return digits.slice(-4);
}

export function normalizeExp(value) {
  const raw = String(value || '').trim();
  const m = raw.match(/^(\d{1,2})\s*\/\s*(\d{2,4})$/);
  if (!m) return { expMonth: '', expYear: '' };
  const month = m[1].padStart(2, '0');
  let year = m[2];
  if (year.length === 2) year = `20${year}`;
  return { expMonth: month, expYear: year };
}
