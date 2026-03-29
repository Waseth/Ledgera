"""
reports/routes.py – Daily, weekly, monthly reports + admin dashboard.

OPTIMIZATIONS:
- All totals use SQL SUM/COUNT aggregations, never Python loops.
- Date filtering uses indexed columns (timestamp, date).
- Dashboard returns all KPIs in ONE request (no multiple round trips).
- LIMIT applied on itemized queries.
"""

from datetime import date, datetime, timedelta
from flask import jsonify, request
from flask_login import login_required, current_user
from sqlalchemy import func

from app.reports import reports_bp
from app.extensions import db
from app.models import Sale, Expense, Day, Debt, Product
from app.reports.dashboard_html import ADMIN_DASHBOARD_HTML


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _date_range_from_request():
    """Parse ?start=YYYY-MM-DD&end=YYYY-MM-DD or default to today."""
    today = date.today()
    try:
        start = date.fromisoformat(request.args.get("start", today.isoformat()))
        end = date.fromisoformat(request.args.get("end", today.isoformat()))
    except ValueError:
        start = end = today
    return start, end


def _sales_aggregates(start: date, end: date):
    """
    Returns (total_revenue, total_profit, cash_revenue, debt_revenue, sale_count)
    for the given date range using a SINGLE query.
    WHY: one round-trip instead of 5 separate queries.
    """
    result = db.session.query(
        func.coalesce(func.sum(Sale.total_price), 0.0).label("revenue"),
        func.coalesce(func.sum(Sale.profit), 0.0).label("profit"),
        func.coalesce(
            func.sum(
                db.case((Sale.payment_type == "cash", Sale.total_price), else_=0)
            ), 0.0
        ).label("cash_revenue"),
        func.coalesce(
            func.sum(
                db.case((Sale.payment_type == "debt", Sale.total_price), else_=0)
            ), 0.0
        ).label("debt_revenue"),
        func.count(Sale.id).label("count"),
    ).join(Day, Sale.day_id == Day.id).filter(
        Day.date >= start, Day.date <= end
    ).first()

    return result


def _expenses_total(start: date, end: date):
    return db.session.query(
        func.coalesce(func.sum(Expense.amount), 0.0)
    ).join(Day, Expense.day_id == Day.id).filter(
        Day.date >= start, Day.date <= end
    ).scalar()


# ---------------------------------------------------------------------------
# GET /reports/daily  – today or specified date
# ---------------------------------------------------------------------------
@reports_bp.route("/daily", methods=["GET"])
@login_required
def daily_report():
    start, end = _date_range_from_request()  # same day when start==end

    agg = _sales_aggregates(start, start)
    expenses = _expenses_total(start, start)
    net_profit = round(agg.profit - expenses, 2)

    # Day close status
    day_row = db.session.query(
        Day.id, Day.is_closed, Day.opening_cash,
        Day.actual_cash, Day.mismatch,
    ).filter(Day.date == start).first()

    return jsonify({
        "date": start.isoformat(),
        "revenue": round(agg.revenue, 2),
        "profit": round(agg.profit, 2),
        "cash_revenue": round(agg.cash_revenue, 2),
        "debt_revenue": round(agg.debt_revenue, 2),
        "expenses": round(expenses, 2),
        "net_profit": net_profit,
        "sale_count": agg.count,
        "day": {
            "id": day_row.id if day_row else None,
            "is_closed": day_row.is_closed if day_row else None,
            "opening_cash": day_row.opening_cash if day_row else None,
            "actual_cash": day_row.actual_cash if day_row else None,
            "mismatch": day_row.mismatch if day_row else None,
        } if day_row else None,
    }), 200


