"""
cache.py – Lightweight in-memory cache using functools.lru_cache.

WHY: Railway Hobby Plan has limited RAM. We avoid hitting SQLite on every
     request for data that rarely changes (product list, low-stock alerts).
     lru_cache stores one result in RAM; call invalidate_*() after writes.

IMPORTANT: lru_cache is process-local. Fine for single-process gunicorn
           (--workers 1), which is the recommended Railway config.
"""

from functools import lru_cache


# ---------------------------------------------------------------------------
# Product cache
# ---------------------------------------------------------------------------
@lru_cache(maxsize=1)
def _cached_products():
    """
    Internal cached fetch. Returns list of lightweight tuples.
    WHY tuples: SQLAlchemy Row objects are not picklable; tuples are tiny.
    """
    from app.extensions import db
    from app.models import Product
    rows = db.session.query(
        Product.id,
        Product.name,
        Product.buying_price,
        Product.selling_price,
        Product.quantity,
        Product.unit,
    ).filter(Product.is_active == True).order_by(Product.name).limit(200).all()  # ← ADD filter
    return rows  # list of named tuples


def get_cached_products():
    return _cached_products()


def invalidate_products():
    """Call this after any product add/update."""
    _cached_products.cache_clear()


# ---------------------------------------------------------------------------
# Low-stock alert cache
# ---------------------------------------------------------------------------
@lru_cache(maxsize=1)
def _cached_low_stock():
    from app.extensions import db
    from app.models import Product
    from flask import current_app
    threshold = current_app.config.get("LOW_STOCK_THRESHOLD", 5)
    rows = db.session.query(
        Product.id,
        Product.name,
        Product.quantity,
    ).filter(Product.quantity <= threshold, Product.is_active == True).all()  # ← ADD is_active filter
    return rows

def get_low_stock():
    return _cached_low_stock()


def invalidate_low_stock():
    _cached_low_stock.cache_clear()


def invalidate_all():
    """Convenience: clear every cache at once (e.g., after bulk import)."""
    _cached_products.cache_clear()
    _cached_low_stock.cache_clear()