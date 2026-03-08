from app import create_app, db
from app.models import User, Doctor, Patient, Appointment
from datetime import datetime, timedelta
import random

app = create_app()

def reset_and_seed():
    with app.app_context():
        # 1. WIPE ALL APPOINTMENTS
        print("Wiping existing appointments...")
        Appointment.query.delete()
        db.session.commit()

        # 2. Find Dr. Elena
        doctor_user = User.query.filter_by(email='elena.rodriguez@hospital.com').first()
        if not doctor_user:
            print("Dr. Elena not found! Run your main seed script first.")
            return
        doctor_id = doctor_user.doctor_profile.id
        now = datetime.now()

        # 3. Create 50 Realistic Requests
        print("Generating 50 realistic future requests...")
        reasons = [
            "Chest pain during exercise", "Routine checkup", "High blood pressure follow-up",
            "Shortness of breath", "Palpitations", "Family history of heart disease",
            "Cholesterol review", "Arrhythmia concerns", "Post-surgery check"
        ]

        for i in range(1, 51):
            email = f"tester_patient_{i}@med.com"
            u = User.query.filter_by(email=email).first()
            if not u:
                u = User(email=email, full_name=f"Patient Case #{i:02d}", password="pw", active=True)
                db.session.add(u); db.session.commit()
            
            p = Patient.query.filter_by(user_id=u.id).first()
            if not p:
                p = Patient(user_id=u.id, status=random.choice(['New', 'Returning']))
                db.session.add(p); db.session.commit()

            # Spread requests over the next 2 days starting 30 mins from now
            requested_time = now + timedelta(minutes=30 + (i * 20))
            
            db.session.add(Appointment(
                patient_id=p.id,
                doctor_id=doctor_id,
                appointment_datetime=requested_time,
                status='Requested',
                is_urgent=(i <= 5), # First 5 are urgent
                urgent_note=random.choice(reasons)
            ))

        db.session.commit()
        print("Successfully seeded 50 requests. Your dashboard is ready for testing!")

if __name__ == "__main__":
    reset_and_seed()