# ---------------------------------------------------------------------------
# GET /reports/weekly  – last 7 days
# ---------------------------------------------------------------------------
@reports_bp.route("/weekly", methods=["GET"])
@login_required
def weekly_report():
    today = date.today()
    start = today - timedelta(days=6)  # 7 days inclusive

    agg = _sales_aggregates(start, today)
    expenses = _expenses_total(start, today)
    net_profit = round(agg.profit - expenses, 2)

    # Per-day breakdown using GROUP BY
    daily_rows = (
        db.session.query(
            Day.date,
            func.coalesce(func.sum(Sale.total_price), 0.0).label("revenue"),
            func.coalesce(func.sum(Sale.profit), 0.0).label("profit"),
            func.count(Sale.id).label("count"),
        )
        .outerjoin(Sale, Sale.day_id == Day.id)
        .filter(Day.date >= start, Day.date <= today)
        .group_by(Day.date)
        .order_by(Day.date)
        .all()
    )

    return jsonify({
        "start": start.isoformat(),
        "end": today.isoformat(),
        "total_revenue": round(agg.revenue, 2),
        "total_profit": round(agg.profit, 2),
        "total_expenses": round(expenses, 2),
        "net_profit": net_profit,
        "sale_count": agg.count,
        "daily_breakdown": [
            {
                "date": r.date.isoformat(),
                "revenue": round(r.revenue, 2),
                "profit": round(r.profit, 2),
                "sale_count": r.count,
            }
            for r in daily_rows
        ],
    }), 200


# ---------------------------------------------------------------------------
# GET /reports/monthly  – current month or ?month=YYYY-MM
# ---------------------------------------------------------------------------
@reports_bp.route("/monthly", methods=["GET"])
@login_required
def monthly_report():
    month_str = request.args.get("month")
    try:
        if month_str:
            year, mon = [int(x) for x in month_str.split("-")]
        else:
            today = date.today()
            year, mon = today.year, today.month
        start = date(year, mon, 1)
        # Last day of month
        if mon == 12:
            end = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            end = date(year, mon + 1, 1) - timedelta(days=1)
    except (ValueError, TypeError):
        today = date.today()
        start = date(today.year, today.month, 1)
        end = today

    agg = _sales_aggregates(start, end)
    expenses = _expenses_total(start, end)
    net_profit = round(agg.profit - expenses, 2)

    # Top 5 products by revenue
    top_products = (
        db.session.query(
            Product.name,
            func.sum(Sale.quantity_sold).label("units_sold"),
            func.sum(Sale.total_price).label("revenue"),
            func.sum(Sale.profit).label("profit"),
        )
        .join(Product, Sale.product_id == Product.id)
        .join(Day, Sale.day_id == Day.id)
        .filter(Day.date >= start, Day.date <= end)
        .group_by(Product.id, Product.name)
        .order_by(func.sum(Sale.total_price).desc())
        .limit(5)
        .all()
    )

    return jsonify({
        "month": f"{year}-{mon:02d}",
        "start": start.isoformat(),
        "end": end.isoformat(),
        "total_revenue": round(agg.revenue, 2),
        "total_profit": round(agg.profit, 2),
        "cash_revenue": round(agg.cash_revenue, 2),
        "debt_revenue": round(agg.debt_revenue, 2),
        "total_expenses": round(expenses, 2),
        "net_profit": net_profit,
        "sale_count": agg.count,
        "top_products": [
            {
                "name": r.name,
                "units_sold": r.units_sold,
                "revenue": round(r.revenue, 2),
                "profit": round(r.profit, 2),
            }
            for r in top_products
        ],
    }), 200

