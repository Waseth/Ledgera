"""
auth/routes.py – Authentication with JWT
"""

from flask import (
    current_app, request, jsonify
)
from flask_login import login_user, logout_user, login_required, current_user
from werkzeug.security import check_password_hash, generate_password_hash
import jwt
from datetime import datetime, timedelta
from functools import wraps

from app.auth import auth_bp
from app.extensions import db
from app.models import User, AuditLog


# ---------------------------------------------------------------------------
# JWT Helper Functions
# ---------------------------------------------------------------------------

def generate_token(user_id, email, role):
    """Generate JWT token for authenticated user."""
    payload = {
        'user_id': user_id,
        'email': email,
        'role': role,
        'exp': datetime.utcnow() + timedelta(hours=current_app.config.get('JWT_EXPIRATION_HOURS', 24)),
        'iat': datetime.utcnow()
    }
    token = jwt.encode(payload, current_app.config['JWT_SECRET_KEY'], algorithm='HS256')
    return token


def token_required(f):
    """Decorator to verify JWT token."""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth_header = request.headers.get('Authorization')

        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]

        if not token:
            return jsonify({'error': 'Token is missing!'}), 401

        try:
            payload = jwt.decode(token, current_app.config['JWT_SECRET_KEY'], algorithms=['HS256'])
            request.user_payload = payload
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired!'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token!'}), 401

        return f(*args, **kwargs)
    return decorated


def _log_action(user_id, action, details=None):
    """Insert a single audit row."""
    log = AuditLog(user_id=user_id, action=action, details=details)
    db.session.add(log)


def _user_dashboard(role):
    if role == "admin":
        return "/reports/dashboard-page"
    return "/sales"


# ---------------------------------------------------------------------------
# Login with JWT
# ---------------------------------------------------------------------------
@auth_bp.route("/login", methods=["POST"])
def login():
    """
    POST /auth/login
    Body: { "email": "...", "password": "..." }
    Returns JWT token on success.
    """
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "Email and password are required."}), 400

    # --- Check admin ---
    admin_email = current_app.config["ADMIN_EMAIL"].lower()
    admin_hash = current_app.config["ADMIN_PASSWORD_HASH"]

    if email == admin_email:
        if not check_password_hash(admin_hash, password):
            return jsonify({"error": "Invalid credentials."}), 401

        admin_user = _get_or_create_admin_user()

        # Generate JWT token
        token = generate_token(admin_user.id, admin_user.email, admin_user.role)

        return jsonify({
            "token": token,
            "user": {
                "id": admin_user.id,
                "name": admin_user.name,
                "email": admin_user.email,
                "role": admin_user.role
            },
            "redirect": _user_dashboard(admin_user.role)
        }), 200

    # --- Check shopkeeper ---
    row = (
        db.session.query(User.id, User.password_hash, User.role, User.is_active, User.name)
        .filter(User.email == email)
        .first()
    )

    if row is None or not check_password_hash(row.password_hash, password):
        return jsonify({"error": "Invalid credentials."}), 401

    if not row.is_active:
        return jsonify({"error": "Account is deactivated."}), 403

    # Generate JWT token
    token = generate_token(row.id, email, row.role)

    with db.session.begin_nested():
        _log_action(row.id, "login")
    db.session.commit()

    return jsonify({
        "token": token,
        "user": {
            "id": row.id,
            "name": row.name,
            "email": email,
            "role": row.role
        },
        "redirect": _user_dashboard(row.role)
    }), 200


@auth_bp.route("/verify", methods=["GET"])
@token_required
def verify_token():
    """Verify if token is valid."""
    return jsonify({
        "valid": True,
        "user": request.user_payload
    }), 200


@auth_bp.route("/logout", methods=["POST"])
def logout():
    """Logout - client just discards the token."""
    return jsonify({"message": "Logged out successfully"}), 200


# ---------------------------------------------------------------------------
# Admin: create shopkeeper account
# ---------------------------------------------------------------------------
@auth_bp.route("/shopkeepers", methods=["POST"])
@token_required
def create_shopkeeper():
    if request.user_payload.get('role') != "admin":
        return jsonify({"error": "Forbidden."}), 403

    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not name or not email or len(password) < 6:
        return jsonify({"error": "name, email, and password (≥6 chars) required."}), 400

    exists = db.session.query(User.id).filter(User.email == email).first()
    if exists:
        return jsonify({"error": "Email already registered."}), 409

    user = User(
        name=name,
        email=email,
        password_hash=generate_password_hash(password),
        role="shopkeeper",
    )
    db.session.add(user)
    db.session.flush()
    _log_action(None, "create_shopkeeper", f"email={email}")
    db.session.commit()

    return jsonify({"message": "Shopkeeper created.", "id": user.id}), 201


@auth_bp.route("/shopkeepers", methods=["GET"])
@token_required
def list_shopkeepers():
    if request.user_payload.get('role') != "admin":
        return jsonify({"error": "Forbidden."}), 403

    rows = db.session.query(
        User.id, User.name, User.email, User.is_active, User.created_at
    ).filter(User.role == "shopkeeper").all()

    return jsonify([
        {"id": r.id, "name": r.name, "email": r.email,
         "is_active": r.is_active, "created_at": r.created_at.isoformat()}
        for r in rows
    ]), 200


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _get_or_create_admin_user():
    """Return the DB record for admin (created once if not exists)."""
    admin_email = current_app.config["ADMIN_EMAIL"]
    user = db.session.query(User).filter(User.email == admin_email).first()
    if not user:
        user = User(
            name="Admin",
            email=admin_email,
            password_hash=current_app.config["ADMIN_PASSWORD_HASH"],
            role="admin",
        )
        db.session.add(user)
        db.session.commit()
    return user