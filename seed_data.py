import random
import json
import os
from datetime import datetime, date, timedelta
from app import create_app, db
from app.models import User, Role, Department, Doctor, Patient, Appointment, Treatment
from flask_security import utils

# Configuration for the fresh start
ADMIN_EMAIL = 'admin@hms.com'
ADMIN_PASS = 'admin123'
TOTAL_DOCTORS = 8
TOTAL_PATIENTS = 40
TOTAL_APPOINTMENTS = 150

app = create_app()

def cleanup_old_files():
    """Removes the database file and clear uploads folder."""
    db_path = os.path.join(os.path.abspath(os.path.dirname(__file__)), 'hospital.db')
    if os.path.exists(db_path):
        os.remove(db_path)
        print("🗑️ Old database deleted.")
    
    upload_dir = os.path.join(os.path.abspath(os.path.dirname(__file__)), 'app/static/uploads')
    if os.path.exists(upload_dir):
        for f in os.listdir(upload_dir):
            os.remove(os.path.join(upload_dir, f))
        print("📁 Uploads folder cleared.")

def get_random_time_range():
    start_h = random.randint(8, 14)
    end_h = start_h + random.randint(2, 4)
    return f"{start_h:02d}:00-{end_h:02d}:00"

def seed():
    cleanup_old_files()
    
    with app.app_context():
        print("🏗️ Creating new database tables...")
        db.create_all()
        
        datastore = app.security.datastore
        
        # 1. Initialize Roles
        admin_role = datastore.find_or_create_role(name='Admin', description='System Admin')
        doc_role = datastore.find_or_create_role(name='Doctor', description='Medical Professional')
        pat_role = datastore.find_or_create_role(name='Patient', description='Hospital Patient')
        
        # 2. Create Master Admin
        datastore.create_user(
            email=ADMIN_EMAIL,
            password=ADMIN_PASS, # Datastore hashes this automatically
            full_name="Chief Administrator",
            roles=[admin_role],
            active=True
        )
        print(f"👤 Admin created: {ADMIN_EMAIL}")

        # 3. Create Departments
        depts_data = [
            ('Cardiology', 'Heart and blood vessel specialist'),
            ('Neurology', 'Brain and nervous system specialists'),
            ('Pediatrics', 'Care for infants and children'),
            ('Orthopedics', 'Bone and muscular system specialists'),
            ('General Medicine', 'Standard health checkups and consultations'),
            ('Dermatology', 'Skin, hair, and nail specialists')
        ]
        departments = []
        for name, desc in depts_data:
            d = Department(name=name, description=desc)
            db.session.add(d)
            departments.append(d)
        db.session.flush()

        # 4. Create Doctors
        doc_names = [
            "Dr. Sarah Jenkins", "Dr. Robert Chen", "Dr. Michael Ross", 
            "Dr. Elena Rodriguez", "Dr. James Wilson", "Dr. Priya Sharma",
            "Dr. David Miller", "Dr. Linda White"
        ]
        
        doctors = []
        for i in range(TOTAL_DOCTORS):
            gender = "female" if i % 2 == 0 else "male"
            email = f"doctor{i+1}@hms.com"
            user = datastore.create_user(
                email=email,
                password='password123',
                full_name=doc_names[i],
                roles=[doc_role],
                active=True
            )
            
            # Generate Availability JSON for the next 14 days
            avail = {}
            for day_offset in range(14):
                d_str = (date.today() + timedelta(days=day_offset)).isoformat()
                avail[d_str] = [get_random_time_range(), "16:00-19:00"]

            doctor = Doctor(
                user=user,
                department=random.choice(departments),
                phone_number=f"+1-555-010{i}",
                bio=f"Board-certified specialist with over {random.randint(5,20)} years of experience.",
                profile_pic_url=f"https://i.pravatar.cc/150?u={email}",
                availability=avail
            )
            db.session.add(doctor)
            doctors.append(doctor)
        
        print(f"🩺 {TOTAL_DOCTORS} Doctors created with full schedules.")

        # 5. Create Patients
        first_names = ["John", "Emily", "Aiden", "Sophia", "Liam", "Olivia", "Noah", "Emma", "Lucas", "Mia"]
        last_names = ["Doe", "Smith", "Johnson", "Brown", "Taylor", "Miller", "Wilson", "Davis", "Garcia", "Martinez"]
        
        patients = []
        for i in range(TOTAL_PATIENTS):
            email = f"patient{i+1}@example.com"
            name = f"{random.choice(first_names)} {random.choice(last_names)}"
            user = datastore.create_user(
                email=email,
                password='password123',
                full_name=name,
                roles=[pat_role],
                active=True
            )
            
            patient = Patient(
                user=user,
                contact_number=f"+1-555-020{i}",
                gender=random.choice(["Male", "Female", "Other"]),
                date_of_birth=date(1970, 1, 1) + timedelta(days=random.randint(0, 15000)),
                status=random.choice(["New", "Under Treatment", "Recovered"]),
                profile_pic_url=f"https://i.pravatar.cc/150?u={email}",
                medical_history=random.choice(["No major history", "High blood pressure", "Seasonal allergies", "Type 2 Diabetes"])
            )
            db.session.add(patient)
            patients.append(patient)
        
        print(f"👥 {TOTAL_PATIENTS} Patients registered.")

        # 6. Create Appointments (Past & Future)
        statuses = ["Booked", "Completed", "Cancelled"]
        diagnoses = ["Common Cold", "Migraine", "Muscle Strain", "Vitamin Deficiency", "Mild Fever"]
        prescriptions = ["Rest and hydration", "Paracetamol 500mg", "Physiotherapy twice a week", "Multivitamins"]

        for i in range(TOTAL_APPOINTMENTS):
            # Spread appointments from 60 days ago to 30 days in future
            random_days = random.randint(-60, 30)
            appt_date = datetime.now() + timedelta(days=random_days, hours=random.randint(-5, 5))
            
            # Logic for status
            if random_days < 0:
                status = random.choice(["Completed", "Cancelled"])
            else:
                status = "Booked"

            appt = Appointment(
                patient=random.choice(patients),
                doctor=random.choice(doctors),
                appointment_datetime=appt_date,
                status=status
            )
            db.session.add(appt)
            
            if status == "Completed":
                db.session.flush() # Get Appt ID
                t = Treatment(
                    appointment_id=appt.id,
                    diagnosis=random.choice(diagnoses),
                    prescription=random.choice(prescriptions),
                    notes="Patient followed up well."
                )
                db.session.add(t)

        db.session.commit()
        print(f"📅 {TOTAL_APPOINTMENTS} Appointments generated.")
        print("\n✨ SYSTEM REFRESH COMPLETE! ✨")
        print(f"Login at /login with: {ADMIN_EMAIL} / {ADMIN_PASS}")

if __name__ == "__main__":
    seed()