from app import create_app, db
from app.models import User, Doctor, Patient, Appointment, Treatment, Role, Department
from flask_security.utils import hash_password
from datetime import datetime, timedelta, date as pydate
import random

app = create_app()

def seed_realistic_data():
    with app.app_context():
        print("--- STARTING REALISTIC DATA SEEDING ---")

        doctor_user = User.query.filter_by(email='elena.rodriguez@hospital.com').first()
        if not doctor_user:
            print("Dr. Elena not found! Run main seeder first.")
            return
        
        doctor = doctor_user.doctor_profile
        doctor_id = doctor.id
        now = datetime.now()

        availability = {}
        for d in range(-1, 7):
            dt = (now + timedelta(days=d)).strftime('%Y-%m-%d')
            availability[dt] = ["09:00-13:00", "14:00-18:00"]
        doctor.availability = availability
        db.session.commit()

        print("Cleaning up existing patient data...")
        Treatment.query.delete()
        Appointment.query.delete()
        Patient.query.delete()
        
        patient_role = Role.query.filter_by(name='Patient').first()
        if patient_role:

            patient_users = User.query.filter(User.roles.contains(patient_role)).all()
            for u in patient_users:
                db.session.delete(u)
        db.session.commit()

        patient_data = [
            {"name": "Sarah Jenkins", "gender": "Female", "dob": pydate(1985, 5, 12), "history": "Chronic migraines, mild hypertension."},
            {"name": "Robert Miller", "gender": "Male", "dob": pydate(1972, 11, 28), "history": "Type 2 Diabetes, history of knee surgery (2018)."},
            {"name": "Emily Chen", "gender": "Female", "dob": pydate(1998, 3, 15), "history": "Seasonal allergies, otherwise healthy."},
            {"name": "Michael Ross", "gender": "Male", "dob": pydate(1960, 8, 4), "history": "High cholesterol, recent complaints of lower back pain."},
            {"name": "Anita Gupta", "gender": "Female", "dob": pydate(1992, 12, 10), "history": "Polycystic Ovary Syndrome (PCOS)."},
            {"name": "David Wilson", "gender": "Male", "dob": pydate(1988, 7, 22), "history": "Asthma (well-controlled), sensitive skin."},
            {"name": "Linda Thompson", "gender": "Female", "dob": pydate(1955, 1, 30), "history": "Osteoarthritis, early-stage glaucoma."},
            {"name": "James O'Connor", "gender": "Male", "dob": pydate(1982, 9, 14), "history": "No major chronic illnesses, smoker."},
            {"name": "Sophia Martinez", "gender": "Female", "dob": pydate(2003, 4, 3), "history": "Anxiety disorder, history of iron deficiency."},
            {"name": "Kevin Lee", "gender": "Male", "dob": pydate(1978, 2, 19), "history": "Gastroesophageal reflux disease (GERD)."},
            {"name": "Monica Geller", "gender": "Female", "dob": pydate(1990, 5, 5), "history": "Chronic stress, OCD tendencies."},
            {"name": "Chandler Bing", "gender": "Male", "dob": pydate(1989, 4, 8), "history": "Quirky sense of humor, history of smoking."},
            {"name": "Joey Tribbiani", "gender": "Male", "dob": pydate(1991, 1, 9), "history": "High appetite, mild digestive issues."},
            {"name": "Rachel Green", "gender": "Female", "dob": pydate(1992, 2, 11), "history": "Fashion-related stress, seasonal flu."},
            {"name": "Ross Geller", "gender": "Male", "dob": pydate(1988, 10, 18), "history": "Paleontology related posture issues."}
        ]

        pics = [f"https://i.pravatar.cc/150?u={p['name'].split()[0].lower()}" for p in patient_data]

        realistic_cases = [
            {"prob": "Acute Sinusitis", "diag": "Inflammation of the paranasal sinuses due to viral infection.", "presc": "Amoxicillin 500mg, Naproxen 250mg, Saline Nasal Spray.", "notes": "Patient should rest and stay hydrated."},
            {"prob": "Lumbar Strain", "diag": "Muscular strain in the lower back area.", "presc": "Cyclobenzaprine 5mg, Ibuprofen 600mg.", "notes": "Avoid heavy lifting for 2 weeks."},
            {"prob": "Type 2 Diabetes", "diag": "Consistent hyperglycemia, HbA1c at 7.2%.", "presc": "Metformin 500mg (twice daily).", "notes": "Low-carb diet reinforced."},
            {"prob": "Gastroenteritis", "diag": "Viral infection of the stomach and intestines.", "presc": "Ondansetron 4mg, ORS.", "notes": "Bland diet for 48 hours."},
            {"prob": "Hypertensive Crisis", "diag": "Sudden spike in blood pressure (180/120).", "presc": "Lisinopril 20mg.", "notes": "Weekly BP monitoring required."}
        ]

        for i, p_info in enumerate(patient_data):
            email = p_info["name"].lower().replace(" ", ".") + "@example.com"
            user = User(email=email, password=hash_password("password"), full_name=p_info["name"], active=True)
            user.roles.append(patient_role)
            db.session.add(user)
            db.session.flush()

            patient = Patient(user_id=user.id, gender=p_info["gender"], date_of_birth=p_info["dob"], medical_history=p_info["history"], profile_pic_url=pics[i])
            db.session.add(patient)
            db.session.flush()

            case = random.choice(realistic_cases)
            for j in range(4):
                past_dt = now - timedelta(days=random.randint(5, 30) + (j * 15), hours=random.randint(9, 17))
                appt = Appointment(patient_id=patient.id, doctor_id=doctor_id, appointment_datetime=past_dt, status='Completed')
                db.session.add(appt)
                db.session.flush()
                db.session.add(Treatment(appointment_id=appt.id, diagnosis=case["diag"], prescription=case["presc"], notes=case["notes"]))

            if i < 4:
                appt_dt = now + timedelta(minutes=random.randint(5, 30))
                db.session.add(Appointment(
                    patient_id=patient.id, doctor_id=doctor_id, 
                    appointment_datetime=appt_dt, status='Requested', 
                    is_urgent=True, urgent_note=f"Emergency: {p_info['history']}"
                ))
            else:
                target_day = now + timedelta(days=random.randint(1, 2))
                hour = 10 if random.random() > 0.5 else 15
                appt_dt = target_day.replace(hour=hour, minute=30, second=0, microsecond=0)
                db.session.add(Appointment(
                    patient_id=patient.id, doctor_id=doctor_id, 
                    appointment_datetime=appt_dt, status='Requested', 
                    is_urgent=False, urgent_note="Regular consultation."
                ))

        db.session.commit()
        print("--- SEEDING COMPLETE ---")

        db.session.commit()
        print("--- SEEDING COMPLETE: 10 PATIENTS CREATED WITH RICH HISTORY ---")

if __name__ == "__main__":
    seed_realistic_data()
