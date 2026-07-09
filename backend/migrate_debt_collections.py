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
            # Create debt_collections table
            cursor.execute("""
                CREATE TABLE debt_collections (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    debt_id INT NOT NULL,
                    user_id INT NOT NULL,
                    amount FLOAT NOT NULL,
                    collected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (debt_id) REFERENCES debts(id),
                    FOREIGN KEY (user_id) REFERENCES users(id),
                    INDEX idx_debt_collection_debt (debt_id),
                    INDEX idx_debt_collection_date (collected_at)
                )
            """)
            print("✅ Created debt_collections table")
        else:
            print("✅ debt_collections table already exists")

        conn.commit()
        print("✅ Migration completed successfully!")

    except Exception as e:
        print(f"❌ Error: {e}")
        if conn:
            conn.rollback()
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    migrate()