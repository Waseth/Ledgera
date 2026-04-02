"""
products/routes.py – Stock management.

OPTIMIZATIONS:
- GET list uses cache (avoids DB hit on every page load).
- Add/restock uses a single UPDATE instead of load → modify → save.
- Cache is invalidated after any write.
- Only required columns fetched (never SELECT *).
- Input validation before touching the DB.
"""

from flask import request, jsonify

from app.products import products_bp
from app.extensions import db
from app.models import Product, AuditLog
from app import cache as app_cache
from app.auth.routes import token_required


# ---------------------------------------------------------------------------
# GET /products  – list all products
# ---------------------------------------------------------------------------
@products_bp.route("", methods=["GET"])
@token_required
def list_products():
    """
    Returns cached product list.
    """
    rows = app_cache.get_cached_products()
    return jsonify([
        {
            "id": r.id,
            "name": r.name,
            "buying_price": r.buying_price,
            "selling_price": r.selling_price,
            "quantity": r.quantity,
            "unit": r.unit,
        }
        for r in rows
    ]), 200


# ---------------------------------------------------------------------------
# GET /products/<id>  – single product
# ---------------------------------------------------------------------------
@products_bp.route("/<int:product_id>", methods=["GET"])
@token_required
def get_product(product_id):
    row = db.session.query(
        Product.id, Product.name, Product.buying_price,
        Product.selling_price, Product.quantity, Product.unit,
        Product.created_at, Product.updated_at,
    ).filter(Product.id == product_id).first()

    if not row:
        return jsonify({"error": "Product not found."}), 404

    return jsonify({
        "id": row.id, "name": row.name,
        "buying_price": row.buying_price, "selling_price": row.selling_price,
        "quantity": row.quantity, "unit": row.unit,
        "created_at": row.created_at.isoformat(),
        "updated_at": row.updated_at.isoformat(),
    }), 200


# ---------------------------------------------------------------------------
# POST /products  – add new OR restock existing (ADMIN ONLY)
# ---------------------------------------------------------------------------
@products_bp.route("", methods=["POST"])
@token_required
def add_or_restock():
    """
    If a product with the same name exists → increase quantity (restock).
    Otherwise → create new product.
    """
    # --- ROLE CHECK: Only admin can add or restock products ---
    user_role = request.user_payload.get('role') if hasattr(request, 'user_payload') else None
    user_id = request.user_payload.get('user_id') if hasattr(request, 'user_payload') else None

    if user_role != 'admin':
        return jsonify({"error": "Only admin can add or restock products"}), 403

    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    quantity = data.get("quantity")
    buying_price = data.get("buying_price")
    selling_price = data.get("selling_price")
    unit = (data.get("unit") or "piece").strip()

    # --- Validation ---
    errors = []
    if not name:
        errors.append("name is required.")
    try:
        quantity = int(quantity)
        if quantity < 0:
            raise ValueError
    except (TypeError, ValueError):
        errors.append("quantity must be a non-negative integer.")
    try:
        buying_price = float(buying_price)
        selling_price = float(selling_price)
        if buying_price < 0 or selling_price < 0:
            raise ValueError
    except (TypeError, ValueError):
        errors.append("buying_price and selling_price must be non-negative numbers.")

    if errors:
        return jsonify({"errors": errors}), 400

    # --- Check existing ---
    existing = (
        db.session.query(Product.id, Product.quantity)
        .filter(Product.name == name)
        .first()
    )

    if existing:
        db.session.query(Product).filter(Product.id == existing.id).update(
            {
                "quantity": existing.quantity + quantity,
                "buying_price": buying_price,
                "selling_price": selling_price,
            },
            synchronize_session=False,
        )
        action = "restock"
        product_id = existing.id
        msg = f"Restocked '{name}' (+{quantity}). New qty: {existing.quantity + quantity}."
    else:
        product = Product(
            name=name,
            quantity=quantity,
            buying_price=buying_price,
            selling_price=selling_price,
            unit=unit,
        )
        db.session.add(product)
        db.session.flush()
        product_id = product.id
        action = "add_product"
        msg = f"Added new product '{name}'."

    log = AuditLog(
        user_id=user_id,
        action=action,
        details=f"product_id={product_id} qty={quantity}",
    )
    db.session.add(log)
    db.session.commit()

    app_cache.invalidate_products()
    app_cache.invalidate_low_stock()

    return jsonify({"message": msg, "product_id": product_id}), 200


# ---------------------------------------------------------------------------
# GET /products/low-stock  – items at or below threshold
# ---------------------------------------------------------------------------
@products_bp.route("/low-stock", methods=["GET"])
@token_required
def low_stock():
    """
    Returns cached low-stock list.
    """
    rows = app_cache.get_low_stock()
    return jsonify([
        {"id": r.id, "name": r.name, "quantity": r.quantity}
        for r in rows
    ]), 200