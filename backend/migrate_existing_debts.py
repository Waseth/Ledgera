# migrate_existing_debts.py
import pymysql
from urllib.parse import urlparse

print("Enter your Railway MySQL connection URL:")
url_string = input("URL: ").strip()

def migrate():
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

        # Check if debt_collections table exists
        cursor.execute("""
            SELECT TABLE_NAME
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_NAME = 'debt_collections'
        """)
        exists = cursor.fetchone()

        if not exists:
            print("❌ debt_collections table doesn't exist. Run migrate_debt_collections.py first.")
            return

        # For each debt that has amount_paid > 0, create a collection record
        cursor.execute("""
            SELECT id, amount_paid, created_at, sale_id
            FROM debts
            WHERE amount_paid IS NOT NULL AND amount_paid > 0
        """)
        debts_with_payments = cursor.fetchall()

        print(f"Found {len(debts_with_payments)} debts with payments")

        for debt in debts_with_payments:
            debt_id, amount_paid, created_at, sale_id = debt

            # Get user_id from the sale
            cursor.execute("SELECT user_id FROM sales WHERE id = %s", (sale_id,))
            sale = cursor.fetchone()
            if not sale:
                print(f"⚠️ Sale not found for debt {debt_id}, skipping...")
                continue

            user_id = sale[0]

            # Check if collection already exists
            cursor.execute(
                "SELECT id FROM debt_collections WHERE debt_id = %s",
                (debt_id,)
            )
            existing = cursor.fetchone()

            if not existing:
                # Create collection record
                cursor.execute("""
                    INSERT INTO debt_collections (debt_id, user_id, amount, collected_at)
                    VALUES (%s, %s, %s, %s)
                """, (debt_id, user_id, amount_paid, created_at))
                print(f"✅ Created collection for debt {debt_id}: KSh {amount_paid}")
            else:
                print(f"⏭️ Collection already exists for debt {debt_id}")

        conn.commit()
        print("✅ Migration completed successfully!")

        # Show summary
        cursor.execute("SELECT COUNT(*) FROM debt_collections")
        total_collections = cursor.fetchone()[0]
        print(f"Total debt collections in system: {total_collections}")

    except Exception as e:
        print(f"❌ Error: {e}")
        if conn:
            conn.rollback()
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    migrate()