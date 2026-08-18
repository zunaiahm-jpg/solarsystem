(() => {
  const login = document.getElementById('admin-login');
  const dashboard = document.getElementById('admin-dashboard');
  const rows = document.getElementById('response-rows');
  const status = document.getElementById('admin-status');
  const search = document.getElementById('admin-search');
  let page = 1;
  let debounce;

  function escapeText(value) {
    const span = document.createElement('span');
    span.textContent = value ?? '';
    return span.innerHTML;
  }

  async function loadResponses() {
    status.textContent = 'Receiving transmissions…';
    const params = new URLSearchParams({ page, search: search.value.trim() });
    const response = await fetch(`/api/admin-responses?${params}`);
    if (response.status === 401) {
      login.hidden = false;
      dashboard.hidden = true;
      return;
    }
    const result = await response.json();
    if (!response.ok) { status.textContent = result.error; return; }
    rows.innerHTML = result.rows.length ? result.rows.map(row => `
      <tr><td><strong>${escapeText(row.name)}</strong><a href="mailto:${encodeURIComponent(row.email)}">${escapeText(row.email)}</a></td><td>${escapeText(row.country)}</td><td>${escapeText(row.thoughts)}</td><td>${new Date(row.created_at).toLocaleString()}</td></tr>
    `).join('') : '<tr><td colspan="4">No transmissions found.</td></tr>';
    document.getElementById('admin-page').textContent = `Page ${page}`;
    document.getElementById('admin-prev').disabled = page === 1;
    document.getElementById('admin-next').disabled = !result.hasMore;
    document.getElementById('admin-export').href = `/api/admin-responses?format=csv&search=${encodeURIComponent(search.value.trim())}`;
    status.textContent = `${result.rows.length} transmission${result.rows.length === 1 ? '' : 's'} on this page.`;
  }

  document.getElementById('admin-login-form').addEventListener('submit', async event => {
    event.preventDefault();
    const output = document.getElementById('admin-login-status');
    output.textContent = 'Verifying…';
    const password = new FormData(event.currentTarget).get('password');
    const response = await fetch('/api/admin-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
    const result = await response.json();
    if (!response.ok) { output.textContent = result.error; return; }
    login.hidden = true;
    dashboard.hidden = false;
    loadResponses();
  });
  search.addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(() => { page = 1; loadResponses(); }, 300); });
  document.getElementById('admin-prev').addEventListener('click', () => { if (page > 1) { page -= 1; loadResponses(); } });
  document.getElementById('admin-next').addEventListener('click', () => { page += 1; loadResponses(); });

  loadResponses().then(() => { if (!dashboard.hidden) login.hidden = true; });
})();
