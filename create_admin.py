# create_admin.py
from app import create_app, db
from app.models import User, Role
from flask_bcrypt import Bcrypt

app = create_app()
bcrypt = Bcrypt(app)

with app.app_context():
    print("Starting script...")

    # 1. Create Roles
    role_admin = Role.query.filter_by(name='Admin').first()
    if not role_admin:
        role_admin = Role(name='Admin', description='Administrator')
        db.session.add(role_admin)
        print("Created 'Admin' role.")

    role_doctor = Role.query.filter_by(name='Doctor').first()
    if not role_doctor:
        role_doctor = Role(name='Doctor', description='Doctor')
        db.session.add(role_doctor)
        print("Created 'Doctor' role.")

    role_patient = Role.query.filter_by(name='Patient').first()
    if not role_patient:
        role_patient = Role(name='Patient', description='Patient')
        db.session.add(role_patient)
        print("Created 'Patient' role.")

    # 2. Create Admin User
    admin_email = 'admin@hms.com'
    admin_user = User.query.filter_by(email=admin_email).first()

    if not admin_user:
        # Hash the password
        hashed_password = bcrypt.generate_password_hash('admin123').decode('utf-8')

        admin_user = User(
            email=admin_email,
            password=hashed_password,
            full_name='Admin User',
            active=True
        )

        # Assign the 'Admin' role
        admin_user.roles.append(role_admin)

        db.session.add(admin_user)
        print(f"Created admin user: {admin_email}")

    else:
        print(f"Admin user '{admin_email}' already exists.")

    # Commit changes
    db.session.commit()
    print("Script finished.")