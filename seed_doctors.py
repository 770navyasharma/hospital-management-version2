from app import create_app, db
from app.models import User, Doctor, Role, Department
from flask_security.utils import hash_password
import uuid

app = create_app()

DOCTOR_EMAILS = [
    "navyasav06@gmail.com",
    "girishsharmaqea@gmail.com",
    "thebollybeasts@gmail.com",
    "dharmaandyou01@gmail.com",
    "tikkutikki023@gmail.com"
]

def seed_specific_doctors():
    with app.app_context():
        print("Cleaning up old data...")
        from app.models import Appointment, Treatment
        Treatment.query.delete()
        Appointment.query.delete()
        db.session.commit()

        doctor_role = Role.query.filter_by(name='Doctor').first()
        if not doctor_role:
             doctor_role = Role(name='Doctor', description='Doctor')
             db.session.add(doctor_role)
             db.session.commit()

        # Delete existing doctor profiles and users with doctor role
        # Note: We keep admins and patients
        old_doctor_users = User.query.filter(User.roles.contains(doctor_role)).all()
        for du in old_doctor_users:
            if du.doctor_profile:
                db.session.delete(du.doctor_profile)
            db.session.delete(du)
        db.session.commit()

        # Ensure we have a department
        dept = Department.query.first()
        if not dept:
            dept = Department(name="General Medicine", description="Primary Care")
            db.session.add(dept)
            db.session.commit()

        print(f"Adding {len(DOCTOR_EMAILS)} specific doctors...")
        names = ["Dr. Navyasav", "Dr. Girish", "Dr. Bolly", "Dr. Dharma", "Dr. Tikku"]
        
        for email, name in zip(DOCTOR_EMAILS, names):
            user = User(
                email=email,
                password=hash_password("password123"),
                full_name=name,
                active=True,
                confirmed_at=db.func.now()
            )
            user.roles.append(doctor_role)
            db.session.add(user)
            db.session.flush()

            doctor = Doctor(
                user_id=user.id,
                department_id=dept.id,
                phone_number="1234567890",
                bio="Senior Medical Consultant specializing in patient wellness and care.",
                availability={}
            )
            db.session.add(doctor)

        db.session.commit()
        print("Doctor reset complete!")

if __name__ == "__main__":
    seed_specific_doctors()
