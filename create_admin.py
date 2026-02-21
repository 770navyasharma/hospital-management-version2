# create_admin.py
from app import create_app, db

app = create_app()

with app.app_context():
    print("Starting script...")
    db.create_all()

    datastore = app.security.datastore

    # 1. Create Roles
    admin_role = datastore.find_or_create_role(name='Admin', description='Administrator')
    datastore.find_or_create_role(name='Doctor', description='Doctor')
    datastore.find_or_create_role(name='Patient', description='Patient')

    # 2. Create Admin User
    admin_email = 'admin@hms.com'
    if not datastore.find_user(email=admin_email):
        # 🟢 FIX: PASS PLAIN TEXT PASSWORD HERE
        datastore.create_user(
            email=admin_email,
            password='admin123', # No utils.hash_password needed!
            full_name='Admin User',
            roles=[admin_role],
            active=True
        )
        db.session.commit()
        print(f"Created admin user: {admin_email}")
    else:
        print(f"Admin user already exists.")