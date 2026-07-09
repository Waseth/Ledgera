# migrate_all_existing_debts.py
import pymysql
from urllib.parse import urlparse

print("Enter your Railway MySQL connection URL:")
url_string = input("URL: ").strip()

def migrate_all():
    conn = None
    try:
        parsed = urlparse(url_string)
        conn = pymysql.connect(
            host=parsed.hostname,
            port=parsed.port or 3306,
            database=parsed.path[1:],
            user=parsed.username,
            password=parsed.password,
            charset='utf8mb4'
        )
        cursor = conn.cursor()
        print("✅ Connected to MySQL database")

        # Check how many debts with payments exist
        cursor.execute("""
            SELECT COUNT(*)
            FROM debts
            WHERE amount_paid IS NOT NULL AND amount_paid > 0
        """)
        total_debts_with_payments = cursor.fetchone()[0]
        print(f"\n📊 Total debts with payments: {total_debts_with_payments}")

        # Check current collections
        cursor.execute("SELECT COUNT(*) FROM debt_collections")
        current_collections = cursor.fetchone()[0]
        print(f"📊 Current collections: {current_collections}")

        # Get all debts with payments that don't have collections
        cursor.execute("""
            SELECT d.id, d.amount_paid, d.created_at, d.paid_at, s.user_id, d.is_paid
            FROM debts d
            JOIN sales s ON d.sale_id = s.id
            WHERE d.amount_paid IS NOT NULL AND d.amount_paid > 0
            AND NOT EXISTS (
                SELECT 1 FROM debt_collections dc WHERE dc.debt_id = d.id
            )
        """)
        debts_to_migrate = cursor.fetchall()

        print(f"\n📊 Debts needing migration: {len(debts_to_migrate)}")

        if len(debts_to_migrate) == 0:
            print("✅ All debts already have collection records!")
            return

        created_count = 0
        for debt in debts_to_migrate:
            debt_id, amount_paid, created_at, paid_at, user_id, is_paid = debt

            # Use paid_at if available (for fully paid debts), otherwise use created_at
            collection_date = paid_at if paid_at else created_at

            # Create collection record
            cursor.execute("""
                INSERT INTO debt_collections (debt_id, user_id, amount, collected_at)
                VALUES (%s, %s, %s, %s)
            """, (debt_id, user_id, amount_paid, collection_date))

            created_count += 1
            status = "✅ PAID" if is_paid else "⏳ PARTIAL"
            print(f"{status} Created collection for debt {debt_id}: KSh {amount_paid} on {collection_date}")

        conn.commit()

        print(f"\n✅ Migration completed successfully!")
        print(f"   Created {created_count} collection records")

        # Show final summary
        cursor.execute("SELECT COUNT(*) FROM debt_collections")
        total_collections = cursor.fetchone()[0]
        print(f"   Total debt collections now: {total_collections}")

        # Show debts still without collections (if any)
        cursor.execute("""
            SELECT COUNT(*)
            FROM debts
            WHERE amount_paid IS NOT NULL AND amount_paid > 0
            AND NOT EXISTS (
                SELECT 1 FROM debt_collections dc WHERE dc.debt_id = debts.id
            )
        """)
        still_missing = cursor.fetchone()[0]
        if still_missing > 0:
            print(f"   ⚠️ {still_missing} debts still need collection records (amount_paid might be 0)")

    except Exception as e:
        print(f"❌ Error: {e}")
        if conn:
            conn.rollback()
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    migrate_all()