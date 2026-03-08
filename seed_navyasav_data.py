from app import create_app, db
from app.models import User, Doctor, Patient, Appointment, Treatment, Role
from flask_security.utils import hash_password
from datetime import datetime, timedelta, date as pydate
import random

app = create_app()

def seed_navyasav_data():
    with app.app_context():
        print("--- STARTING SMART SEEDING FOR DR. NAVYASAV ---")
        
        # 1. Get Dr. Navyasav
        target_email = 'navyasav06@gmail.com'
        doctor_user = User.query.filter_by(email=target_email).first()
        if not doctor_user:
            print(f"Error: Doctor with email {target_email} not found!")
            return
        
        doctor = doctor_user.doctor_profile
        doctor_id = doctor.id
        now = datetime.now()

        # 2. Set Availability (09:00-13:00 and 14:00-19:00)
        availability = {}
        for d in range(-2, 8):
            dt = (now + timedelta(days=d)).strftime('%Y-%m-%d')
            availability[dt] = ["09:00-13:00", "14:00-19:00"]
        doctor.availability = availability
        db.session.commit()

        # 3. Clear existing appointments for THIS doctor specifically
        appts = Appointment.query.filter_by(doctor_id=doctor_id).all()
        for a in appts:
            if a.treatment:
                db.session.delete(a.treatment)
            db.session.delete(a)
        db.session.commit()
        
        patient_role = Role.query.filter_by(name='Patient').first()

        names = [
            "Aarav Sharma", "Ishani Kapoor", "Vivian Wright", "Marcus Thorne", 
            "Elena Gilbert", "Damon Salvatore", "Bonnie Bennett", "Caroline Forbes",
            "Tyler Lockwood", "Alaric Saltzman", "Jeremy Gilbert", "Jenna Sommers",
            "Klaus Mikaelson", "Elijah Mikaelson", "Rebekah Mikaelson"
        ]
        
        genders = ["Male", "Female", "Other", "Male", "Female", "Male", "Female", "Female", "Male", "Male", "Male", "Female", "Male", "Male", "Female"]
        p_data = []
        for i in range(len(names)):
            p_data.append({
                "name": names[i],
                "gender": genders[i],
                "dob": pydate(random.randint(1975, 2005), random.randint(1, 12), random.randint(1, 28)),
                "history": random.choice([
                    "History of seasonal allergies.", "Type 1 Diabetes since childhood.", "Chronic migraine sufferer.", 
                    "Post-surgery recovery (ACL).", "Mild asthma, smokers history.", "Anxiety and high stress levels.",
                    "No significant medical history.", "Lactose intolerant, sensitive stomach."
                ])
            })

        payment_methods = ["Cash", "Insurance", "UPI", "Credit Card", "Bank Transfer"]
        payment_statuses = ["Paid", "Pending", "Partially Paid"]
        realistic_cases = [
            {"prob": "Acute Bronchitis", "diag": "Inflammation of the bronchial tubes.", "presc": "Cough syrup, Albuterol.", "notes": "Steam inhalation recommended."},
            {"prob": "Migraine Episode", "diag": "Severe primary headache disorder.", "presc": "Sumatriptan 50mg, Ibuprofen 400mg.", "notes": "Rest in a dark room."},
            {"prob": "Food Poisoning", "diag": "Infection caused by contaminated food.", "presc": "Probiotics, Electrolytes.", "notes": "BRAT diet for 24 hours."},
            {"prob": "Hypertension Check", "diag": "Routine monitoring of BP.", "presc": "Amlodipine 5mg.", "notes": "Salt intake reduction advised."},
            {"prob": "Sprained Ankle", "diag": "Inversion injury of the lateral ligament.", "presc": "RICE method, Painkillers.", "notes": "Use crutches for 3 days."}
        ]

        def get_valid_hour():
            # Explicitly avoid 13:00-14:00
            if random.random() > 0.5:
                return random.randint(9, 12)
            else:
                return random.randint(14, 18)

        for i, info in enumerate(p_data):
            email = info["name"].lower().replace(" ", ".") + "@seed.com"
            user = User.query.filter_by(email=email).first()
            if not user:
                user = User(email=email, password=hash_password("password"), full_name=info["name"], active=True)
                user.roles.append(patient_role)
                db.session.add(user)
                db.session.flush()
            
            patient = Patient.query.filter_by(user_id=user.id).first()
            if not patient:
                pic = f"https://i.pravatar.cc/150?u={info['name'].split()[0].lower()}"
                patient = Patient(user_id=user.id, gender=info["gender"], date_of_birth=info["dob"], medical_history=info["history"], profile_pic_url=pic)
                db.session.add(patient)
                db.session.flush()

            # Past Visits
            for j in range(random.randint(2, 4)):
                case = random.choice(realistic_cases)
                past_dt = now - timedelta(days=random.randint(10, 100), hours=random.randint(1, 8))
                appt = Appointment(
                    patient_id=patient.id, doctor_id=doctor_id, appointment_datetime=past_dt, 
                    status='Completed', payment_method=random.choice(payment_methods),
                    payment_status='Paid', amount=random.randint(500, 2500)
                )
                db.session.add(appt)
                db.session.flush()
                db.session.add(Treatment(appointment_id=appt.id, diagnosis=case["diag"], prescription=case["presc"], notes=case["notes"]))

            # Current/Future Appointments (Strictly in slots)
            if i % 3 == 0: 
                hour = get_valid_hour()
                appt_dt = now.replace(hour=hour, minute=random.choice([0, 30]), second=0, microsecond=0)
                status = 'Ongoing' if i == 0 else 'Booked'
                appt = Appointment(
                    patient_id=patient.id, doctor_id=doctor_id, appointment_datetime=appt_dt,
                    status=status, payment_method=random.choice(payment_methods),
                    payment_status=random.choice(payment_statuses), amount=random.randint(800, 3000)
                )
                db.session.add(appt)
            elif i % 5 == 0: 
                # Ensure urgent doesn't fall in break
                hour = get_valid_hour()
                appt_dt = now.replace(hour=hour, minute=45, second=0, microsecond=0)
                db.session.add(Appointment(
                    patient_id=patient.id, doctor_id=doctor_id, 
                    appointment_datetime=appt_dt, status='Requested', 
                    is_urgent=True, urgent_note=f"Emergency: {info['history']}",
                    amount=1500, payment_status='Pending'
                ))
            else: 
                target_day = now + timedelta(days=random.randint(1, 3))
                hour = get_valid_hour()
                appt_dt = target_day.replace(hour=hour, minute=0, second=0, microsecond=0)
                db.session.add(Appointment(
                    patient_id=patient.id, doctor_id=doctor_id, 
                    appointment_datetime=appt_dt, status='Requested',
                    amount=1200, payment_status='Pending', payment_method=random.choice(payment_methods)
                ))

        db.session.commit()
        print("--- SMART SEEDING COMPLETE FOR DR. NAVYASAV ---")

if __name__ == "__main__":
    seed_navyasav_data()
