"""
sales/routes.py – Sales logging (cash or debt).

MOST CRITICAL PERFORMANCE PATH in the entire system.

OPTIMIZATIONS:
1. Single DB transaction for: stock reduction + sale insert + debt insert.
   WHY: avoids partial writes if a step fails; only ONE commit round-trip.
2. Product fetched with only required fields (id, quantity, prices).
3. Active day fetched with only id + is_closed.
4. No ORM object loaded for stock update – raw UPDATE used.
5. Cache invalidated only after successful commit.
"""

from flask import request, jsonify, current_app
from flask_login import login_required, current_user
from sqlalchemy import func

from app.sales import sales_bp
from app.extensions import db
from app.models import Product, Sale, Debt, Day, AuditLog, Notification, User
from app import cache as app_cache


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_open_day():
    """Fetch (id,) of today's open day. Returns None if none open."""
    from datetime import date
    return (
        db.session.query(Day.id)
        .filter(Day.date == date.today(), Day.is_closed == False)  # noqa: E712
        .first()
    )


# ---------------------------------------------------------------------------
# GET /sales  – shopkeeper landing page (HTML)
# ---------------------------------------------------------------------------
@sales_bp.route("", methods=["GET"])
@login_required
def index():
    """Simple HTML sales dashboard – served once, JS handles the rest."""
    return _sales_html()


# ---------------------------------------------------------------------------
# POST /sales  – log a sale (cash or debt)
# ---------------------------------------------------------------------------
@sales_bp.route("", methods=["POST"])
@login_required
def log_sale():
    """
    POST /sales
    Body: {
      "product_id": int,
      "quantity_sold": int,
      "payment_type": "cash" | "debt",
      "customer_name": str,   # required if debt
      "customer_phone": str,  # required if debt
    }

    All DB writes happen in ONE transaction:
      1. Validate stock
      2. Reduce product.quantity  (UPDATE, no ORM load)
      3. Insert Sale row
      4. Insert Debt row (if debt)
      5. Insert AuditLog row
      6. Insert low-stock Notification (if needed)
    """
    # --- ROLE CHECK: Only shopkeepers can record sales ---
    if current_user.role != 'shopkeeper':
        return jsonify({"error": "Only shopkeepers can record sales"}), 403

    data = request.get_json(silent=True) or {}

    # --- Input validation (before any DB hit) ---
    errors = []
    product_id = data.get("product_id")
    quantity_sold = data.get("quantity_sold")
    payment_type = (data.get("payment_type") or "cash").lower()

    try:
        product_id = int(product_id)
        quantity_sold = int(quantity_sold)
        if quantity_sold <= 0:
            raise ValueError
    except (TypeError, ValueError):
        errors.append("product_id and quantity_sold must be positive integers.")

    if payment_type not in ("cash", "debt"):
        errors.append("payment_type must be 'cash' or 'debt'.")

    if payment_type == "debt":
        customer_name = (data.get("customer_name") or "").strip()
        customer_phone = (data.get("customer_phone") or "").strip()
        if not customer_name or not customer_phone:
            errors.append("customer_name and customer_phone required for debt sales.")
    else:
        customer_name = customer_phone = ""

    if errors:
        return jsonify({"errors": errors}), 400

    # --- Fetch only what we need from product ---
    product_row = (
        db.session.query(
            Product.id,
            Product.quantity,
            Product.selling_price,
            Product.buying_price,
            Product.name,
        )
        .filter(Product.id == product_id)
        .first()
    )
    if not product_row:
        return jsonify({"error": "Product not found."}), 404

    if product_row.quantity < quantity_sold:
        return jsonify({
            "error": f"Insufficient stock. Available: {product_row.quantity}."
        }), 409

    # --- Fetch open day ---
    day_row = _get_open_day()
    if not day_row:
        return jsonify({"error": "No open day. Please open a day first."}), 409

    day_id = day_row.id

    # --- Compute financials ---
    total_price = round(product_row.selling_price * quantity_sold, 2)
    profit = round((product_row.selling_price - product_row.buying_price) * quantity_sold, 2)

    # --- Single transaction: all writes together ---
    try:
        # 1. Reduce stock (raw UPDATE – fastest possible)
        db.session.query(Product).filter(Product.id == product_id).update(
            {"quantity": product_row.quantity - quantity_sold},
            synchronize_session=False,
        )

        # 2. Insert sale
        sale = Sale(
            product_id=product_id,
            user_id=current_user.id,
            day_id=day_id,
            quantity_sold=quantity_sold,
            unit_price=product_row.selling_price,
            buying_price_at_sale=product_row.buying_price,
            total_price=total_price,
            profit=profit,
            payment_type=payment_type,
        )
        db.session.add(sale)
        db.session.flush()  # populate sale.id for debt FK

        # 3. Insert debt record (if needed)
        if payment_type == "debt":
            debt = Debt(
                sale_id=sale.id,
                customer_name=customer_name,
                customer_phone=customer_phone,
                amount=total_price,
            )
            db.session.add(debt)

        # 4. Audit log
        db.session.add(AuditLog(
            user_id=current_user.id,
            action="log_sale",
            details=f"sale_id={sale.id} product_id={product_id} qty={quantity_sold} type={payment_type}",
        ))

        # 5. Low-stock notification (send to all admins)
        new_qty = product_row.quantity - quantity_sold
        from flask import current_app
        threshold = current_app.config.get("LOW_STOCK_THRESHOLD", 5)
        if new_qty <= threshold:
            admin_users = User.query.filter_by(role='admin').all()
            product_name = product_row.name
            message = (
                f"📦 LOW STOCK ALERT!\n"
                f"Product: {product_name}\n"
                f"Current stock: {new_qty}\n"
                f"Threshold: {threshold}\n"
                f"Please restock soon!"
            )
            for admin in admin_users:
                db.session.add(Notification(
                    user_id=admin.id,
                    message=message,
                    category="warning",
                ))
            # Also add system-wide notification
            db.session.add(Notification(
                user_id=None,
                message=f"⚠️ Low stock: {product_name} has only {new_qty} units left!",
                category="warning",
            ))

        db.session.commit()

    except Exception:
        db.session.rollback()
        current_app.logger.exception("Sale transaction failed")
        return jsonify({"error": "Sale could not be recorded. Please retry."}), 500

    # Invalidate caches after successful commit
    app_cache.invalidate_products()
    app_cache.invalidate_low_stock()

    return jsonify({
        "message": "Sale recorded.",
        "sale_id": sale.id,
        "total_price": total_price,
        "profit": profit,
        "stock_remaining": new_qty,
    }), 201


