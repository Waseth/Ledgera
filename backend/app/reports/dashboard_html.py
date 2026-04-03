"""
Standalone admin dashboard page – attached to reports_bp.
All data fetched via JS from /reports/dashboard in ONE request.
No polling – user clicks Refresh.
"""

ADMIN_DASHBOARD_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Admin Dashboard</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: #f0f2f5; color: #1a1a2e; }

    /* NAV */
    nav { background: #1e3a5f; color: #fff; padding: .75rem 1.5rem;
          display: flex; align-items: center; justify-content: space-between; }
    nav h1 { font-size: 1.1rem; }
    nav a  { color: #93c5fd; text-decoration: none; font-size: .9rem; margin-left: 1rem; }
    nav a:hover { color: #fff; }

    /* GRID */
    .grid { display: grid; gap: 1rem; padding: 1.5rem;
            grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); }
    .card { background: #fff; border-radius: 10px; padding: 1.25rem;
            box-shadow: 0 2px 10px rgba(0,0,0,.07); }
    .card h3 { font-size: .8rem; color: #6b7280; text-transform: uppercase;
               letter-spacing: .05em; margin-bottom: .5rem; }
    .card .value { font-size: 1.7rem; font-weight: 700; color: #1e3a5f; }
    .card .sub   { font-size: .8rem; color: #9ca3af; margin-top: .2rem; }

    .card.danger  .value { color: #dc2626; }
    .card.success .value { color: #16a34a; }
    .card.warn    .value { color: #d97706; }

    /* SECTION */
    .section { padding: 0 1.5rem 1.5rem; }
    .section h2 { font-size: 1rem; margin-bottom: .75rem; color: #1e3a5f; }

    /* BUTTONS */
    .btn-row { display: flex; gap: .75rem; flex-wrap: wrap;
               padding: .75rem 1.5rem; }
    button { padding: .5rem 1.1rem; border: none; border-radius: 6px;
             cursor: pointer; font-size: .9rem; font-weight: 500; }
    .btn-primary { background: #2563eb; color: #fff; }
    .btn-primary:hover { background: #1d4ed8; }
    .btn-success { background: #16a34a; color: #fff; }
    .btn-success:hover { background: #15803d; }
    .btn-danger  { background: #dc2626; color: #fff; }
    .btn-danger:hover  { background: #b91c1c; }
    .btn-neutral { background: #e5e7eb; color: #374151; }
    .btn-neutral:hover { background: #d1d5db; }

    /* TABLE */
    table { width: 100%; border-collapse: collapse; font-size: .88rem; }
    th, td { padding: .5rem .75rem; border-bottom: 1px solid #e5e7eb; text-align: left; }
    th { background: #f8fafc; font-weight: 600; }
    tr:hover td { background: #f0f9ff; }

    /* NOTIFICATIONS */
    .notif { padding: .5rem .9rem; border-radius: 6px; margin-bottom: .4rem;
             font-size: .88rem; display: flex; justify-content: space-between; }
    .notif.info    { background: #dbeafe; color: #1e40af; }
    .notif.warning { background: #fef9c3; color: #92400e; }
    .notif.danger  { background: #fee2e2; color: #991b1b; }

    #notif-badge { background: #dc2626; color: #fff; border-radius: 999px;
                   padding: 1px 7px; font-size: .75rem; margin-left: .3rem; }

    /* MODAL */
    .overlay { display: none; position: fixed; inset: 0;
               background: rgba(0,0,0,.4); z-index: 100;
               align-items: center; justify-content: center; }
    .overlay.show { display: flex; }
    .modal { background: #fff; border-radius: 10px; padding: 1.5rem;
             width: 100%; max-width: 420px; }
    .modal h3 { margin-bottom: 1rem; }
    .modal label { display: block; font-size: .85rem; margin: .5rem 0 .2rem; color: #555; }
    .modal input, .modal select {
      width: 100%; padding: .5rem .75rem; border: 1px solid #ddd;
      border-radius: 6px; font-size: .95rem; margin-bottom: .1rem; }
    .modal .row { display: flex; gap: .5rem; margin-top: .75rem; }
    .modal .row button { flex: 1; }
    #modal-msg { font-size: .85rem; margin-top: .5rem; text-align: center; color: #dc2626; }

    .spinner { display: inline-block; width: 14px; height: 14px;
               border: 2px solid #ccc; border-top-color: #2563eb;
               border-radius: 50%; animation: spin .6s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>

<!-- NAV -->
<nav>
  <h1>🛒 Shop Admin</h1>
  <div>
    <a href="/sales">Sales</a>
    <a href="/reports/weekly-page">Weekly</a>
    <a href="/reports/monthly-page">Monthly</a>
    <span id="notif-badge" style="display:none"></span>
    <a href="#" onclick="openNotifModal()">🔔 Alerts</a>
    <a href="#" onclick="doLogout()" style="color:#fca5a5">Logout</a>
  </div>
</nav>

<!-- KPI CARDS -->
<div class="grid" id="kpi-grid">
  <div class="card"><h3>Loading…</h3><div class="value"><span class="spinner"></span></div></div>
</div>

<!-- ACTION BUTTONS -->
<div class="btn-row">
  <button class="btn-success" onclick="openDayModal('open')">📅 Open Day</button>
  <button class="btn-danger"  onclick="openDayModal('close')">🔒 Close Day</button>
  <button class="btn-primary" onclick="openProductModal()">➕ Add / Restock Product</button>
  <button class="btn-neutral" onclick="loadDashboard()">🔄 Refresh</button>
</div>

<!-- TODAY'S SALES TABLE -->
<div class="section">
  <h2>Today's Sales</h2>
  <table id="sales-table">
    <thead><tr>
      <th>Product</th><th>Qty</th><th>Total (KSh)</th>
      <th>Profit (KSh)</th><th>Type</th><th>Time</th>
    </tr></thead>
    <tbody><tr><td colspan="6" style="color:#9ca3af">Loading…</td></tr></tbody>
  </table>
</div>

<!-- UNPAID DEBTS -->
<div class="section">
  <h2>Unpaid Debts</h2>
  <table id="debts-table">
    <thead><tr>
      <th>Customer</th><th>Phone</th><th>Product</th>
      <th>Amount (KSh)</th><th>Date</th><th>Action</th>
    </tr></thead>
    <tbody><tr><td colspan="6" style="color:#9ca3af">Loading…</td></tr></tbody>
  </table>
</div>

<!-- ==================== MODALS ==================== -->

<!-- Day Modal -->
<div class="overlay" id="day-overlay">
  <div class="modal">
    <h3 id="day-modal-title">Open Day</h3>
    <label id="cash-label">Opening Cash (KSh)</label>
    <input type="number" id="day-cash" min="0" value="0">
    <div class="row">
      <button class="btn-primary" onclick="submitDay()">Confirm</button>
      <button class="btn-neutral" onclick="closeModal('day-overlay')">Cancel</button>
    </div>
    <p id="day-msg" style="font-size:.85rem;margin-top:.5rem;text-align:center;color:#dc2626"></p>
  </div>
</div>

<!-- Product Modal -->
<div class="overlay" id="product-overlay">
  <div class="modal">
    <h3>Add / Restock Product</h3>
    <label>Name</label><input type="text" id="p-name">
    <label>Qty</label><input type="number" id="p-qty" min="1" value="1">
    <label>Buying Price (KSh)</label><input type="number" id="p-buy" min="0">
    <label>Selling Price (KSh)</label><input type="number" id="p-sell" min="0">
    <label>Unit</label>
    <select id="p-unit">
      <option>piece</option><option>kg</option><option>litre</option>
      <option>packet</option><option>box</option>
    </select>
    <div class="row">
      <button class="btn-success" onclick="submitProduct()">Save</button>
      <button class="btn-neutral" onclick="closeModal('product-overlay')">Cancel</button>
    </div>
    <p id="product-msg" style="font-size:.85rem;margin-top:.5rem;text-align:center;color:#dc2626"></p>
  </div>
</div>

<!-- Notifications Modal -->
<div class="overlay" id="notif-overlay">
  <div class="modal" style="max-width:500px">
    <h3>🔔 Notifications</h3>
    <div id="notif-list" style="margin-top:.75rem;max-height:340px;overflow-y:auto"></div>
    <div class="row">
      <button class="btn-primary" onclick="markAllRead()">Mark All Read</button>
      <button class="btn-neutral" onclick="closeModal('notif-overlay')">Close</button>
    </div>
  </div>
</div>

<!-- ==================== SCRIPTS ==================== -->
<script>
// ---- Utilities ----
const fmt = n => Number(n).toLocaleString('en-KE', {minimumFractionDigits:2, maximumFractionDigits:2});
function closeModal(id) { document.getElementById(id).classList.remove('show'); }
function openModal(id)  { document.getElementById(id).classList.add('show'); }

// ---- Dashboard KPIs ----
async function loadDashboard() {
  const res = await fetch('/reports/dashboard');
  if (!res.ok) return;
  const d = await res.json();
  document.getElementById('kpi-grid').innerHTML = `
    <div class="card success"><h3>Today Revenue</h3><div class="value">KSh ${fmt(d.today.revenue)}</div><div class="sub">${d.today.sale_count} sales</div></div>
    <div class="card success"><h3>Today Net Profit</h3><div class="value">KSh ${fmt(d.today.net_profit)}</div><div class="sub">After KSh ${fmt(d.today.expenses)} expenses</div></div>
    <div class="card"><h3>Week Revenue</h3><div class="value">KSh ${fmt(d.week.revenue)}</div><div class="sub">${d.week.sale_count} sales (7 days)</div></div>
    <div class="card"><h3>Week Net Profit</h3><div class="value">KSh ${fmt(d.week.net_profit)}</div></div>
    <div class="card ${d.outstanding_debt > 0 ? 'warn' : ''}"><h3>Outstanding Debt</h3><div class="value">KSh ${fmt(d.outstanding_debt)}</div></div>
    <div class="card ${d.low_stock_count > 0 ? 'danger' : ''}"><h3>Low Stock Items</h3><div class="value">${d.low_stock_count}</div><div class="sub">At or below threshold</div></div>
  `;
  loadNotifBadge();
}

// ---- Today's Sales ----
async function loadTodaySales() {
  const res = await fetch('/sales/today');
  const sales = await res.json();
  const tbody = document.querySelector('#sales-table tbody');
  if (!sales.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="color:#9ca3af;padding:.75rem">No sales today yet.</td></tr>';
    return;
  }
  tbody.innerHTML = sales.map(s => `
    <tr>
      <td>${s.product_name}</td>
      <td>${s.quantity_sold}</td>
      <td>${fmt(s.total_price)}</td>
      <td>${fmt(s.profit)}</td>
      <td><span style="background:${s.payment_type==='cash'?'#dcfce7':'#fef9c3'};padding:2px 8px;border-radius:4px;font-size:.8rem">${s.payment_type}</span></td>
      <td>${s.timestamp.substring(11,16)}</td>
    </tr>`).join('');
}

// ---- Unpaid Debts ----
async function loadDebts() {
  const res = await fetch('/debts');
  const debts = await res.json();
  const tbody = document.querySelector('#debts-table tbody');
  if (!debts.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="color:#9ca3af;padding:.75rem">No unpaid debts.</td></tr>';
    return;
  }
  tbody.innerHTML = debts.map(d => `
    <tr>
      <td>${d.customer_name}</td>
      <td>${d.customer_phone}</td>
      <td>${d.product_name}</td>
      <td>${fmt(d.amount)}</td>
      <td>${d.created_at.substring(0,10)}</td>
      <td><button class="btn-success" style="padding:.3rem .7rem;font-size:.8rem" onclick="markPaid(${d.id})">Paid ✓</button></td>
    </tr>`).join('');
}

async function markPaid(id) {
  if (!confirm('Mark this debt as paid?')) return;
  const res = await fetch(`/debts/${id}/pay`, {method:'POST'});
  const data = await res.json();
  if (res.ok) loadDebts();
  else alert(data.error || 'Failed');
}

// ---- Day Modal ----
let dayAction = 'open';
function openDayModal(action) {
  dayAction = action;
  document.getElementById('day-modal-title').textContent = action === 'open' ? 'Open Day' : 'Close Day';
  document.getElementById('cash-label').textContent = action === 'open' ? 'Opening Cash (KSh)' : 'Actual Cash in Drawer (KSh)';
  document.getElementById('day-cash').value = '0';
  document.getElementById('day-msg').textContent = '';
  openModal('day-overlay');
}

async function submitDay() {
  const cash = parseFloat(document.getElementById('day-cash').value);
  const endpoint = dayAction === 'open' ? '/days/open' : '/days/close';
  const bodyKey  = dayAction === 'open' ? 'opening_cash' : 'actual_cash';
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({[bodyKey]: cash})
  });
  const data = await res.json();
  if (res.ok) {
    closeModal('day-overlay');
    if (dayAction === 'close' && data.mismatch !== 0) {
      alert(` Mismatch detected!\nExpected: KSh${fmt(data.expected_cash)}\nActual:   KSh${fmt(data.actual_cash)}\nDiff:     KSh${fmt(data.mismatch)}`);
    }
    loadDashboard();
  } else {
    document.getElementById('day-msg').textContent = data.error || 'Failed.';
  }
}

// ---- Product Modal ----
function openProductModal() {
  ['p-name','p-buy','p-sell'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('p-qty').value = '1';
  document.getElementById('product-msg').textContent = '';
  openModal('product-overlay');
}

async function submitProduct() {
  const body = {
    name: document.getElementById('p-name').value.trim(),
    quantity: parseInt(document.getElementById('p-qty').value),
    buying_price: parseFloat(document.getElementById('p-buy').value),
    selling_price: parseFloat(document.getElementById('p-sell').value),
    unit: document.getElementById('p-unit').value,
  };
  const res = await fetch('/products', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (res.ok) {
    closeModal('product-overlay');
    loadDashboard();
  } else {
    document.getElementById('product-msg').textContent =
      (data.errors || [data.error]).join(' ');
  }
}

// ---- Notifications ----
async function loadNotifBadge() {
  const res = await fetch('/notifications/count');
  const data = await res.json();
  const badge = document.getElementById('notif-badge');
  if (data.unread > 0) {
    badge.textContent = data.unread;
    badge.style.display = 'inline';
  } else {
    badge.style.display = 'none';
  }
}

async function openNotifModal() {
  openModal('notif-overlay');
  const res = await fetch('/notifications');
  const notifs = await res.json();
  const el = document.getElementById('notif-list');
  if (!notifs.length) {
    el.innerHTML = '<p style="color:#9ca3af;text-align:center;padding:.5rem">No unread notifications.</p>';
    return;
  }
  el.innerHTML = notifs.map(n =>
    `<div class="notif ${n.category}">
       <span>${n.message}</span>
       <small style="opacity:.6;white-space:nowrap;margin-left:.5rem">${n.created_at.substring(0,10)}</small>
     </div>`
  ).join('');
}

async function markAllRead() {
  await fetch('/notifications/read', {method:'POST', headers:{'Content-Type':'application/json'}, body:'{}'});
  document.getElementById('notif-list').innerHTML =
    '<p style="color:#9ca3af;text-align:center;padding:.5rem">All caught up ✓</p>';
  loadNotifBadge();
}

// ---- Logout ----
async function doLogout() {
  if (!confirm('Log out?')) return;
  const res = await fetch('/auth/logout', {method:'POST'});
  const data = await res.json();
  window.location.href = data.redirect || '/auth/login';
}

// ---- Init ----
loadDashboard();
loadTodaySales();
loadDebts();
</script>
</body>
</html>
"""