# ---------------------------------------------------------------------------
# GET /reports/product-performance  – performance for a specific product
# ---------------------------------------------------------------------------
@reports_bp.route("/product-performance", methods=["GET"])
@login_required
def product_performance():
    """
    Get detailed performance metrics for a specific product.
    Query params:
        product_id: integer (required)
        days: integer (optional, default 30) - number of days of history
    """
    product_id = request.args.get("product_id", type=int)
    days = request.args.get("days", 30, type=int)

    if not product_id:
        return jsonify({"error": "product_id parameter is required"}), 400

    # Get product details
    product = Product.query.get_or_404(product_id)

    # Date range (last X days or all time)
    end_date = date.today()
    start_date = end_date - timedelta(days=days)

    # Get sales for this product
    sales_data = db.session.query(
        func.coalesce(func.sum(Sale.quantity_sold), 0).label("total_quantity"),
        func.coalesce(func.sum(Sale.total_price), 0).label("total_revenue"),
        func.coalesce(func.sum(Sale.profit), 0).label("total_profit"),
        func.count(Sale.id).label("transaction_count")
    ).join(Day, Sale.day_id == Day.id).filter(
        Sale.product_id == product_id,
        Day.date >= start_date
    ).first()

    # Get daily breakdown for chart display
    daily_breakdown = db.session.query(
        Day.date,
        func.coalesce(func.sum(Sale.quantity_sold), 0).label("quantity"),
        func.coalesce(func.sum(Sale.total_price), 0).label("revenue"),
        func.coalesce(func.sum(Sale.profit), 0).label("profit")
    ).join(Sale, Sale.day_id == Day.id).filter(
        Sale.product_id == product_id,
        Day.date >= start_date
    ).group_by(Day.date).order_by(Day.date).all()

    # Get payment type breakdown
    payment_breakdown = db.session.query(
        Sale.payment_type,
        func.count(Sale.id).label("count"),
        func.sum(Sale.total_price).label("amount")
    ).join(Day, Sale.day_id == Day.id).filter(
        Sale.product_id == product_id,
        Day.date >= start_date
    ).group_by(Sale.payment_type).all()

    return jsonify({
        "product": {
            "id": product.id,
            "name": product.name,
            "buying_price": product.buying_price,
            "selling_price": product.selling_price,
            "current_stock": product.quantity,
            "unit": product.unit
        },
        "period": {
            "start": start_date.isoformat(),
            "end": end_date.isoformat(),
            "days": days
        },
        "summary": {
            "total_quantity": int(sales_data.total_quantity),
            "total_revenue": round(sales_data.total_revenue, 2),
            "total_profit": round(sales_data.total_profit, 2),
            "transaction_count": sales_data.transaction_count,
            "profit_margin": round(
                (sales_data.total_profit / sales_data.total_revenue * 100)
                if sales_data.total_revenue > 0 else 0, 2
            )
        },
        "daily_breakdown": [
            {
                "date": str(day.date),
                "quantity": int(day.quantity),
                "revenue": round(day.revenue, 2),
                "profit": round(day.profit, 2)
            }
            for day in daily_breakdown
        ],
        "payment_breakdown": [
            {
                "type": p.payment_type,
                "count": p.count,
                "amount": round(p.amount, 2)
            }
            for p in payment_breakdown
        ]
    }), 200

# ---------------------------------------------------------------------------
# GET /reports/top-products  – best selling products
# ---------------------------------------------------------------------------
@reports_bp.route("/top-products", methods=["GET"])
@login_required
def top_products():
    """
    Get top performing products by quantity sold or revenue.
    Query params:
        sort_by: "quantity" or "revenue" (default: "quantity")
        limit: integer (default: 10)
        days: integer (optional) - number of days to consider
    """
    sort_by = request.args.get("sort_by", "quantity")
    limit = request.args.get("limit", 10, type=int)
    days = request.args.get("days", type=int)

    # Date filter
    start_date = date.today() - timedelta(days=days) if days else None

    # Build query
    query = db.session.query(
        Product.id,
        Product.name,
        Product.selling_price,
        func.coalesce(func.sum(Sale.quantity_sold), 0).label("total_quantity"),
        func.coalesce(func.sum(Sale.total_price), 0).label("total_revenue"),
        func.coalesce(func.sum(Sale.profit), 0).label("total_profit"),
        func.count(Sale.id).label("transaction_count")
    ).outerjoin(Sale, Sale.product_id == Product.id)

    if start_date:
        query = query.join(Day, Sale.day_id == Day.id).filter(Day.date >= start_date)

    query = query.group_by(Product.id, Product.name, Product.selling_price)

    # Order by
    if sort_by == "revenue":
        query = query.order_by(func.sum(Sale.total_price).desc())
    else:
        query = query.order_by(func.sum(Sale.quantity_sold).desc())

    top_products = query.limit(limit).all()

    return jsonify({
        "sort_by": sort_by,
        "limit": limit,
        "period_days": days if days else "all_time",
        "products": [
            {
                "id": p.id,
                "name": p.name,
                "selling_price": p.selling_price,
                "total_quantity": int(p.total_quantity),
                "total_revenue": round(p.total_revenue, 2),
                "total_profit": round(p.total_profit, 2),
                "transaction_count": p.transaction_count
            }
            for p in top_products
        ]
    }), 200