# ---------------------------------------------------------------------------
# GET /sales/today  – all sales for the open day
# ---------------------------------------------------------------------------
@sales_bp.route("/today", methods=["GET"])
@login_required
def today_sales():
    """
    Returns today's sales joined with product name.
    WHY join: avoids N+1 queries (one query per sale to get product name).
    """
    from datetime import date
    from app.models import Product as Prod

    rows = (
        db.session.query(
            Sale.id,
            Sale.quantity_sold,
            Sale.unit_price,
            Sale.total_price,
            Sale.profit,
            Sale.payment_type,
            Sale.timestamp,
            Prod.name.label("product_name"),
        )
        .join(Prod, Sale.product_id == Prod.id)
        .join(Day, Sale.day_id == Day.id)
        .filter(Day.date == date.today())
        .order_by(Sale.timestamp.desc())
        .limit(500)
        .all()
    )

    return jsonify([
        {
            "id": r.id,
            "product_name": r.product_name,
            "quantity_sold": r.quantity_sold,
            "unit_price": r.unit_price,
            "total_price": r.total_price,
            "profit": r.profit,
            "payment_type": r.payment_type,
            "timestamp": r.timestamp.isoformat(),
        }
        for r in rows
    ]), 200


# ---------------------------------------------------------------------------
# Minimal HTML sales page
# ---------------------------------------------------------------------------
def _sales_html():
    return """
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Record Sale</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: #f0f2f5; padding: 1.5rem; }
    h2 { margin-bottom: 1.25rem; color: #1e3a5f; }
    .card { background: #fff; padding: 1.5rem; border-radius: 10px;
            box-shadow: 0 2px 12px rgba(0,0,0,.08); max-width: 520px; margin: auto; }
    label { display: block; font-size: .85rem; margin: .6rem 0 .2rem; color: #555; }
    select, input { width: 100%; padding: .55rem .8rem; border: 1px solid #ddd;
                    border-radius: 6px; font-size: .95rem; }
    button { margin-top: 1rem; width: 100%; padding: .7rem;
             background: #16a34a; color: #fff; border: none;
             border-radius: 6px; font-size: 1rem; cursor: pointer; }
    button:hover { background: #15803d; }
    #msg { margin-top: .75rem; font-size: .9rem; text-align: center; }
    .ok { color: #16a34a; } .err { color: #dc2626; }
    #debt-fields { display: none; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; font-size: .85rem; }
    th, td { padding: .4rem .6rem; border-bottom: 1px solid #e5e7eb; text-align: left; }
    th { background: #f8fafc; }
  </style>
</head>
<body>
  <div class="card">
    <h2>🛒 Record Sale</h2>
    <label>Product</label>
    <select id="product"></select>
    <label>Qty to sell</label>
    <input type="number" id="qty" value="1" min="1">
    <label>Payment</label>
    <select id="payment" onchange="toggleDebt()">
      <option value="cash">Cash</option>
      <option value="debt">Debt</option>
    </select>
    <div id="debt-fields">
      <label>Customer Name</label>
      <input type="text" id="cname">
      <label>Customer Phone</label>
      <input type="text" id="cphone">
    </div>
    <button onclick="recordSale()">Record Sale</button>
    <p id="msg"></p>
  </div>
  <div class="card" style="margin-top:1.5rem; max-width:700px">
    <h2>Today's Sales</h2>
    <table id="sales-table">
      <thead><td><th>Product</th><th>Qty</th><th>Total</th><th>Profit</th><th>Type</th><th>Time</th></tr>
      </thead>
      <tbody></tbody>
    </table>
  </div>
  <script>
    function toggleDebt() {
      document.getElementById('debt-fields').style.display =
        document.getElementById('payment').value === 'debt' ? 'block' : 'none';
    }
    async function loadProducts() {
      const res = await fetch('/products');
      const products = await res.json();
      const sel = document.getElementById('product');
      sel.innerHTML = products.map(p =>
        `<option value="${p.id}">${p.name} (qty: ${p.quantity}) @ KSh${p.selling_price}</option>`
      ).join('');
    }
    async function loadTodaySales() {
      const res = await fetch('/sales/today');
      const sales = await res.json();
      const tbody = document.querySelector('#sales-table tbody');
      tbody.innerHTML = sales.map(s =>
        `<tr><td>${s.product_name}</td><td>${s.quantity_sold}</td>
          <td>KSh${s.total_price}</td><td>KSh${s.profit}</td>
          <td>${s.payment_type}</td><td>${s.timestamp.substring(11,16)}</td></tr>`
      ).join('') || '<tr><td colspan="6" style="color:#888">No sales yet today.</td></tr>';
    }
    let lastSubmit = 0;
    async function recordSale() {
      const now = Date.now();
      if (now - lastSubmit < 1500) return;
      lastSubmit = now;
      const msg = document.getElementById('msg');
      msg.textContent = '';
      const body = {
        product_id: parseInt(document.getElementById('product').value),
        quantity_sold: parseInt(document.getElementById('qty').value),
        payment_type: document.getElementById('payment').value,
        customer_name: document.getElementById('cname').value,
        customer_phone: document.getElementById('cphone').value,
      };
      const res = await fetch('/sales', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        msg.className = 'ok';
        msg.textContent = `✓ Sale recorded. Total: KSh${data.total_price}, Profit: KSh${data.profit}`;
        loadProducts();
        loadTodaySales();
      } else {
        msg.className = 'err';
        msg.textContent = data.error || (data.errors || []).join(' ');
      }
    }
    loadProducts();
    loadTodaySales();
  </script>
</body>
</html>
""", 200