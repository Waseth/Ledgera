import pymysql
from urllib.parse import urlparse

# Get the connection URL
print("Enter your Railway MySQL connection URL:")
print("(Format: mysql://username:password@host:port/database)")
url_string = input("URL: ").strip()

def migrate():
    conn = None
    try:
        # Parse the URL
        parsed = urlparse(url_string)

        # Connect to MySQL
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

        # Check existing columns
        cursor.execute("""
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'debts'
        """)
        columns = [row[0] for row in cursor.fetchall()]
        print(f"Current columns: {columns}")

        # Add missing columns
        if 'initial_amount' not in columns:
            cursor.execute("ALTER TABLE debts ADD COLUMN initial_amount FLOAT")
            print("✅ Added initial_amount column")
        else:
            print("✅ initial_amount column already exists")

        if 'amount_paid' not in columns:
            cursor.execute("ALTER TABLE debts ADD COLUMN amount_paid FLOAT DEFAULT 0")
            print("✅ Added amount_paid column")
        else:
            print("✅ amount_paid column already exists")

        # Update existing records
        cursor.execute("UPDATE debts SET initial_amount = amount WHERE initial_amount IS NULL")
        updated1 = cursor.rowcount
        cursor.execute("UPDATE debts SET amount_paid = 0 WHERE amount_paid IS NULL")
        updated2 = cursor.rowcount

        conn.commit()
        print(f"✅ Migration completed successfully!")
        print(f"   Updated {updated1} records with initial_amount")
        print(f"   Updated {updated2} records with amount_paid")

        # Verify
        cursor.execute("SELECT COUNT(*) FROM debts WHERE initial_amount IS NULL")
        null_count = cursor.fetchone()[0]
        print(f"✅ Records with NULL initial_amount: {null_count}")

    except Exception as e:
        print(f"❌ Error: {e}")
        if conn:
            conn.rollback()
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    migrate()