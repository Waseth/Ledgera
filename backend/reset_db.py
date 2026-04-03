#!/usr/bin/env python
"""
Database Reset Script - Clears all data but keeps structure and admin user
Run: python reset_db.py
"""

from app import create_app, db
from app.models import User, Product, Sale, Debt, Expense, Notification, AuditLog
from werkzeug.security import generate_password_hash

def reset_database():
    app = create_app()

    with app.app_context():
        print("\n" + "=" * 50)
        print("DATABASE RESET IN PROGRESS")
        print("=" * 50)

        # Show counts before deletion
        print("\nRecords before reset:")
        print(f"  Products: {Product.query.count()}")
        print(f"  Sales: {Sale.query.count()}")
        print(f"  Debts: {Debt.query.count()}")
        print(f"  Expenses: {Expense.query.count()}")
        print(f"  Notifications: {Notification.query.count()}")
        print(f"  Audit Logs: {AuditLog.query.count()}")
        print(f"  Shopkeepers: {User.query.filter(User.role == 'shopkeeper').count()}")

        # Clear all data tables (order matters for foreign keys)
        print("\nClearing data...")

        # Delete in correct order to avoid foreign key issues
        AuditLog.query.delete()
        Notification.query.delete()
        Debt.query.delete()
        Expense.query.delete()
        Sale.query.delete()
        Product.query.delete()

        # Delete all shopkeepers (keep admin)
        User.query.filter(User.role != 'admin').delete()

        # Ensure admin user exists with correct credentials
        admin = User.query.filter_by(role='admin').first()
        if not admin:
            admin = User(
                name="Admin",
                email="wasethalice@gmail.com",
                password_hash=generate_password_hash("joynoela@1998"),
                role="admin"
            )
            db.session.add(admin)
        else:
            # Reset admin password
            admin.password_hash = generate_password_hash("joynoela@1998")
            admin.name = "Admin"

        db.session.commit()

        # Show results
        print("\n✅ DATABASE RESET COMPLETE!")
        print("-" * 50)
        print("\nRecords after reset:")
        print(f"  Products: {Product.query.count()}")
        print(f"  Sales: {Sale.query.count()}")
        print(f"  Debts: {Debt.query.count()}")
        print(f"  Expenses: {Expense.query.count()}")
        print(f"  Notifications: {Notification.query.count()}")
        print(f"  Audit Logs: {AuditLog.query.count()}")
        print(f"  Shopkeepers: {User.query.filter(User.role == 'shopkeeper').count()}")

        print("\n👤 Admin User:")
        admin = User.query.filter_by(role='admin').first()
        if admin:
            print(f"  Email: {admin.email}")
            print(f"  Password: joynoela@1998")
            print(f"  Role: {admin.role}")

        print("\n" + "=" * 50)
        print("DATABASE IS NOW CLEAN AND READY FOR THE CLIENT!")
        print("=" * 50 + "\n")

if __name__ == "__main__":
    reset_database()