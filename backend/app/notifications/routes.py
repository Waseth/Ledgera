"""
notifications/routes.py – Notification fetch and mark-read.

OPTIMIZATIONS:
- Only unread notifications fetched by default (index on user_id + is_read).
- LIMIT 20 – no unbounded queries.
- Mark-read uses bulk UPDATE, not per-row updates.
"""

from flask import request, jsonify
from flask_login import login_required, current_user

from app.notifications import notifications_bp
from app.extensions import db
from app.models import Notification


# ---------------------------------------------------------------------------
# GET /notifications  – fetch latest unread (or all)
# ---------------------------------------------------------------------------
@notifications_bp.route("", methods=["GET"])
@login_required
def list_notifications():
    """
    Returns latest 20 unread notifications for this user OR broadcast
    notifications (user_id IS NULL).
    ?all=1 includes read notifications.
    """
    include_read = request.args.get("all", "0") == "1"

    query = db.session.query(
        Notification.id,
        Notification.message,
        Notification.category,
        Notification.is_read,
        Notification.created_at,
    ).filter(
        # User-specific OR broadcast
        db.or_(
            Notification.user_id == current_user.id,
            Notification.user_id == None,  # noqa: E711
        )
    )

    if not include_read:
        query = query.filter(Notification.is_read == False)  # noqa: E712

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
# POST /notifications/read  – mark notifications as read
# ---------------------------------------------------------------------------
@notifications_bp.route("/read", methods=["POST"])
@login_required
def mark_read():
    """
    Body: { "ids": [1, 2, 3] }  OR  {} to mark ALL unread as read.
    Uses bulk UPDATE – one DB round-trip regardless of count.
    WHY: avoids loading each notification object and updating one by one.
    """
    data = request.get_json(silent=True) or {}
    ids = data.get("ids")  # None means "mark all"

    query = db.session.query(Notification).filter(
        db.or_(
            Notification.user_id == current_user.id,
            Notification.user_id == None,  # noqa: E711
        ),
        Notification.is_read == False,  # noqa: E712
    )

    if ids and isinstance(ids, list):
        query = query.filter(Notification.id.in_(ids))

    updated = query.update({"is_read": True}, synchronize_session=False)
    db.session.commit()

    return jsonify({"message": f"{updated} notification(s) marked as read."}), 200


# ---------------------------------------------------------------------------
# GET /notifications/count  – unread count badge
# ---------------------------------------------------------------------------
@notifications_bp.route("/count", methods=["GET"])
@login_required
def unread_count():
    """
    Lightweight endpoint for the notification badge in the UI.
    Returns a single integer – very fast query.
    """
    from sqlalchemy import func
    count = db.session.query(func.count(Notification.id)).filter(
        db.or_(
            Notification.user_id == current_user.id,
            Notification.user_id == None,  # noqa: E711
        ),
        Notification.is_read == False,  # noqa: E712
    ).scalar()

    return jsonify({"unread": count}), 200