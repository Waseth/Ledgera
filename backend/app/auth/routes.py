"""
auth/routes.py – Authentication: login, logout, role routing.

OPTIMIZATION:
- We query only (id, email, password_hash, role, is_active) – not the full
  User row – to keep the response payload tiny.
- Admin credentials are checked against the in-memory config hash; no DB hit
  needed for admin login.
"""

from flask import (
    current_app, request, redirect, url_for, jsonify, session
)
from flask_login import login_user, logout_user, login_required, current_user
from werkzeug.security import check_password_hash

from app.auth import auth_bp
from app.extensions import db
from app.models import User, AuditLog


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _log_action(user_id, action, details=None):
    """Insert a single audit row; kept as a helper to reuse across modules."""
    log = AuditLog(user_id=user_id, action=action, details=details)
    db.session.add(log)
    # Caller is responsible for commit


def _user_dashboard(role):
    if role == "admin":
        return url_for("reports.dashboard_page")
    return url_for("sales.index")


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------
@auth_bp.route("/login", methods=["POST"])
def login():
    """
    POST /auth/login
    Body: { "email": "...", "password": "..." }
    Returns JSON with redirect URL on success.
    """
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "Email and password are required."}), 400

    # --- Check admin (no DB query needed) ---
    admin_email = current_app.config["ADMIN_EMAIL"].lower()
    admin_hash = current_app.config["ADMIN_PASSWORD_HASH"]

    if email == admin_email:
        if not check_password_hash(admin_hash, password):
            return jsonify({"error": "Invalid credentials."}), 401

        # Create a transient User-like object for Flask-Login
        # (admin is not stored in DB per spec)
        admin_user = _get_or_create_admin_user()
        login_user(admin_user)
        return jsonify({"redirect": url_for("reports.dashboard_page")}), 200

    # --- Shopkeeper: single targeted query ---
    # WHY with_entities: loads only needed columns, not full ORM object initially
    row = (
        db.session.query(User.id, User.password_hash, User.role, User.is_active)
        .filter(User.email == email)
        .first()
    )

    if row is None or not check_password_hash(row.password_hash, password):
        return jsonify({"error": "Invalid credentials."}), 401

    if not row.is_active:
        return jsonify({"error": "Account is deactivated."}), 403

    # Load full user object for Flask-Login (needed for UserMixin methods)
    user = db.session.get(User, row.id)
    login_user(user)

    with db.session.begin_nested():
        _log_action(user.id, "login")
    db.session.commit()

    return jsonify({"redirect": _user_dashboard(row.role)}), 200


@auth_bp.route("/logout", methods=["POST"])
@login_required
def logout():
    user_id = current_user.id if not getattr(current_user, "_is_admin", False) else None
    if user_id:
        _log_action(user_id, "logout")
        db.session.commit()
    logout_user()
    return jsonify({"redirect": url_for("auth.login_page")}), 200


@auth_bp.route("/login", methods=["GET"])
def login_page():
    """Simple HTML login page."""
    return _login_html()


# ---------------------------------------------------------------------------
# Admin: create shopkeeper account
# ---------------------------------------------------------------------------
@auth_bp.route("/shopkeepers", methods=["POST"])
@login_required
def create_shopkeeper():
    if current_user.role != "admin":
        return jsonify({"error": "Forbidden."}), 403

    from werkzeug.security import generate_password_hash

    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not name or not email or len(password) < 6:
        return jsonify({"error": "name, email, and password (≥6 chars) required."}), 400

    # Check duplicate – only fetch id, email
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
    db.session.flush()   # get user.id before commit
    _log_action(None, "create_shopkeeper", f"email={email}")
    db.session.commit()

    return jsonify({"message": "Shopkeeper created.", "id": user.id}), 201


@auth_bp.route("/shopkeepers", methods=["GET"])
@login_required
def list_shopkeepers():
    if current_user.role != "admin":
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
    """
    Return the DB record for admin (created once if not exists).
    We store admin in DB solely so Flask-Login can serialize the session.
    """
    from werkzeug.security import generate_password_hash
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


def _login_html():
    return """
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Shop Login</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: #f0f2f5;
           display: flex; align-items: center; justify-content: center;
           min-height: 100vh; }
    .card { background: #fff; padding: 2rem; border-radius: 10px;
            box-shadow: 0 2px 16px rgba(0,0,0,.1); width: 360px; }
    h2 { margin-bottom: 1.5rem; color: #1a1a2e; text-align: center; }
    label { display: block; font-size: .85rem; margin-bottom: .25rem; color: #555; }
    input { width: 100%; padding: .6rem .8rem; border: 1px solid #ddd;
            border-radius: 6px; font-size: 1rem; margin-bottom: 1rem; }
    button { width: 100%; padding: .75rem; background: #2563eb; color: #fff;
             border: none; border-radius: 6px; font-size: 1rem; cursor: pointer; }
    button:hover { background: #1d4ed8; }
    #msg { text-align: center; margin-top: .75rem; color: #dc2626; font-size: .9rem; }
  </style>
</head>
<body>
  <div class="card">
    <h2>🛒 Shop Login</h2>
    <label>Email</label>
    <input type="email" id="email" placeholder="you@example.com">
    <label>Password</label>
    <input type="password" id="pwd" placeholder="••••••••">
    <button onclick="doLogin()">Sign In</button>
    <p id="msg"></p>
  </div>
  <script>
    async function doLogin() {
      const msg = document.getElementById('msg');
      msg.textContent = '';
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          email: document.getElementById('email').value,
          password: document.getElementById('pwd').value
        })
      });
      const data = await res.json();
      if (res.ok) window.location.href = data.redirect;
      else msg.textContent = data.error || 'Login failed.';
    }
    document.addEventListener('keydown', e => { if(e.key==='Enter') doLogin(); });
  </script>
</body>
</html>
""", 200