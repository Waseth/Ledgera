"""
days/routes.py – Daily opening and closing system.

STRICT RULES (anti-theft):
- Only one open day at a time.
- A closed day cannot be reopened.
- No edits or deletes are allowed.
- Mismatch (actual_cash vs expected_cash) is always recorded.
- All closing actions are audit-logged.

OPTIMIZATIONS:
- Aggregation queries for expected_cash (SUM, not Python loop).
- Only required columns fetched.
"""

from datetime import date, datetime
from flask import request, jsonify
from flask_login import login_required, current_user
from sqlalchemy import func

from app.days import days_bp
from app.extensions import db
from app.models import Day, Sale, Expense, AuditLog, Notification, User


# ---------------------------------------------------------------------------
# POST /days/open  – open a new business day
# ---------------------------------------------------------------------------
@days_bp.route("/open", methods=["POST"])
@login_required
def open_day():
    """
    Opens today's day. Fails if:
    - A day is already open.
    - Today's day already exists (was closed and cannot reopen).
    """
    # --- ROLE CHECK: Only shopkeepers can open days ---
    if current_user.role != 'shopkeeper':
        return jsonify({"error": "Only shopkeepers can open the day"}), 403

    today = date.today()

    # Check for existing day (only fetch id + is_closed)
    existing = (
        db.session.query(Day.id, Day.is_closed)
        .filter(Day.date == today)
        .first()
    )
    if existing:
        if not existing.is_closed:
            return jsonify({"error": "A day is already open for today."}), 409
        return jsonify({"error": "Today's day was already closed and cannot be reopened."}), 409

    data = request.get_json(silent=True) or {}
    try:
        opening_cash = float(data.get("opening_cash", 0))
        if opening_cash < 0:
            raise ValueError
    except (TypeError, ValueError):
        return jsonify({"error": "opening_cash must be a non-negative number."}), 400

    day = Day(
        date=today,
        opening_cash=opening_cash,
        expected_cash=opening_cash,  # starts equal; sales add to this
        opened_by=current_user.id,
    )
    db.session.add(day)
    db.session.flush()

    db.session.add(AuditLog(
        user_id=current_user.id,
        action="open_day",
        details=f"day_id={day.id} opening_cash={opening_cash}",
    ))
    db.session.commit()

    return jsonify({
        "message": "Day opened.",
        "day_id": day.id,
        "date": today.isoformat(),
        "opening_cash": opening_cash,
    }), 201


