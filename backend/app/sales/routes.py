from flask import request, jsonify, current_app
from app.sales import sales_bp
from app.extensions import db
from app.models import Product, Sale, Debt, AuditLog, Notification, User
from app import cache as app_cache
from app.auth.routes import token_required


@sales_bp.route("", methods=["GET"])
@token_required
def index():
    return _sales_html()


@sales_bp.route("", methods=["POST"])
@token_required
def log_sale():
    user_role = request.user_payload.get('role') if hasattr(request, 'user_payload') else None
    user_id = request.user_payload.get('user_id') if hasattr(request, 'user_payload') else None

    if user_role != 'shopkeeper':
        return jsonify({"error": "Only shopkeepers can record sales"}), 403

    data = request.get_json(silent=True) or {}

    errors = []
    product_id = data.get("product_id")
    quantity_sold = data.get("quantity_sold")
    payment_type = (data.get("payment_type") or "cash").lower()
    amount_paid = data.get("amount_paid", 0)

    try:
        product_id = int(product_id)
        quantity_sold = int(quantity_sold)
        if quantity_sold <= 0:
            raise ValueError
        amount_paid = float(amount_paid) if amount_paid else 0
        if amount_paid < 0:
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

    total_price = round(product_row.selling_price * quantity_sold, 2)
    profit = round((product_row.selling_price - product_row.buying_price) * quantity_sold, 2)

    if payment_type == "debt" and amount_paid > total_price:
        return jsonify({
            "error": f"Amount paid ({amount_paid}) cannot exceed total price ({total_price})."
        }), 400

    try:
        db.session.query(Product).filter(Product.id == product_id).update(
            {"quantity": product_row.quantity - quantity_sold},
            synchronize_session=False,
        )

        sale = Sale(
            product_id=product_id,
            user_id=user_id,
            quantity_sold=quantity_sold,
            unit_price=product_row.selling_price,
            buying_price_at_sale=product_row.buying_price,
            total_price=total_price,
            profit=profit,
            payment_type=payment_type,
        )
        db.session.add(sale)
        db.session.flush()

        if payment_type == "debt":
            remaining_balance = round(total_price - amount_paid, 2)

            debt = Debt(
                sale_id=sale.id,
                customer_name=customer_name,
                customer_phone=customer_phone,
                amount=remaining_balance,
                initial_amount=total_price,
                amount_paid=amount_paid,
            )
            db.session.add(debt)

        db.session.add(AuditLog(
            user_id=user_id,
            action="log_sale",
            details=f"sale_id={sale.id} product_id={product_id} qty={quantity_sold} type={payment_type} amount_paid={amount_paid}",
        ))

        new_qty = product_row.quantity - quantity_sold
        threshold = current_app.config.get("LOW_STOCK_THRESHOLD", 5)
        if new_qty <= threshold:
            admin_users = User.query.filter_by(role='admin').all()
            product_name = product_row.name
            message = f"⚠️ Low stock: {product_name} has only {new_qty} units left!"
            for admin in admin_users:
                db.session.add(Notification(
                    user_id=admin.id,
                    message=message,
                    category="warning",
                ))

        db.session.commit()

    except Exception:
        db.session.rollback()
        current_app.logger.exception("Sale transaction failed")
        return jsonify({"error": "Sale could not be recorded. Please retry."}), 500

    app_cache.invalidate_products()
    app_cache.invalidate_low_stock()

    response_data = {
        "message": "Sale recorded.",
        "sale_id": sale.id,
        "total_price": total_price,
        "profit": profit,
        "stock_remaining": new_qty,
        "payment_type": payment_type,
    }

    if payment_type == "debt":
        response_data["amount_paid"] = amount_paid
        response_data["remaining_balance"] = remaining_balance
        if remaining_balance > 0:
            response_data["message"] = f"Debt recorded. Paid: KSh {amount_paid}, Balance: KSh {remaining_balance}"
        else:
            response_data["message"] = "Debt fully paid."

    return jsonify(response_data), 201


@sales_bp.route("/today", methods=["GET"])
@token_required
def today_sales():
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
        .filter(db.func.date(Sale.timestamp) == date.today())
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


def _sales_html():
    return """<!DOCTYPE html>
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
      <label>Amount Paid (KSh)</label>
      <input type="number" id="amount_paid" value="0" min="0" step="0.01">
    </div>
    <button onclick="recordSale()">Record Sale</button>
    <p id="msg"></p>
  </div>
  <div class="card" style="margin-top:1.5rem; max-width:700px">
    <h2>Today's Sales</h2>
    <table id="sales-table">
      <thead><tr><th>Product</th><th>Qty</th><th>Total</th><th>Profit</th><th>Type</th><th>Time</th></tr></thead>
      <tbody></tbody>
    </table>
  </div>
  <script>
    function toggleDebt() {
      const show = document.getElementById('payment').value === 'debt';
      document.getElementById('debt-fields').style.display = show ? 'block' : 'none';
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
        amount_paid: parseFloat(document.getElementById('amount_paid').value) || 0,
      };
      const res = await fetch('/sales', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        msg.className = 'ok';
        let msgText = `✓ ${data.message}`;
        if (data.remaining_balance !== undefined) {
          msgText += ` | Balance: KSh${data.remaining_balance}`;
        }
        msg.textContent = msgText;
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
</html>""", 200