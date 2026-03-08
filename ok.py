import sys
from datetime import datetime, timedelta
from app import create_app, db
from app.models import User, Doctor, Patient, Appointment, Role

app = create_app()

def seed_data():
    with app.app_context():
        print("🌱 Seeding realistic data for today...")
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        
        # 1. Get all doctors and some patients
        doctors = Doctor.query.all()
        patients = Patient.query.limit(10).all()
        
        if not doctors or not patients:
            print("❌ Error: No doctors or patients found. Run create_admin.py first.")
            return

        # 2. Create Today's Appointments
        for i, doc in enumerate(doctors):
            # Create a "Completed" appointment (for the chart)
            db.session.add(Appointment(
                doctor_id=doc.id,
                patient_id=patients[0].id,
                appointment_datetime=today + timedelta(hours=9),
                status='Completed'
            ))
            
            # Create an "Ongoing" appointment
            db.session.add(Appointment(
                doctor_id=doc.id,
                patient_id=patients[1].id,
                appointment_datetime=today + timedelta(hours=10),
                status='Ongoing'
            ))

            # Create an "Emergency" Request (for the Request Queue)
            db.session.add(Appointment(
                doctor_id=doc.id,
                patient_id=patients[2].id,
                appointment_datetime=today + timedelta(hours=15),
                status='Requested',
                is_urgent=True,
                urgent_note="High fever and severe chest pain."
            ))

            # Create a "Regular" Request
            db.session.add(Appointment(
                doctor_id=doc.id,
                patient_id=patients[3].id,
                appointment_datetime=today + timedelta(hours=16),
                status='Requested',
                is_urgent=False,
                urgent_note="Routine monthly checkup."
            ))

        db.session.commit()
        print("✅ Seeding complete. Dashboard should now show real data!")

if __name__ == "__main__":
    seed_data()