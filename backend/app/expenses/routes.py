from flask import request, jsonify
from datetime import date, datetime
from app.expenses import expenses_bp
from app.extensions import db
from app.models import Expense, AuditLog
from app.auth.routes import token_required


# ---------------------------------------------------------------------------
# GET /expenses – list expenses for a date range
# ---------------------------------------------------------------------------
@expenses_bp.route("", methods=["GET"])
@token_required
def list_expenses():
    """
    Get expenses for a date range.
    Query params: start=YYYY-MM-DD, end=YYYY-MM-DD (default: today)
    """
    start_str = request.args.get("start")
    end_str = request.args.get("end")

    try:
        if start_str:
            start = date.fromisoformat(start_str)
        else:
            start = date.today()

        if end_str:
            end = date.fromisoformat(end_str)
        else:
            end = date.today()
    except ValueError:
        return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400

    expenses = Expense.query.filter(
        db.func.date(Expense.timestamp) >= start,
        db.func.date(Expense.timestamp) <= end
    ).order_by(Expense.timestamp.desc()).all()

    return jsonify([
        {
            "id": e.id,
            "description": e.description,
            "amount": e.amount,
            "category": e.category,
            "timestamp": e.timestamp.isoformat(),
            "user_id": e.user_id
        }
        for e in expenses
    ]), 200


# ---------------------------------------------------------------------------
# GET /expenses/categories – list all expense categories
# ---------------------------------------------------------------------------
@expenses_bp.route("/categories", methods=["GET"])
@token_required
def get_categories():
    """Get list of available expense categories."""
    categories = ['transport', 'wifi', 'database_hosting', 'rent', 'electricity', 'other']
    return jsonify(categories), 200


# ---------------------------------------------------------------------------
# POST /expenses – add a new expense
# ---------------------------------------------------------------------------
@expenses_bp.route("", methods=["POST"])
@token_required
def add_expense():
    """
    Add a new expense.
    Body: { "description": str, "amount": float, "category": str }
    """
    user_role = request.user_payload.get('role') if hasattr(request, 'user_payload') else None
    user_id = request.user_payload.get('user_id') if hasattr(request, 'user_payload') else None

    # Only admin and shopkeeper can add expenses
    if user_role not in ['admin', 'shopkeeper']:
        return jsonify({"error": "Unauthorized"}), 403

    data = request.get_json(silent=True) or {}

    description = (data.get("description") or "").strip()
    amount = data.get("amount")
    category = (data.get("category") or "other").strip()

    if not description:
        return jsonify({"error": "Description is required"}), 400

    try:
        amount = float(amount)
        if amount <= 0:
            raise ValueError
    except (TypeError, ValueError):
        return jsonify({"error": "Amount must be a positive number"}), 400

    # Validate category
    valid_categories = ['transport', 'wifi', 'database_hosting', 'rent', 'electricity', 'other']
    if category not in valid_categories:
        category = 'other'

    expense = Expense(
        user_id=user_id,
        description=description,
        amount=amount,
        category=category
    )
    db.session.add(expense)

    db.session.add(AuditLog(
        user_id=user_id,
        action="add_expense",
        details=f"Added expense: {description} - KSh {amount} ({category})"
    ))
    db.session.commit()

    return jsonify({
        "message": "Expense added successfully",
        "expense": {
            "id": expense.id,
            "description": expense.description,
            "amount": expense.amount,
            "category": expense.category,
            "timestamp": expense.timestamp.isoformat()
        }
    }), 201


# ---------------------------------------------------------------------------
# DELETE /expenses/<id> – delete an expense (admin only)
# ---------------------------------------------------------------------------
@expenses_bp.route("/<int:expense_id>", methods=["DELETE"])
@token_required
def delete_expense(expense_id):
    """Delete an expense (admin only)."""
    user_role = request.user_payload.get('role') if hasattr(request, 'user_payload') else None
    user_id = request.user_payload.get('user_id') if hasattr(request, 'user_payload') else None

    if user_role != 'admin':
        return jsonify({"error": "Only admin can delete expenses"}), 403

    expense = Expense.query.get(expense_id)
    if not expense:
        return jsonify({"error": "Expense not found"}), 404

    db.session.delete(expense)

    db.session.add(AuditLog(
        user_id=user_id,
        action="delete_expense",
        details=f"Deleted expense ID {expense_id}: {expense.description}"
    ))
    db.session.commit()

    return jsonify({"message": "Expense deleted successfully"}), 200