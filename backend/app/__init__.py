"""
Application factory.

WHY factory pattern: lets us create multiple app instances for testing
without polluting global state, and keeps imports clean.
"""

import logging
from flask import Flask
from werkzeug.security import generate_password_hash

from config import Config
from app.extensions import db, login_manager


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # -----------------------------------------------------------------------
    # Logging: only errors – saves CPU cycles writing unnecessary log lines
    # -----------------------------------------------------------------------
    app.logger.setLevel(logging.ERROR)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.ERROR)

    # -----------------------------------------------------------------------
    # Extensions
    # -----------------------------------------------------------------------
    db.init_app(app)
    login_manager.init_app(app)

    # -----------------------------------------------------------------------
    # Store hashed admin password in config at startup
    # -----------------------------------------------------------------------
    app.config["ADMIN_PASSWORD_HASH"] = generate_password_hash(
        app.config.get("ADMIN_PASSWORD", "joynoela@1998")
    )

    # -----------------------------------------------------------------------
    # User loader for Flask-Login
    # -----------------------------------------------------------------------
    from app.models import User

    @login_manager.user_loader
    def load_user(user_id):
        # Use .get() → primary-key lookup, fastest possible query
        return db.session.get(User, int(user_id))

    # -----------------------------------------------------------------------
    # Register blueprints
    # -----------------------------------------------------------------------
    from app.auth.routes import auth_bp
    from app.products.routes import products_bp
    from app.sales.routes import sales_bp
    from app.debts.routes import debts_bp
    from app.days.routes import days_bp
    from app.reports.routes import reports_bp
    from app.notifications.routes import notifications_bp

    app.register_blueprint(auth_bp, url_prefix="/auth")
    app.register_blueprint(products_bp, url_prefix="/products")
    app.register_blueprint(sales_bp, url_prefix="/sales")
    app.register_blueprint(debts_bp, url_prefix="/debts")
    app.register_blueprint(days_bp, url_prefix="/days")
    app.register_blueprint(reports_bp, url_prefix="/reports")
    app.register_blueprint(notifications_bp, url_prefix="/notifications")

    # -----------------------------------------------------------------------
    # Configure database-specific settings
    # -----------------------------------------------------------------------
    with app.app_context():
        _configure_database(app)
        db.create_all()

    return app


def _configure_database(app):
    """
    Configure database-specific settings.
    For SQLite: apply performance pragmas
    For MySQL: no special configuration needed
    """
    from sqlalchemy import event
    from app.extensions import db as _db

    # Only configure SQLite-specific pragmas
    if 'sqlite' in app.config['SQLALCHEMY_DATABASE_URI']:
        @event.listens_for(_db.engine, "connect")
        def set_sqlite_pragma(dbapi_conn, _):
            cursor = dbapi_conn.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA synchronous=NORMAL")
            cursor.execute("PRAGMA cache_size=-8000")   # 8 MB
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.execute("PRAGMA temp_store=MEMORY")
            cursor.close()