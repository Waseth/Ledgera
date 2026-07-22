# migrate_sales_reversal.py
from app import create_app
from app.extensions import db
from sqlalchemy import text
import os

# Set admin password if not already set
if not os.environ.get('ADMIN_PASSWORD'):
    os.environ['ADMIN_PASSWORD'] = 'test123'

def migrate():
    app = create_app()
    with app.app_context():
        try:
            # Add columns if they don't exist
            inspector = db.inspect(db.engine)
            columns = [col['name'] for col in inspector.get_columns('sales')]

            if 'is_reversed' not in columns:
                db.session.execute(text('ALTER TABLE sales ADD COLUMN is_reversed BOOLEAN DEFAULT FALSE'))
                print("✅ Added is_reversed column")

            if 'reversed_at' not in columns:
                db.session.execute(text('ALTER TABLE sales ADD COLUMN reversed_at DATETIME'))
                print("✅ Added reversed_at column")

            if 'reversed_by' not in columns:
                db.session.execute(text('ALTER TABLE sales ADD COLUMN reversed_by INT'))
                print("✅ Added reversed_by column")

            if 'reversal_reason' not in columns:
                db.session.execute(text('ALTER TABLE sales ADD COLUMN reversal_reason VARCHAR(200)'))
                print("✅ Added reversal_reason column")

            # Add index
            try:
                db.session.execute(text('CREATE INDEX idx_sales_reversed ON sales (is_reversed)'))
                print("✅ Added index")
            except Exception as e:
                if 'Duplicate' in str(e) or 'already exists' in str(e):
                    print("ℹ️ Index already exists")
                else:
                    raise

            db.session.commit()
            print("✅ Migration completed successfully!")

            # Verify
            inspector = db.inspect(db.engine)
            columns = [col['name'] for col in inspector.get_columns('sales')]
            print(f"\nUpdated columns: {columns}")

        except Exception as e:
            print(f"❌ Error: {e}")
            db.session.rollback()

if __name__ == "__main__":
    migrate()