# ---------------------------------------------------------------------------
# GET /reports/dashboard  – admin dashboard (all KPIs in one request)
# ---------------------------------------------------------------------------
@reports_bp.route("/dashboard", methods=["GET"])
@login_required
def dashboard_admin():
    if current_user.role != "admin":
        return jsonify({"error": "Forbidden."}), 403

    today = date.today()
    week_start = today - timedelta(days=6)

    # All aggregations fire as independent queries but are minimal
    today_agg = _sales_aggregates(today, today)
    week_agg = _sales_aggregates(week_start, today)
    today_exp = _expenses_total(today, today)
    week_exp = _expenses_total(week_start, today)

    # Outstanding debt
    debt_total = db.session.query(
        func.coalesce(func.sum(Debt.amount), 0.0)
    ).filter(Debt.is_paid == False).scalar()  # noqa: E712

    # Low-stock count (use index)
    from flask import current_app
    threshold = current_app.config.get("LOW_STOCK_THRESHOLD", 5)
    low_stock_count = db.session.query(
        func.count(Product.id)
    ).filter(Product.quantity <= threshold).scalar()

    return jsonify({
        "today": {
            "revenue": round(today_agg.revenue, 2),
            "profit": round(today_agg.profit, 2),
            "expenses": round(today_exp, 2),
            "net_profit": round(today_agg.profit - today_exp, 2),
            "sale_count": today_agg.count,
        },
        "week": {
            "revenue": round(week_agg.revenue, 2),
            "profit": round(week_agg.profit, 2),
            "expenses": round(week_exp, 2),
            "net_profit": round(week_agg.profit - week_exp, 2),
            "sale_count": week_agg.count,
        },
        "outstanding_debt": round(debt_total, 2),
        "low_stock_count": low_stock_count,
        "date": today.isoformat(),
    }), 200

# ---------------------------------------------------------------------------
# GET /reports/notifications  – get notifications for current user
# ---------------------------------------------------------------------------
@reports_bp.route("/notifications", methods=["GET"])
@login_required
def get_notifications():
    """Get notifications for the current user."""
    from app.models import Notification

    # Get user-specific notifications and global notifications
    notifications = Notification.query.filter(
        (Notification.user_id == current_user.id) |
        (Notification.user_id == None)  # Global notifications
    ).order_by(Notification.created_at.desc()).limit(50).all()

    return jsonify([
        {
            "id": n.id,
            "message": n.message,
            "category": n.category,
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat()
        }
        for n in notifications
    ]), 200


# ---------------------------------------------------------------------------
# POST /reports/notifications/<id>/read  – mark notification as read
# ---------------------------------------------------------------------------
@reports_bp.route("/notifications/<int:notif_id>/read", methods=["POST"])
@login_required
def mark_notification_read(notif_id):
    """Mark a notification as read."""
    from app.models import Notification

    notif = Notification.query.get_or_404(notif_id)
    notif.is_read = True
    db.session.commit()

    return jsonify({"message": "Notification marked as read"}), 200


# ---------------------------------------------------------------------------
# POST /reports/notifications/read-all  – mark all as read
# ---------------------------------------------------------------------------
@reports_bp.route("/notifications/read-all", methods=["POST"])
@login_required
def mark_all_notifications_read():
    """Mark all notifications for current user as read."""
    from app.models import Notification

    Notification.query.filter(
        (Notification.user_id == current_user.id) |
        (Notification.user_id == None)
    ).update({"is_read": True}, synchronize_session=False)

    db.session.commit()

    return jsonify({"message": "All notifications marked as read"}), 200


# ---------------------------------------------------------------------------
# HTML page routes (served once; JS fetches data via JSON endpoints)
# ---------------------------------------------------------------------------

@reports_bp.route("/dashboard-page", methods=["GET"])
@login_required
def dashboard_page():
    if current_user.role != "admin":
        from flask import redirect, url_for
        return redirect(url_for("sales.index"))
    return ADMIN_DASHBOARD_HTML, 200


@reports_bp.route("/weekly-page", methods=["GET"])
@login_required
def weekly_page():
    return _simple_report_html("Weekly Report", "weekly"), 200


