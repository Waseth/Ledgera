"""
reports/routes.py – Daily, weekly, monthly reports + admin dashboard.
"""

from datetime import date, datetime, timedelta
from flask import jsonify, request
from sqlalchemy import func

from app.reports import reports_bp
from app.extensions import db
from app.models import Sale, Expense, Debt, Product, Notification, MonthlySnapshot
from app.reports.dashboard_html import ADMIN_DASHBOARD_HTML
from app.auth.routes import token_required


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
    """Returns aggregates for the given date range."""
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
    ).filter(
        db.func.date(Sale.timestamp) >= start,
        db.func.date(Sale.timestamp) <= end
    ).first()
    return result


def _expenses_total(start: date, end: date):
    return db.session.query(
        func.coalesce(func.sum(Expense.amount), 0.0)
    ).filter(
        db.func.date(Expense.timestamp) >= start,
        db.func.date(Expense.timestamp) <= end
    ).scalar()


# ---------------------------------------------------------------------------
# Monthly Snapshot Helpers
# ---------------------------------------------------------------------------

def save_monthly_snapshot(year, month):
    """Calculate and save monthly totals to snapshots table."""
    # Calculate date range
    start = date(year, month, 1)
    if month == 12:
        end = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        end = date(year, month + 1, 1) - timedelta(days=1)

    # Get aggregates
    agg = _sales_aggregates(start, end)
    expenses = _expenses_total(start, end)
    net_profit = round(agg.profit - expenses, 2)

    # Check if snapshot exists
    snapshot = MonthlySnapshot.query.filter_by(year=year, month=month).first()

    if snapshot:
        # Update existing
        snapshot.total_revenue = agg.revenue
        snapshot.total_profit = agg.profit
        snapshot.cash_revenue = agg.cash_revenue
        snapshot.debt_revenue = agg.debt_revenue
        snapshot.total_expenses = expenses
        snapshot.net_profit = net_profit
        snapshot.sale_count = agg.count
        snapshot.updated_at = datetime.utcnow()
    else:
        # Create new
        snapshot = MonthlySnapshot(
            year=year,
            month=month,
            total_revenue=agg.revenue,
            total_profit=agg.profit,
            cash_revenue=agg.cash_revenue,
            debt_revenue=agg.debt_revenue,
            total_expenses=expenses,
            net_profit=net_profit,
            sale_count=agg.count
        )
        db.session.add(snapshot)

    db.session.commit()
    return snapshot


# ---------------------------------------------------------------------------
# GET /reports/daily
# ---------------------------------------------------------------------------
@reports_bp.route("/daily", methods=["GET"])
@token_required
def daily_report():
    start, end = _date_range_from_request()
    agg = _sales_aggregates(start, start)
    expenses = _expenses_total(start, start)
    net_profit = round(agg.profit - expenses, 2)

    return jsonify({
        "date": start.isoformat(),
        "revenue": round(agg.revenue, 2),
        "profit": round(agg.profit, 2),
        "cash_revenue": round(agg.cash_revenue, 2),
        "debt_revenue": round(agg.debt_revenue, 2),
        "expenses": round(expenses, 2),
        "net_profit": net_profit,
        "sale_count": agg.count,
    }), 200


# ---------------------------------------------------------------------------
# GET /reports/weekly
# ---------------------------------------------------------------------------
@reports_bp.route("/weekly", methods=["GET"])
@token_required
def weekly_report():
    today = date.today()
    start = today - timedelta(days=6)

    agg = _sales_aggregates(start, today)
    expenses = _expenses_total(start, today)
    net_profit = round(agg.profit - expenses, 2)

    daily_rows = (
        db.session.query(
            func.date(Sale.timestamp).label("date"),
            func.coalesce(func.sum(Sale.total_price), 0.0).label("revenue"),
            func.coalesce(func.sum(Sale.profit), 0.0).label("profit"),
            func.count(Sale.id).label("count"),
        )
        .filter(
            func.date(Sale.timestamp) >= start,
            func.date(Sale.timestamp) <= today
        )
        .group_by(func.date(Sale.timestamp))
        .order_by(func.date(Sale.timestamp))
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
                "date": str(r.date),
                "revenue": round(r.revenue, 2),
                "profit": round(r.profit, 2),
                "sale_count": r.count,
            }
            for r in daily_rows
        ],
    }), 200


