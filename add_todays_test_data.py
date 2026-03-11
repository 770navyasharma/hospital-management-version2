import os
from datetime import datetime, timedelta
from app import create_app, db
from app.models import User, Patient, Doctor, Appointment, Role

def add_test_data():
    app = create_app()
    with app.app_context():
        # Get a doctor to assign to
        doctor = Doctor.query.first()
        if not doctor:
            print("No doctor found. Please create a doctor first.")
            return

        # Create or fetch roles
        patient_role = Role.query.filter_by(name='Patient').first()
        if not patient_role:
            patient_role = Role(name='Patient')
            db.session.add(patient_role)
            db.session.commit()

        today = datetime.now()
        
        # Helper to create patient if doesn't exist
        def get_or_create_patient(email, full_name):
            user = User.query.filter_by(email=email).first()
            if not user:
                from flask_security.utils import hash_password
                user = User(email=email, full_name=full_name, password=hash_password('password123'), active=True)
                user.roles.append(patient_role)
                db.session.add(user)
                db.session.commit()
            
            if user.full_name != full_name:
                user.full_name = full_name
                db.session.commit()
            
            patient = Patient.query.filter_by(user_id=user.id).first()
            if not patient:
                patient = Patient(user_id=user.id, contact_number="1234567890", gender="Male", date_of_birth=datetime(1990, 1, 1).date())
                db.session.add(patient)
                db.session.commit()
            return patient

        # 1. Test Patient 1 (John Doe)
        p1 = get_or_create_patient("test_patient1@hms.com", "John Doe")
        a1 = Appointment(
            patient_id=p1.id,
            doctor_id=doctor.id,
            appointment_datetime=today + timedelta(hours=1),
            status='Requested',
            is_urgent=False
        )
        db.session.add(a1)

        # 2. Test Patient 2 (Jane Smith)
        p2 = get_or_create_patient("test_patient2@hms.com", "Jane Smith")
        a2 = Appointment(
            patient_id=p2.id,
            doctor_id=doctor.id,
            appointment_datetime=today + timedelta(hours=2),
            status='Requested',
            is_urgent=False
        )
        db.session.add(a2)

        # 3. Test Patient 3 (Alex Hunter)
        p3 = get_or_create_patient("test_patient3@hms.com", "Alex Hunter")
        a3 = Appointment(
            patient_id=p3.id,
            doctor_id=doctor.id,
            appointment_datetime=today + timedelta(minutes=30),
            status='Requested',
            is_urgent=True,
            urgent_note="Severe chest pain and shortness of breath."
        )
        db.session.add(a3)

        db.session.commit()
        print(f"Added 3 appointments for today ({today.strftime('%Y-%m-%d')}) for Doctor {doctor.user.full_name}")

if __name__ == "__main__":
    add_test_data()
