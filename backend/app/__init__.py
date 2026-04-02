"""
Application factory.
"""

import logging
import os
from flask import Flask
from werkzeug.security import generate_password_hash

from config import Config
from app.extensions import db, login_manager, cors


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # -----------------------------------------------------------------------
    # Logging: only errors
    # -----------------------------------------------------------------------
    app.logger.setLevel(logging.ERROR)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.ERROR)

    # -----------------------------------------------------------------------
    # Extensions
    # -----------------------------------------------------------------------
    db.init_app(app)
    login_manager.init_app(app)

    # Get allowed origins from environment variable or use defaults
    allowed_origins = os.environ.get("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173,http://localhost:8080").split(",")

    # Also add your production frontend URL when deployed
    # allowed_origins.append("https://your-frontend-domain.com")

    # Configure CORS - Allow frontend to connect
    cors.init_app(app,
        resources={r"/*": {
            "origins": allowed_origins,
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization", "X-Requested-With"],
            "expose_headers": ["Content-Type", "Authorization"],
            "supports_credentials": True,  # Important for cookies
            "allow_credentials": True
        }},
        supports_credentials=True
    )

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
        return db.session.get(User, int(user_id))

    # -----------------------------------------------------------------------
    # Register blueprints
    # -----------------------------------------------------------------------
    from app.auth.routes import auth_bp
    from app.products.routes import products_bp
    from app.sales.routes import sales_bp
    from app.debts.routes import debts_bp
    from app.reports.routes import reports_bp
    from app.notifications.routes import notifications_bp

    app.register_blueprint(auth_bp, url_prefix="/auth")
    app.register_blueprint(products_bp, url_prefix="/products")
    app.register_blueprint(sales_bp, url_prefix="/sales")
    app.register_blueprint(debts_bp, url_prefix="/debts")
    app.register_blueprint(reports_bp, url_prefix="/reports")
    app.register_blueprint(notifications_bp, url_prefix="/notifications")

    # -----------------------------------------------------------------------
    # Create tables
    # -----------------------------------------------------------------------
    with app.app_context():
        db.create_all()

    return app