# ---------------------------------------------------------------------------
# GET /reports/monthly
# ---------------------------------------------------------------------------
@reports_bp.route("/monthly", methods=["GET"])
@token_required
def monthly_report():
    month_str = request.args.get("month")
    save_to_db = request.args.get("save", "true").lower() == "true"

    try:
        if month_str:
            year, mon = [int(x) for x in month_str.split("-")]
        else:
            today = date.today()
            year, mon = today.year, today.month
        start = date(year, mon, 1)
        if mon == 12:
            end = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            end = date(year, mon + 1, 1) - timedelta(days=1)
    except (ValueError, TypeError):
        today = date.today()
        start = date(today.year, today.month, 1)
        end = today
        year, mon = start.year, start.month

    agg = _sales_aggregates(start, end)
    expenses = _expenses_total(start, end)
    net_profit = round(agg.profit - expenses, 2)

    # Save snapshot for future comparison
    if save_to_db:
        save_monthly_snapshot(year, mon)

    top_products = (
        db.session.query(
            Product.name,
            func.sum(Sale.quantity_sold).label("units_sold"),
            func.sum(Sale.total_price).label("revenue"),
            func.sum(Sale.profit).label("profit"),
        )
        .join(Product, Sale.product_id == Product.id)
        .filter(
            db.func.date(Sale.timestamp) >= start,
            db.func.date(Sale.timestamp) <= end
        )
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
# GET /reports/monthly/history  – get all saved monthly snapshots
# ---------------------------------------------------------------------------
@reports_bp.route("/monthly/history", methods=["GET"])
@token_required
def monthly_history():
    """Get all saved monthly snapshots for comparison."""
    snapshots = MonthlySnapshot.query.order_by(
        MonthlySnapshot.year.desc(),
        MonthlySnapshot.month.desc()
    ).all()

    return jsonify([
        {
            "id": s.id,
            "year": s.year,
            "month": s.month,
            "month_name": datetime(s.year, s.month, 1).strftime("%B %Y"),
            "total_revenue": round(s.total_revenue, 2),
            "total_profit": round(s.total_profit, 2),
            "cash_revenue": round(s.cash_revenue, 2),
            "debt_revenue": round(s.debt_revenue, 2),
            "total_expenses": round(s.total_expenses, 2),
            "net_profit": round(s.net_profit, 2),
            "sale_count": s.sale_count,
            "created_at": s.created_at.isoformat()
        }
        for s in snapshots
    ]), 200


# ---------------------------------------------------------------------------
# GET /reports/monthly/compare  – compare two months
# ---------------------------------------------------------------------------
@reports_bp.route("/monthly/compare", methods=["GET"])
@token_required
def compare_months():
    """
    Compare two months.
    Query params: month1=YYYY-MM, month2=YYYY-MM
    """
    month1_str = request.args.get("month1")
    month2_str = request.args.get("month2")

    if not month1_str or not month2_str:
        return jsonify({"error": "month1 and month2 parameters are required"}), 400

    try:
        y1, m1 = [int(x) for x in month1_str.split("-")]
        y2, m2 = [int(x) for x in month2_str.split("-")]
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid month format. Use YYYY-MM"}), 400

    # Get snapshots or calculate on the fly
    snap1 = MonthlySnapshot.query.filter_by(year=y1, month=m1).first()
    snap2 = MonthlySnapshot.query.filter_by(year=y2, month=m2).first()

    # If snapshots don't exist, calculate them
    if not snap1:
        snap1 = save_monthly_snapshot(y1, m1)
    if not snap2:
        snap2 = save_monthly_snapshot(y2, m2)

    # Calculate differences
    revenue_diff = snap2.total_revenue - snap1.total_revenue
    profit_diff = snap2.total_profit - snap1.total_profit
    net_profit_diff = snap2.net_profit - snap1.net_profit

    revenue_pct = (revenue_diff / snap1.total_revenue * 100) if snap1.total_revenue > 0 else 0
    profit_pct = (profit_diff / snap1.total_profit * 100) if snap1.total_profit > 0 else 0

    return jsonify({
        "month1": {
            "month": f"{y1}-{m1:02d}",
            "total_revenue": round(snap1.total_revenue, 2),
            "total_profit": round(snap1.total_profit, 2),
            "net_profit": round(snap1.net_profit, 2),
            "sale_count": snap1.sale_count
        },
        "month2": {
            "month": f"{y2}-{m2:02d}",
            "total_revenue": round(snap2.total_revenue, 2),
            "total_profit": round(snap2.total_profit, 2),
            "net_profit": round(snap2.net_profit, 2),
            "sale_count": snap2.sale_count
        },
        "comparison": {
            "revenue_difference": round(revenue_diff, 2),
            "revenue_percentage_change": round(revenue_pct, 2),
            "profit_difference": round(profit_diff, 2),
            "profit_percentage_change": round(profit_pct, 2),
            "net_profit_difference": round(net_profit_diff, 2)
        }
    }), 200


# ---------------------------------------------------------------------------
# GET /reports/product-performance
# ---------------------------------------------------------------------------
@reports_bp.route("/product-performance", methods=["GET"])
@token_required
def product_performance():
    product_id = request.args.get("product_id", type=int)
    days = request.args.get("days", 30, type=int)

    if not product_id:
        return jsonify({"error": "product_id parameter is required"}), 400

    product = Product.query.get_or_404(product_id)
    end_date = date.today()
    start_date = end_date - timedelta(days=days)

    sales_data = db.session.query(
        func.coalesce(func.sum(Sale.quantity_sold), 0).label("total_quantity"),
        func.coalesce(func.sum(Sale.total_price), 0).label("total_revenue"),
        func.coalesce(func.sum(Sale.profit), 0).label("total_profit"),
        func.count(Sale.id).label("transaction_count")
    ).filter(
        Sale.product_id == product_id,
        db.func.date(Sale.timestamp) >= start_date
    ).first()

    daily_breakdown = db.session.query(
        db.func.date(Sale.timestamp).label("date"),
        func.coalesce(func.sum(Sale.quantity_sold), 0).label("quantity"),
        func.coalesce(func.sum(Sale.total_price), 0).label("revenue"),
        func.coalesce(func.sum(Sale.profit), 0).label("profit")
    ).filter(
        Sale.product_id == product_id,
        db.func.date(Sale.timestamp) >= start_date
    ).group_by(db.func.date(Sale.timestamp)).order_by(db.func.date(Sale.timestamp)).all()

    payment_breakdown = db.session.query(
        Sale.payment_type,
        func.count(Sale.id).label("count"),
        func.sum(Sale.total_price).label("amount")
    ).filter(
        Sale.product_id == product_id,
        db.func.date(Sale.timestamp) >= start_date
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
# GET /reports/top-products
# ---------------------------------------------------------------------------
@reports_bp.route("/top-products", methods=["GET"])
@token_required
def top_products():
    sort_by = request.args.get("sort_by", "quantity")
    limit = request.args.get("limit", 10, type=int)
    days = request.args.get("days", type=int)

    start_date = date.today() - timedelta(days=days) if days else None

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
        query = query.filter(db.func.date(Sale.timestamp) >= start_date)

    query = query.group_by(Product.id, Product.name, Product.selling_price)

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
# GET /reports/dashboard
# ---------------------------------------------------------------------------
@reports_bp.route("/dashboard", methods=["GET"])
@token_required
def dashboard_admin():
    user_role = request.user_payload.get('role') if hasattr(request, 'user_payload') else None

    if user_role != "admin":
        return jsonify({"error": "Forbidden."}), 403

    today = date.today()
    week_start = today - timedelta(days=6)

    today_agg = _sales_aggregates(today, today)
    week_agg = _sales_aggregates(week_start, today)
    today_exp = _expenses_total(today, today)
    week_exp = _expenses_total(week_start, today)

    debt_total = db.session.query(
        func.coalesce(func.sum(Debt.amount), 0.0)
    ).filter(Debt.is_paid == False).scalar() or 0.0

    from flask import current_app
    threshold = current_app.config.get("LOW_STOCK_THRESHOLD", 5)
    low_stock_count = db.session.query(
        func.count(Product.id)
    ).filter(Product.quantity <= threshold).scalar() or 0

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
# GET /reports/notifications
# ---------------------------------------------------------------------------
@reports_bp.route("/notifications", methods=["GET"])
@token_required
def get_notifications():
    user_id = request.user_payload.get('user_id') if hasattr(request, 'user_payload') else None

    notifications = Notification.query.filter(
        (Notification.user_id == user_id) |
        (Notification.user_id == None)
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
# POST /reports/notifications/<id>/read
# ---------------------------------------------------------------------------
@reports_bp.route("/notifications/<int:notif_id>/read", methods=["POST"])
@token_required
def mark_notification_read(notif_id):
    notif = Notification.query.get_or_404(notif_id)
    notif.is_read = True
    db.session.commit()
    return jsonify({"message": "Notification marked as read"}), 200


# ---------------------------------------------------------------------------
# POST /reports/notifications/read-all
# ---------------------------------------------------------------------------
@reports_bp.route("/notifications/read-all", methods=["POST"])
@token_required
def mark_all_notifications_read():
    user_id = request.user_payload.get('user_id') if hasattr(request, 'user_payload') else None

    Notification.query.filter(
        (Notification.user_id == user_id) |
        (Notification.user_id == None)
    ).update({"is_read": True}, synchronize_session=False)
    db.session.commit()
    return jsonify({"message": "All notifications marked as read"}), 200


# ---------------------------------------------------------------------------
# HTML page routes
# ---------------------------------------------------------------------------

@reports_bp.route("/dashboard-page", methods=["GET"])
@token_required
def dashboard_page():
    user_role = request.user_payload.get('role') if hasattr(request, 'user_payload') else None
    if user_role != "admin":
        return {"error": "Forbidden"}, 403
    return ADMIN_DASHBOARD_HTML, 200


@reports_bp.route("/weekly-page", methods=["GET"])
@token_required
def weekly_page():
    return _simple_report_html("Weekly Report", "weekly"), 200


@reports_bp.route("/monthly-page", methods=["GET"])
@token_required
def monthly_page():
    return _simple_report_html("Monthly Report", "monthly"), 200

# ---------------------------------------------------------------------------
# GET /reports/weekly-by-month  – weekly breakdown for a specific month
# ---------------------------------------------------------------------------
@reports_bp.route("/weekly-by-month", methods=["GET"])
@token_required
def weekly_by_month():
    """
    Returns weekly breakdown for a specific month.
    Query params: month=YYYY-MM (default: current month)
    Returns weeks 1, 2, 3, 4 with their totals.
    """
    from calendar import monthrange
    from datetime import date, timedelta

    month_str = request.args.get("month")

    try:
        if month_str:
            year, mon = [int(x) for x in month_str.split("-")]
        else:
            today = date.today()
            year, mon = today.year, today.month

        # Get first and last day of month
        start = date(year, mon, 1)
        last_day = monthrange(year, mon)[1]
        end = date(year, mon, last_day)

    except (ValueError, TypeError):
        today = date.today()
        year, mon = today.year, today.month
        start = date(year, mon, 1)
        last_day = monthrange(year, mon)[1]
        end = date(year, mon, last_day)

    # Calculate week boundaries
    weeks = []

    # Week 1: Days 1-7
    week1_start = start
    week1_end = date(year, mon, min(7, last_day))

    # Week 2: Days 8-14
    week2_start = date(year, mon, 8) if last_day >= 8 else None
    week2_end = date(year, mon, min(14, last_day)) if last_day >= 8 else None

    # Week 3: Days 15-21
    week3_start = date(year, mon, 15) if last_day >= 15 else None
    week3_end = date(year, mon, min(21, last_day)) if last_day >= 15 else None

    # Week 4: Days 22-28
    week4_start = date(year, mon, 22) if last_day >= 22 else None
    week4_end = date(year, mon, min(28, last_day)) if last_day >= 22 else None

    # Week 5: Days 29-end (if exists)
    week5_start = date(year, mon, 29) if last_day >= 29 else None
    week5_end = end if last_day >= 29 else None

    weeks_config = [
        {"week": 1, "start": week1_start, "end": week1_end, "name": "Week 1"},
        {"week": 2, "start": week2_start, "end": week2_end, "name": "Week 2"},
        {"week": 3, "start": week3_start, "end": week3_end, "name": "Week 3"},
        {"week": 4, "start": week4_start, "end": week4_end, "name": "Week 4"},
    ]

    if week5_start:
        weeks_config.append({"week": 5, "start": week5_start, "end": week5_end, "name": "Week 5"})

    weekly_data = []
    for w in weeks_config:
        if w["start"] and w["end"]:
            agg = _sales_aggregates(w["start"], w["end"])
            expenses = _expenses_total(w["start"], w["end"])
            net_profit = round(agg.profit - expenses, 2)

            weekly_data.append({
                "week": w["week"],
                "week_name": w["name"],
                "start": w["start"].isoformat(),
                "end": w["end"].isoformat(),
                "total_revenue": round(agg.revenue, 2),
                "total_profit": round(agg.profit, 2),
                "cash_revenue": round(agg.cash_revenue, 2),
                "debt_revenue": round(agg.debt_revenue, 2),
                "total_expenses": round(expenses, 2),
                "net_profit": net_profit,
                "sale_count": agg.count
            })

    return jsonify({
        "month": f"{year}-{mon:02d}",
        "month_name": date(year, mon, 1).strftime("%B %Y"),
        "weeks": weekly_data
    }), 200


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
        html += '<div class="card"><h3 style="margin-bottom:.75rem">Top 5 Products</h3><td><thead><tr><th>Product</th><th>Units Sold</th><th>Revenue</th><th>Profit</th></tr></thead><tbody>';
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