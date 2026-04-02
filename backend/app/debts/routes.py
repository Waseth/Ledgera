"""
debts/routes.py – Debt tracking.

OPTIMIZATIONS:
- List query joins Sale + Product to avoid N+1 lookups.
- Mark-paid uses a targeted UPDATE (no full object load).
- Filter on is_paid index → fast lookup.
"""

from datetime import datetime
from flask import request, jsonify
from flask_login import login_required, current_user

from app.debts import debts_bp
from app.extensions import db
from app.models import Debt, Sale, Product, AuditLog


# ---------------------------------------------------------------------------
# GET /debts  – list unpaid debts (default) or all
# ---------------------------------------------------------------------------
@debts_bp.route("", methods=["GET"])
@token_required
def list_debts():
    """
    ?paid=1  → include paid debts
    Joins Sale and Product to return product name in one query.
    """
    include_paid = request.args.get("paid", "0") == "1"

    query = (
        db.session.query(
            Debt.id,
            Debt.customer_name,
            Debt.customer_phone,
            Debt.amount,
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
        query = query.filter(Debt.is_paid == False)  # noqa: E712

    rows = query.order_by(Debt.created_at.desc()).limit(200).all()

    return jsonify([
        {
            "id": r.id,
            "customer_name": r.customer_name,
            "customer_phone": r.customer_phone,
            "amount": r.amount,
            "is_paid": r.is_paid,
            "product_name": r.product_name,
            "quantity_sold": r.quantity_sold,
            "created_at": r.created_at.isoformat(),
            "paid_at": r.paid_at.isoformat() if r.paid_at else None,
        }
        for r in rows
    ]), 200


# ---------------------------------------------------------------------------
# POST /debts/<id>/pay  – mark a debt as paid
# ---------------------------------------------------------------------------
@debts_bp.route("/<int:debt_id>/pay", methods=["POST"])
@token_required
def mark_paid(debt_id):
    """
    Anti-theft rule: debts can only be marked paid, never deleted.
    Uses targeted UPDATE to avoid loading the full ORM object.
    """
    # --- ROLE CHECK: Only shopkeepers can collect payments ---
    if current_user.role != 'shopkeeper':
        return jsonify({"error": "Only shopkeepers can collect payments"}), 403

    # Verify debt exists and is unpaid (fetch only id + is_paid)
    row = db.session.query(Debt.id, Debt.is_paid).filter(Debt.id == debt_id).first()
    if not row:
        return jsonify({"error": "Debt not found."}), 404
    if row.is_paid:
        return jsonify({"error": "Debt is already marked as paid."}), 409

    now = datetime.utcnow()
    db.session.query(Debt).filter(Debt.id == debt_id).update(
        {"is_paid": True, "paid_at": now},
        synchronize_session=False,
    )
    db.session.add(AuditLog(
        user_id=current_user.id,
        action="mark_debt_paid",
        details=f"debt_id={debt_id}",
    ))
    db.session.commit()

    return jsonify({"message": "Debt marked as paid.", "paid_at": now.isoformat()}), 200


# ---------------------------------------------------------------------------
# GET /debts/summary  – total outstanding debt amount
# ---------------------------------------------------------------------------
@debts_bp.route("/summary", methods=["GET"])
@token_required
def debt_summary():
    """
    Uses SUM aggregation – only one DB row returned regardless of debt count.
    WHY: avoids loading all debt rows into Python memory just to sum them.
    """
    from sqlalchemy import func
    total = db.session.query(
        func.sum(Debt.amount)
    ).filter(Debt.is_paid == False).scalar() or 0.0  # noqa: E712

    count = db.session.query(
        func.count(Debt.id)
    ).filter(Debt.is_paid == False).scalar() or 0  # noqa: E712

    return jsonify({
        "outstanding_amount": round(total, 2),
        "outstanding_count": count,
    }), 200