from app import create_app, db
from app.models import User
from werkzeug.security import generate_password_hash

app = create_app()

with app.app_context():
    # Create all tables
    db.create_all()

    # Check if admin already exists
    admin = User.query.filter_by(email="wasethalice@gmail.com").first()

    if not admin:
        # Create hardcoded admin user
        admin = User(
            name="Alice",
            email="wasethalice@gmail.com",
            password_hash=generate_password_hash("joynoela@1998"),  
            role="admin"
        )
        db.session.add(admin)
        db.session.commit()
        print("Database initialized with admin user")
    else:
        print("Admin user already exists")

    print("Database setup complete!")