@reports_bp.route("/monthly-page", methods=["GET"])
@login_required
def monthly_page():
    return _simple_report_html("Monthly Report", "monthly"), 200


def _simple_report_html(title, endpoint):
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title}</title>
  <style>
    body {{ font-family: system-ui, sans-serif; background: #f0f2f5;
           padding: 1.5rem; color: #1a1a2e; }}
    nav {{ background: #1e3a5f; color: #fff; padding: .6rem 1rem;
          border-radius: 8px; margin-bottom: 1.25rem;
          display: flex; align-items: center; gap: 1rem; }}
    nav a {{ color: #93c5fd; text-decoration: none; font-size: .9rem; }}
    h2 {{ margin-bottom: 1rem; }}
    .card {{ background: #fff; border-radius: 10px; padding: 1.25rem;
            box-shadow: 0 2px 10px rgba(0,0,0,.07); margin-bottom: 1rem; }}
    .grid {{ display: grid; gap: .75rem;
            grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
            margin-bottom: 1rem; }}
    .kpi h4 {{ font-size: .75rem; color: #6b7280; text-transform: uppercase; }}
    .kpi p  {{ font-size: 1.5rem; font-weight: 700; color: #1e3a5f; }}
    table {{ width: 100%; border-collapse: collapse; font-size: .88rem; }}
    th, td {{ padding: .45rem .7rem; border-bottom: 1px solid #e5e7eb; }}
    th {{ background: #f8fafc; }}
    button {{ padding: .5rem 1rem; background: #2563eb; color: #fff;
             border: none; border-radius: 6px; cursor: pointer; }}
  </style>
</head>
<body>
  <nav>
    <a href="/reports/dashboard-page">← Dashboard</a>
    <span style="flex:1;font-weight:600">{title}</span>
    <a href="/sales">Sales</a>
  </nav>
  <div id="content"><p>Loading…</p></div>
  <script>
    const fmt = n => Number(n).toLocaleString('en-KE', {{minimumFractionDigits:2}});
    async function load() {{
      const res = await fetch('/reports/{endpoint}');
      const d = await res.json();
      let html = '<div class="card"><div class="grid">';
      html += `<div class="kpi"><h4>Revenue</h4><p>KSh ${{fmt(d.total_revenue)}}</p></div>`;
      html += `<div class="kpi"><h4>Profit</h4><p>KSh ${{fmt(d.total_profit)}}</p></div>`;
      html += `<div class="kpi"><h4>Expenses</h4><p>KSh ${{fmt(d.total_expenses)}}</p></div>`;
      html += `<div class="kpi"><h4>Net Profit</h4><p>KSh ${{fmt(d.net_profit)}}</p></div>`;
      html += `<div class="kpi"><h4>Sales Count</h4><p>${{d.sale_count}}</p></div>`;
      html += '</div></div>';
      if (d.daily_breakdown) {{
        html += '<div class="card"><h3 style="margin-bottom:.75rem">Daily Breakdown</h3><table><thead><tr><th>Date</th><th>Revenue</th><th>Profit</th><th>Sales</th></tr></thead><tbody>';
        d.daily_breakdown.forEach(r => {{
          html += `<tr><td>${{r.date}}</td><td>KSh ${{fmt(r.revenue)}}</td><td>KSh ${{fmt(r.profit)}}</td><td>${{r.sale_count}}</td></tr>`;
        }});
        html += '</tbody></table></div>';
      }}
      if (d.top_products) {{
        html += '<div class="card"><h3 style="margin-bottom:.75rem">Top 5 Products</h3><table><thead><tr><th>Product</th><th>Units Sold</th><th>Revenue</th><th>Profit</th></tr></thead><tbody>';
        d.top_products.forEach(r => {{
          html += `<tr><td>${{r.name}}</td><td>${{r.units_sold}}</td><td>KSh ${{fmt(r.revenue)}}</td><td>KSh ${{fmt(r.profit)}}</td></tr>`;
        }});
        html += '</tbody></table></div>';
      }}
      document.getElementById('content').innerHTML = html;
    }}
    load();
  </script>
</body>
</html>"""