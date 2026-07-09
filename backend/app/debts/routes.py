from datetime import datetime
from flask import request, jsonify

from app.debts import debts_bp
from app.extensions import db
from app.models import Debt, Sale, Product, AuditLog
from app.auth.routes import token_required


@debts_bp.route("", methods=["GET"])
@token_required
def list_debts():
    include_paid = request.args.get("paid", "0") == "1"

    query = (
        db.session.query(
            Debt.id,
            Debt.customer_name,
            Debt.customer_phone,
            Debt.amount,
            Debt.initial_amount,
            Debt.amount_paid,
            Debt.is_paid,
            Debt.created_at,
            Debt.paid_at,
            Product.name.label("product_name"),
            Sale.quantity_sold,
        )
        .join(Sale, Debt.sale_id == Sale.id)
        .join(Product, Sale.product_id == Product.id)
    )

    if not include_paid:
        query = query.filter(Debt.is_paid == False)

    rows = query.order_by(Debt.created_at.desc()).limit(200).all()

    return jsonify([
        {
            "id": r.id,
            "customer_name": r.customer_name,
            "customer_phone": r.customer_phone,
            "amount": r.amount,
            "initial_amount": r.initial_amount if r.initial_amount is not None else r.amount,
            "amount_paid": r.amount_paid if r.amount_paid is not None else 0,
            "is_paid": r.is_paid,
            "product_name": r.product_name,
            "quantity_sold": r.quantity_sold,
            "created_at": r.created_at.isoformat(),
            "paid_at": r.paid_at.isoformat() if r.paid_at else None,
        }
        for r in rows
    ]), 200


@debts_bp.route("/<int:debt_id>/pay", methods=["POST"])
@token_required
def mark_paid(debt_id):
    user_role = request.user_payload.get('role') if hasattr(request, 'user_payload') else None
    user_id = request.user_payload.get('user_id') if hasattr(request, 'user_payload') else None

    if user_role != 'shopkeeper':
        return jsonify({"error": "Only shopkeepers can collect payments"}), 403

    row = db.session.query(Debt.id, Debt.is_paid).filter(Debt.id == debt_id).first()
    if not row:
        return jsonify({"error": "Debt not found."}), 404
    if row.is_paid:
        return jsonify({"error": "Debt is already marked as paid."}), 409

    now = datetime.utcnow()
    db.session.query(Debt).filter(Debt.id == debt_id).update(
        {"is_paid": True, "paid_at": now, "amount": 0},
        synchronize_session=False,
    )
    db.session.add(AuditLog(
        user_id=user_id,
        action="mark_debt_paid",
        details=f"debt_id={debt_id}",
    ))
    db.session.commit()

    return jsonify({"message": "Debt marked as paid.", "paid_at": now.isoformat()}), 200


@debts_bp.route("/<int:debt_id>/partial-pay", methods=["POST"])
@token_required
def partial_pay_debt(debt_id):
    user_role = request.user_payload.get('role') if hasattr(request, 'user_payload') else None
    user_id = request.user_payload.get('user_id') if hasattr(request, 'user_payload') else None

    if user_role != 'shopkeeper':
        return jsonify({"error": "Only shopkeepers can collect payments"}), 403

    data = request.get_json(silent=True) or {}
    amount_paid = data.get("amount_paid", 0)

    try:
        amount_paid = float(amount_paid)
        if amount_paid <= 0:
            raise ValueError
    except (TypeError, ValueError):
        return jsonify({"error": "amount_paid must be a positive number."}), 400

    debt = db.session.query(Debt).filter(Debt.id == debt_id).first()
    if not debt:
        return jsonify({"error": "Debt not found."}), 404

    if debt.is_paid:
        return jsonify({"error": "Debt is already fully paid."}), 409

    if amount_paid > debt.amount:
        return jsonify({
            "error": f"Amount paid ({amount_paid}) exceeds remaining balance ({debt.amount})."
        }), 400

    now = datetime.utcnow()
    new_balance = round(debt.amount - amount_paid, 2)
    current_paid = debt.amount_paid if debt.amount_paid is not None else 0
    new_total_paid = current_paid + amount_paid

    if new_balance == 0:
        debt.is_paid = True
        debt.paid_at = now

    debt.amount = new_balance
    debt.amount_paid = new_total_paid

    db.session.add(AuditLog(
        user_id=user_id,
        action="partial_debt_payment",
        details=f"debt_id={debt_id} amount_paid={amount_paid} new_balance={new_balance}",
    ))
    db.session.commit()

    return jsonify({
        "message": "Partial payment recorded.",
        "debt_id": debt_id,
        "amount_paid": amount_paid,
        "remaining_balance": new_balance,
        "total_paid": new_total_paid,
        "is_paid": debt.is_paid,
        "paid_at": debt.paid_at.isoformat() if debt.paid_at else None,
    }), 200


@debts_bp.route("/summary", methods=["GET"])
@token_required
def debt_summary():
    from sqlalchemy import func
    total = db.session.query(
        func.sum(Debt.amount)
    ).filter(Debt.is_paid == False).scalar() or 0.0

    count = db.session.query(
        func.count(Debt.id)
    ).filter(Debt.is_paid == False).scalar() or 0

    return jsonify({
        "outstanding_amount": round(total, 2),
        "outstanding_count": count,
    }), 200