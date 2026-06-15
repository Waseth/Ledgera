"""
models.py – All database models for the shop management system.

OPTIMIZATION NOTES:
- Indexes on every foreign-key / filter column → avoids full-table scans.
- __repr__ kept minimal (no lazy-loading triggered).
- Decimal stored as Float (SQLite has no DECIMAL); use 2-decimal rounding at
  the application layer.
"""

from datetime import datetime
from flask_login import UserMixin
from sqlalchemy import Index, Text
from app.extensions import db


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------
class User(UserMixin, db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="shopkeeper")  # "admin" | "shopkeeper"
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # Relationships (lazy="dynamic" → queries not loaded until called)
    sales = db.relationship("Sale", backref="seller", lazy="dynamic")
    audit_logs = db.relationship("AuditLog", backref="actor", lazy="dynamic")

    def __repr__(self):
        return f"<User {self.email}>"


# ---------------------------------------------------------------------------
# Product
# ---------------------------------------------------------------------------
class Product(db.Model):
    __tablename__ = "products"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False, index=True)
    buying_price = db.Column(db.Float, nullable=False)
    selling_price = db.Column(db.Float, nullable=False)
    quantity = db.Column(db.Integer, nullable=False, default=0)
    unit = db.Column(db.String(30), default="piece")
    is_active = db.Column(db.Boolean, default=True, nullable=False)  # ADD THIS LINE
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow,
                           onupdate=datetime.utcnow, nullable=False)

    sales = db.relationship("Sale", backref="product", lazy="dynamic")

    def __repr__(self):
        return f"<Product {self.name}>"


# ---------------------------------------------------------------------------
# Sale (No day_id anymore)
# ---------------------------------------------------------------------------
class Sale(db.Model):
    __tablename__ = "sales"

    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey("products.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    quantity_sold = db.Column(db.Integer, nullable=False)
    unit_price = db.Column(db.Float, nullable=False)
    buying_price_at_sale = db.Column(db.Float, nullable=False)  # snapshot to preserve profit
    total_price = db.Column(db.Float, nullable=False)
    profit = db.Column(db.Float, nullable=False)
    payment_type = db.Column(db.String(10), nullable=False, default="cash")  # "cash" | "debt"
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("idx_sales_product", "product_id"),
        Index("idx_sales_user", "user_id"),
        Index("idx_sales_timestamp", "timestamp"),
        Index("idx_sales_payment", "payment_type"),
    )

    def __repr__(self):
        return f"<Sale id={self.id} product_id={self.product_id}>"


class Expense(db.Model):
    __tablename__ = "expenses"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    description = db.Column(db.String(200), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    category = db.Column(db.String(50), default="other")
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("idx_expense_timestamp", "timestamp"),
    )

    def __repr__(self):
        return f"<Expense {self.description} {self.amount}>"


# ---------------------------------------------------------------------------
# Debt
# ---------------------------------------------------------------------------
class Debt(db.Model):
    __tablename__ = "debts"

    id = db.Column(db.Integer, primary_key=True)
    sale_id = db.Column(db.Integer, db.ForeignKey("sales.id"), nullable=False, unique=True)
    customer_name = db.Column(db.String(120), nullable=False)
    customer_phone = db.Column(db.String(20), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    is_paid = db.Column(db.Boolean, default=False, nullable=False)
    paid_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    sale = db.relationship("Sale", backref=db.backref("debt", uselist=False))

    __table_args__ = (
        Index("idx_debt_paid", "is_paid"),
        Index("idx_debt_phone", "customer_phone"),
    )

    def __repr__(self):
        return f"<Debt {self.customer_name} paid={self.is_paid}>"


# ---------------------------------------------------------------------------
# Notification
# ---------------------------------------------------------------------------
class Notification(db.Model):
    __tablename__ = "notifications"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)  # None = all users
    message = db.Column(db.String(300), nullable=False)
    category = db.Column(db.String(30), default="info")  # info | warning | danger
    is_read = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("idx_notif_user_read", "user_id", "is_read"),
    )

    def __repr__(self):
        return f"<Notification {self.category}: {self.message[:30]}>"


# ---------------------------------------------------------------------------
# AuditLog  (immutable – no edits/deletes allowed anywhere)
# ---------------------------------------------------------------------------
class AuditLog(db.Model):
    __tablename__ = "audit_logs"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    action = db.Column(db.String(50), nullable=False)   # e.g. "add_product", "log_sale"
    details = db.Column(db.Text, nullable=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("idx_audit_user", "user_id"),
        Index("idx_audit_timestamp", "timestamp"),
    )

    def __repr__(self):
        return f"<AuditLog {self.action} by user_id={self.user_id}>"


# ---------------------------------------------------------------------------
# MonthlySnapshot – Stores monthly totals for historical comparison
# ---------------------------------------------------------------------------
class MonthlySnapshot(db.Model):
    __tablename__ = "monthly_snapshots"

    id = db.Column(db.Integer, primary_key=True)
    year = db.Column(db.Integer, nullable=False)
    month = db.Column(db.Integer, nullable=False)  # 1-12
    total_revenue = db.Column(db.Float, default=0.0)
    total_profit = db.Column(db.Float, default=0.0)
    cash_revenue = db.Column(db.Float, default=0.0)
    debt_revenue = db.Column(db.Float, default=0.0)
    total_expenses = db.Column(db.Float, default=0.0)
    net_profit = db.Column(db.Float, default=0.0)
    sale_count = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('year', 'month', name='unique_year_month'),
        Index('idx_monthly_snapshot_date', 'year', 'month'),
    )

    def __repr__(self):
        return f"<MonthlySnapshot {self.year}-{self.month:02d}>"