# ---------------------------------------------------------------------------
# POST /days/close  – close the current open day
# ---------------------------------------------------------------------------
@days_bp.route("/close", methods=["POST"])
@login_required
def close_day():
    """
    Closes today's open day.
    1. Calculates expected_cash = opening_cash + cash_sales - expenses
    2. Records actual_cash (from request body)
    3. Records mismatch = actual - expected
    4. Locks the day (is_closed = True)

    WHY aggregation queries: SUM in SQL is done at DB level, no Python loop.
    """
    # --- ROLE CHECK: Only shopkeepers can close days ---
    if current_user.role != 'shopkeeper':
        return jsonify({"error": "Only shopkeepers can close the day"}), 403

    today = date.today()
    day_row = (
        db.session.query(Day.id, Day.opening_cash, Day.is_closed)
        .filter(Day.date == today)
        .first()
    )
    if not day_row:
        return jsonify({"error": "No day found for today."}), 404
    if day_row.is_closed:
        return jsonify({"error": "Today's day is already closed."}), 409

    data = request.get_json(silent=True) or {}
    try:
        actual_cash = float(data.get("actual_cash"))
        if actual_cash < 0:
            raise ValueError
    except (TypeError, ValueError):
        return jsonify({"error": "actual_cash must be a non-negative number."}), 400

    day_id = day_row.id

    # --- Aggregation queries (no Python loops) ---
    cash_sales_total = db.session.query(
        func.coalesce(func.sum(Sale.total_price), 0.0)
    ).filter(
        Sale.day_id == day_id,
        Sale.payment_type == "cash",
    ).scalar()

    expenses_total = db.session.query(
        func.coalesce(func.sum(Expense.amount), 0.0)
    ).filter(Expense.day_id == day_id).scalar()

    expected_cash = round(day_row.opening_cash + cash_sales_total - expenses_total, 2)
    mismatch = round(actual_cash - expected_cash, 2)

    now = datetime.utcnow()

    # Update day
    db.session.query(Day).filter(Day.id == day_id).update(
        {
            "expected_cash": expected_cash,
            "actual_cash": actual_cash,
            "mismatch": mismatch,
            "is_closed": True,
            "closed_at": now,
        },
        synchronize_session=False,
    )

    # Audit log
    db.session.add(AuditLog(
        user_id=current_user.id,
        action="close_day",
        details=(
            f"day_id={day_id} expected={expected_cash} "
            f"actual={actual_cash} mismatch={mismatch}"
        ),
    ))

    # --- Mismatch notification (send to all admins) ---
    if mismatch != 0:
        admin_users = User.query.filter_by(role='admin').all()
        category = "danger" if abs(mismatch) > 100 else "warning"
        message = (
            f"💰 CASH MISMATCH on {today}!\n"
            f"Expected: KSh {expected_cash:,.2f}\n"
            f"Actual: KSh {actual_cash:,.2f}\n"
            f"Difference: KSh {mismatch:+,.2f}\n"
            f"Day ID: {day_id}"
        )

        for admin in admin_users:
            db.session.add(Notification(
                user_id=admin.id,
                message=message,
                category=category,
            ))

        # Also add a system-wide notification for shopkeepers to see
        db.session.add(Notification(
            user_id=None,
            message=f"⚠️ Cash mismatch of KSh {abs(mismatch):,.2f} recorded. Please check.",
            category="warning",
        ))

    db.session.commit()

    return jsonify({
        "message": "Day closed.",
        "day_id": day_id,
        "date": today.isoformat(),
        "opening_cash": day_row.opening_cash,
        "cash_sales": cash_sales_total,
        "expenses": expenses_total,
        "expected_cash": expected_cash,
        "actual_cash": actual_cash,
        "mismatch": mismatch,
    }), 200


# ---------------------------------------------------------------------------
# POST /days/<day_id>/expenses  – add an expense for a day
# ---------------------------------------------------------------------------
@days_bp.route("/<int:day_id>/expenses", methods=["POST"])
@login_required
def add_expense(day_id):
    # --- ROLE CHECK: Only shopkeepers can add expenses ---
    if current_user.role != 'shopkeeper':
        return jsonify({"error": "Only shopkeepers can add expenses"}), 403

    # Verify day is open
    day_row = db.session.query(Day.id, Day.is_closed).filter(Day.id == day_id).first()
    if not day_row:
        return jsonify({"error": "Day not found."}), 404
    if day_row.is_closed:
        return jsonify({"error": "Cannot add expenses to a closed day."}), 409

    data = request.get_json(silent=True) or {}
    description = (data.get("description") or "").strip()
    try:
        amount = float(data.get("amount"))
        if amount <= 0:
            raise ValueError
    except (TypeError, ValueError):
        return jsonify({"error": "amount must be a positive number."}), 400
    if not description:
        return jsonify({"error": "description is required."}), 400

    from app.models import Expense
    exp = Expense(
        day_id=day_id,
        user_id=current_user.id,
        description=description,
        amount=amount,
    )
    db.session.add(exp)
    db.session.add(AuditLog(
        user_id=current_user.id,
        action="add_expense",
        details=f"day_id={day_id} amount={amount} desc={description[:50]}",
    ))
    db.session.commit()

    return jsonify({"message": "Expense recorded.", "amount": amount}), 201


# ---------------------------------------------------------------------------
# GET /days/status  – current day status
# ---------------------------------------------------------------------------
@days_bp.route("/status", methods=["GET"])
@login_required
def day_status():
    today = date.today()
    row = db.session.query(
        Day.id, Day.date, Day.opening_cash, Day.is_closed,
        Day.expected_cash, Day.actual_cash, Day.mismatch,
    ).filter(Day.date == today).first()

    if not row:
        return jsonify({"status": "no_day", "date": today.isoformat()}), 200

    return jsonify({
        "status": "closed" if row.is_closed else "open",
        "day_id": row.id,
        "date": row.date.isoformat(),
        "opening_cash": row.opening_cash,
        "is_closed": row.is_closed,
        "expected_cash": row.expected_cash,
        "actual_cash": row.actual_cash,
        "mismatch": row.mismatch,
    }), 200