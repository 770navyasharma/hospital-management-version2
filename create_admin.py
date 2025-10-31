# create_admin.py
from app import create_app, db
# --- Update Imports ---
from flask_security import utils

app = create_app()

with app.app_context():
    print("Starting script...")
    
    # Re-create all tables. This is safe since we deleted hospital.db
    db.create_all()
    print("Database tables created.")

    # Get the datastore
    datastore = app.security.datastore

    # 1. Create Roles
    datastore.find_or_create_role(name='Admin', description='Administrator')
    datastore.find_or_create_role(name='Doctor', description='Doctor')
    datastore.find_or_create_role(name='Patient', description='Patient')
    print("Roles created/verified.")

    # 2. Create Admin User
    admin_email = 'admin@hms.com'
    if not datastore.find_user(email=admin_email):
        # Hash the password
        hashed_password = utils.hash_password('admin123')
        
        datastore.create_user(
            email=admin_email,
            password=hashed_password,
            full_name='Admin User',
            roles=['Admin'], # Assign role by name
            active=True
        )
        print(f"Created admin user: {admin_email}")
    else:
        print(f"Admin user '{admin_email}' already exists.")

    # Commit changes
    db.session.commit()
    print("Script finished.")