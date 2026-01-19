const SECTION_ROUTES = {
  'new-reservation': 'reservation-form.html',
  office: 'my-office.html',
  accounts: 'accounts.html',
  quotes: 'quotes.html',
  calendar: 'calendar.html',
  reservations: 'reservations-list.html',
  dispatch: 'dispatch-grid.html',
  network: 'network.html',
  settle: 'settle.html',
  receivables: 'receivables.html',
  payables: 'payables.html',
  memos: 'memos.html',
  files: 'files.html',
  tools: 'tools.html',
  reports: 'reports.html'
};

export function getRouteForSection(section) {
  return SECTION_ROUTES[section] || null;
}

export function navigateToSection(section) {
  if (window.self !== window.top) {
    window.parent.postMessage({
      action: 'switchSection',
      section
    }, '*');
    return true;
  }

  const route = getRouteForSection(section);
  if (!route) {
    alert(`${section} section not available`);
    return false;
  }

  const currentPath = (window.location.pathname || '').toLowerCase();
  if (currentPath.endsWith(`/${route}`.toLowerCase()) || currentPath.endsWith(`\\${route}`.toLowerCase())) {
    window.location.reload();
    return true;
  }

  window.location.href = route;
  return true;
}

export function wireMainNav(root = document) {
  const buttons = root.querySelectorAll('.nav-btn[data-section]');
  buttons.forEach(btn => {
    if (btn.dataset.navWired === '1') return;
    btn.dataset.navWired = '1';

    btn.addEventListener('click', (e) => {
      const target = e.target;
      const button = target instanceof Element ? target.closest('.nav-btn') : null;
      const section = button?.dataset?.section;
      if (!section) return;
      navigateToSection(section);
    });
  });
}
