"""
products/routes.py – Stock management.
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
# PUT /products/<id>  – update product (ADMIN ONLY)
# ---------------------------------------------------------------------------
@products_bp.route("/<int:product_id>", methods=["PUT"])
@token_required
def update_product(product_id):
    user_role = request.user_payload.get('role') if hasattr(request, 'user_payload') else None
    user_id = request.user_payload.get('user_id') if hasattr(request, 'user_payload') else None

    if user_role != 'admin':
        return jsonify({"error": "Only admin can update products"}), 403

    product = Product.query.get(product_id)
    if not product:
        return jsonify({"error": "Product not found."}), 404

    data = request.get_json(silent=True) or {}

    if 'name' in data:
        product.name = data['name'].strip()
    if 'buying_price' in data:
        product.buying_price = float(data['buying_price'])
    if 'selling_price' in data:
        product.selling_price = float(data['selling_price'])
    if 'quantity' in data:
        product.quantity = int(data['quantity'])
    if 'unit' in data:
        product.unit = data['unit'].strip()

    db.session.add(AuditLog(
        user_id=user_id,
        action="update_product",
        details=f"product_id={product_id}",
    ))
    db.session.commit()

    app_cache.invalidate_products()
    app_cache.invalidate_low_stock()

    return jsonify({
        "message": "Product updated successfully.",
        "product": {
            "id": product.id,
            "name": product.name,
            "buying_price": product.buying_price,
            "selling_price": product.selling_price,
            "quantity": product.quantity,
            "unit": product.unit,
        }
    }), 200


# ---------------------------------------------------------------------------
# DELETE /products/<id>  – delete a product (ADMIN ONLY)
# ---------------------------------------------------------------------------
@products_bp.route("/<int:product_id>", methods=["DELETE"])
@token_required
def delete_product(product_id):
    """
    Delete a product (admin only).
    Only allowed if product has no sales history.
    """
    user_role = request.user_payload.get('role') if hasattr(request, 'user_payload') else None
    user_id = request.user_payload.get('user_id') if hasattr(request, 'user_payload') else None

    if user_role != 'admin':
        return jsonify({"error": "Only admin can delete products"}), 403

    product = Product.query.get(product_id)
    if not product:
        return jsonify({"error": "Product not found."}), 404

    if product.sales.count() > 0:
        return jsonify({"error": "Cannot delete product with sales history."}), 400

    db.session.delete(product)

    db.session.add(AuditLog(
        user_id=user_id,
        action="delete_product",
        details=f"product_id={product_id} name={product.name}",
    ))
    db.session.commit()

    app_cache.invalidate_products()
    app_cache.invalidate_low_stock()

    return jsonify({"message": f"Product '{product.name}' deleted successfully."}), 200


# ---------------------------------------------------------------------------
# POST /products/<id>/archive  – archive product (ADMIN ONLY)
# ---------------------------------------------------------------------------
@products_bp.route("/<int:product_id>/archive", methods=["POST"])
@token_required
def archive_product(product_id):
    """
    Archive a product (admin only).
    Archived products are hidden from UI but keep sales history.
    """
    user_role = request.user_payload.get('role') if hasattr(request, 'user_payload') else None
    user_id = request.user_payload.get('user_id') if hasattr(request, 'user_payload') else None

    if user_role != 'admin':
        return jsonify({"error": "Only admin can archive products"}), 403

    product = Product.query.get(product_id)
    if not product:
        return jsonify({"error": "Product not found."}), 404

    product.is_active = False
    product.quantity = 0

    db.session.add(AuditLog(
        user_id=user_id,
        action="archive_product",
        details=f"product_id={product_id} name={product.name}",
    ))
    db.session.commit()

    app_cache.invalidate_products()
    app_cache.invalidate_low_stock()

    return jsonify({"message": f"Product '{product.name}' has been archived."}), 200


# ---------------------------------------------------------------------------
# POST /products  – add new OR restock existing (ADMIN ONLY)
# ---------------------------------------------------------------------------
@products_bp.route("", methods=["POST"])
@token_required
def add_or_restock():
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
    rows = app_cache.get_low_stock()
    return jsonify([
        {"id": r.id, "name": r.name, "quantity": r.quantity}
        for r in rows
    ]), 200