import sqlite3

def migrate():
    conn = None
    try:
        conn = sqlite3.connect('ledgera.db')
        cursor = conn.cursor()


        cursor.execute("PRAGMA table_info(debts)")
        columns = [col[1] for col in cursor.fetchall()]
        print("Current columns in debts table:", columns)


        if 'initial_amount' not in columns:
            cursor.execute("ALTER TABLE debts ADD COLUMN initial_amount FLOAT")
            print("Added initial_amount column")
        else:
            print("initial_amount column already exists")

        if 'amount_paid' not in columns:
            cursor.execute("ALTER TABLE debts ADD COLUMN amount_paid FLOAT DEFAULT 0")
            print("Added amount_paid column")
        else:
            print("amount_paid column already exists")

        conn.commit()
        print("Migration completed successfully!")

    except Exception as e:
        print(f"Error: {e}")
        if conn:
            conn.rollback()
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    migrate()