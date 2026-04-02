"""
notifications/routes.py – Notification fetch and mark-read.
"""

from flask import request, jsonify
from sqlalchemy import func, or_

from app.notifications import notifications_bp
from app.extensions import db
from app.models import Notification
from app.auth.routes import token_required


# ---------------------------------------------------------------------------
# GET /notifications
# ---------------------------------------------------------------------------
@notifications_bp.route("", methods=["GET"])
@token_required
def list_notifications():
    user_id = request.user_payload.get('user_id') if hasattr(request, 'user_payload') else None
    include_read = request.args.get("all", "0") == "1"

    query = db.session.query(
        Notification.id,
        Notification.message,
        Notification.category,
        Notification.is_read,
        Notification.created_at,
    ).filter(
        or_(
            Notification.user_id == user_id,
            Notification.user_id == None,
        )
    )

    if not include_read:
        query = query.filter(Notification.is_read == False)

    rows = query.order_by(Notification.created_at.desc()).limit(20).all()

    return jsonify([
        {
            "id": r.id,
            "message": r.message,
            "category": r.category,
            "is_read": r.is_read,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]), 200


# ---------------------------------------------------------------------------
# POST /notifications/read
# ---------------------------------------------------------------------------
@notifications_bp.route("/read", methods=["POST"])
@token_required
def mark_read():
    user_id = request.user_payload.get('user_id') if hasattr(request, 'user_payload') else None
    data = request.get_json(silent=True) or {}
    ids = data.get("ids")

    query = db.session.query(Notification).filter(
        or_(
            Notification.user_id == user_id,
            Notification.user_id == None,
        ),
        Notification.is_read == False,
    )

    if ids and isinstance(ids, list):
        query = query.filter(Notification.id.in_(ids))

    updated = query.update({"is_read": True}, synchronize_session=False)
    db.session.commit()

    return jsonify({"message": f"{updated} notification(s) marked as read."}), 200


# ---------------------------------------------------------------------------
# GET /notifications/count
# ---------------------------------------------------------------------------
@notifications_bp.route("/count", methods=["GET"])
@token_required
def unread_count():
    user_id = request.user_payload.get('user_id') if hasattr(request, 'user_payload') else None

    count = db.session.query(func.count(Notification.id)).filter(
        or_(
            Notification.user_id == user_id,
            Notification.user_id == None,
        ),
        Notification.is_read == False,
    ).scalar() or 0

    return jsonify({"unread": count}), 200