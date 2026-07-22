from datetime import datetime, timedelta
from flask import request, jsonify, current_app
from app.sales import sales_bp
from app.extensions import db
from app.models import Product, Sale, Debt, AuditLog, Notification, User, DebtCollection
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
            is_reversed=False,  
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
            db.session.flush()

            if amount_paid > 0:
                collection = DebtCollection(
                    debt_id=debt.id,
                    user_id=user_id,
                    amount=amount_paid,
                    collected_at=datetime.utcnow()
                )
                db.session.add(collection)

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
            message = f" Low stock: {product_name} has only {new_qty} units left!"
            for admin in admin_users:
                db.session.add(Notification(
                    user_id=admin.id,
                    message=message,
                    category="warning",
                ))

        db.session.commit()

    except Exception as e:
        db.session.rollback()
        current_app.logger.exception(f"Sale transaction failed: {str(e)}")
        return jsonify({"error": f"Sale could not be recorded. Please retry."}), 500

    app_cache.invalidate_products()
    app_cache.invalidate_low_stock()

    response_data = {
        "message": "Sale recorded.",
        "sale_id": sale.id,
        "total_price": total_price,
        "profit": profit,
        "stock_remaining": new_qty,
        "payment_type": payment_type,
        "can_undo": True,
        "undo_window_seconds": 120,
    }

    if payment_type == "debt":
        response_data["amount_paid"] = amount_paid
        response_data["remaining_balance"] = remaining_balance
        if remaining_balance > 0:
            response_data["message"] = f"Debt recorded. Paid: KSh {amount_paid}, Balance: KSh {remaining_balance}"
        else:
            response_data["message"] = "Debt fully paid."

    return jsonify(response_data), 201


@sales_bp.route("/<int:sale_id>/reverse", methods=["POST"])
@token_required
def reverse_sale(sale_id):
    """
    Reverse a sale within 2 minutes of creation.
    Body: { "reason": "optional reason for reversal" }
    """
    user_role = request.user_payload.get('role') if hasattr(request, 'user_payload') else None
    user_id = request.user_payload.get('user_id') if hasattr(request, 'user_payload') else None

    if user_role != 'shopkeeper':
        return jsonify({"error": "Only shopkeepers can reverse sales"}), 403

    data = request.get_json(silent=True) or {}
    reason = data.get("reason", "").strip()

    # Get the sale
    sale = Sale.query.filter_by(id=sale_id, is_reversed=False).first()
    if not sale:
        return jsonify({"error": "Sale not found or already reversed."}), 404

    time_diff = datetime.utcnow() - sale.timestamp
    if time_diff.total_seconds() > 120:
        return jsonify({
            "error": f"Cannot reverse sale after 2 minutes. {int(time_diff.total_seconds())} seconds elapsed."
        }), 400

    try:
        product = Product.query.get(sale.product_id)
        if product:
            product.quantity += sale.quantity_sold
            db.session.add(product)

        if sale.payment_type == 'debt':
            debt = Debt.query.filter_by(sale_id=sale.id).first()
            if debt:
                # Delete associated collections
                DebtCollection.query.filter_by(debt_id=debt.id).delete()
                db.session.delete(debt)

        sale.is_reversed = True
        sale.reversed_at = datetime.utcnow()
        sale.reversed_by = user_id
        sale.reversal_reason = reason or "No reason provided"

        db.session.add(AuditLog(
            user_id=user_id,
            action="reverse_sale",
            details=f"sale_id={sale.id} product_id={sale.product_id} qty={sale.quantity_sold} reason={reason}",
        ))

        db.session.commit()

    except Exception as e:
        db.session.rollback()
        current_app.logger.exception(f"Sale reversal failed: {str(e)}")
        return jsonify({"error": "Sale could not be reversed. Please try again."}), 500

    app_cache.invalidate_products()
    app_cache.invalidate_low_stock()

    return jsonify({
        "message": "Sale reversed successfully.",
        "sale_id": sale.id,
        "product_restored": product.quantity if product else 0,
        "reversed_at": sale.reversed_at.isoformat(),
    }), 200


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
            Sale.is_reversed,
            Prod.name.label("product_name"),
        )
        .join(Prod, Sale.product_id == Prod.id)
        .filter(
            db.func.date(Sale.timestamp) == date.today(),
            Sale.is_reversed == False
        )
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
            "is_reversed": r.is_reversed,
            "can_undo": (datetime.utcnow() - r.timestamp).total_seconds() <= 120 and not r.is_reversed,
            "undo_remaining": max(0, 120 - int((datetime.utcnow() - r.timestamp).total_seconds())),
        }
        for r in rows
    ]), 200