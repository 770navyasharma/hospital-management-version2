# app/routes.py
from flask import Blueprint, render_template, redirect, url_for, request, flash, current_app
from flask_security import login_required, roles_required, current_user, utils
from .models import db, Patient, Role, Doctor, Appointment, Department, User
from . import datastore 
from functools import wraps
import json 
import os
from werkzeug.utils import secure_filename

main = Blueprint('main', __name__)

# --- Helper function for file uploads ---
def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in current_app.config['ALLOWED_EXTENSIONS']

# --- Decorator (no change) ---
def prevent_logged_in_access(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if current_user.is_authenticated:
            return redirect(url_for('main.dashboard'))
        return f(*args, **kwargs)
    return decorated_function

# --- Public Routes (no change) ---
@main.route('/')
@prevent_logged_in_access
def index():
    return render_template('index.html')

@main.route('/patient-register', methods=['GET', 'POST'])
@prevent_logged_in_access
def patient_register():
    if request.method == 'POST':
        full_name = request.form.get('full_name')
        email = request.form.get('email')
        contact_number = request.form.get('contact_number')
        password = request.form.get('password')

        if not all([full_name, email, contact_number, password]):
            return render_template('patient_register.html', error="All fields are required")

        if datastore.find_user(email=email):
            return render_template('patient_register.html', error="User already exists")

        hashed_password = utils.hash_password(password)
        patient_role = datastore.find_or_create_role(name='Patient', description='Patient')

        user = datastore.create_user(
            email=email,
            password=hashed_password,
            full_name=full_name,
            roles=[patient_role],
            active=True
        )
        
        patient_profile = Patient(
            user=user,
            contact_number=contact_number
        )
        db.session.add(patient_profile)
        db.session.commit()

        utils.login_user(user)
        return redirect(url_for('main.dashboard'))

    return render_template('patient_register.html')

# --- Main Dashboard Redirector (no change) ---
@main.route('/dashboard')
@login_required
def dashboard():
    if current_user.has_role('Admin'):
        return redirect(url_for('main.admin_dashboard'))
    elif current_user.has_role('Doctor'):
        return redirect(url_for('main.doctor_dashboard'))
    elif current_user.has_role('Patient'):
        return redirect(url_for('main.patient_dashboard'))
    else:
        return redirect(url_for('security.logout'))

# =========================
# === ADMIN ROUTES ===
# =========================

@main.route('/admin/dashboard')
@login_required
@roles_required('Admin')
def admin_dashboard():
    patient_count = Patient.query.count()
    doctor_count = Doctor.query.count()
    appointment_count = Appointment.query.count()
    
    return render_template(
        'admin_dashboard.html',
        patient_count=patient_count,
        doctor_count=doctor_count,
        appointment_count=appointment_count
    )

@main.route('/admin/doctors', methods=['GET'])
@login_required
@roles_required('Admin')
def admin_doctors():
    search_name = request.args.get('name')
    search_spec = request.args.get('specialization')
    
    query = Doctor.query.join(User, Doctor.user_id == User.id).join(Department, Doctor.department_id == Department.id)
    
    if search_name:
        query = query.filter(User.full_name.ilike(f'%{search_name}%'))
    if search_spec:
        query = query.filter(Department.name.ilike(f'%{search_spec}%'))
        
    doctors = query.all()
    departments = Department.query.all()
    
    return render_template('admin/admin_doctors.html', doctors=doctors, departments=departments)

@main.route('/admin/doctor/add', methods=['POST'])
@login_required
@roles_required('Admin')
def admin_add_doctor():
    try:
        full_name = request.form.get('full_name')
        email = request.form.get('email')
        password = request.form.get('password')
        department_id = request.form.get('department_id')
        phone_number = request.form.get('phone_number')
        bio = request.form.get('bio')
        availability_str = (request.form.get('availability') or '').strip()

        profile_pic = request.files.get('profile_pic')
        profile_pic_path = url_for('static', filename='images/default-profile.svg')

        if datastore.find_user(email=email):
            flash('Email already exists.', 'danger')
            return redirect(url_for('main.admin_doctors'))

        if profile_pic and allowed_file(profile_pic.filename):
            filename = secure_filename(profile_pic.filename)
            upload_path = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
            profile_pic.save(upload_path)
            profile_pic_path = f'/static/uploads/{filename}'

        hashed_password = utils.hash_password(password)
        doctor_role = datastore.find_or_create_role(name='Doctor', description='Doctor')
        user = datastore.create_user(
            email=email, password=hashed_password, full_name=full_name,
            roles=[doctor_role], active=True
        )

        # 🩵 JSON Handling Fix
        availability_json = None
        if availability_str:
            try:
                availability_json = json.loads(availability_str)
                if not isinstance(availability_json, dict):
                    flash('Availability must be a valid JSON object.', 'warning')
                    availability_json = None
            except json.JSONDecodeError:
                flash('Invalid JSON format for availability. Doctor added without it.', 'warning')

        new_doctor = Doctor(
            user=user,
            department_id=department_id,
            phone_number=phone_number,
            bio=bio,
            profile_pic_url=profile_pic_path,
            availability=availability_json
        )

        db.session.add(new_doctor)
        db.session.commit()
        flash('Doctor profile created successfully.', 'success')
    except Exception as e:
        db.session.rollback()
        flash(f'Error creating doctor: {e}', 'danger')

    return redirect(url_for('main.admin_doctors'))


@main.route('/admin/doctor/edit/<int:doctor_id>', methods=['POST'])
@login_required
@roles_required('Admin')
def admin_edit_doctor(doctor_id):
    try:
        doctor = Doctor.query.get_or_404(doctor_id)
        doctor.user.full_name = request.form.get('full_name')
        doctor.user.email = request.form.get('email')
        doctor.user.active = (request.form.get('status') == 'active')
        doctor.phone_number = request.form.get('phone_number')
        doctor.department_id = request.form.get('department_id')
        doctor.bio = request.form.get('bio')

        profile_pic = request.files.get('profile_pic')
        if profile_pic and allowed_file(profile_pic.filename):
            filename = secure_filename(profile_pic.filename)
            upload_path = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
            profile_pic.save(upload_path)
            doctor.profile_pic_url = f'/static/uploads/{filename}'

        availability_str = (request.form.get('availability') or '').strip()
        if availability_str == '':
            doctor.availability = None
        else:
            try:
                parsed = json.loads(availability_str)
                if isinstance(parsed, dict):
                    doctor.availability = parsed
                else:
                    flash('Availability must be a JSON object.', 'warning')
            except json.JSONDecodeError:
                flash('Invalid JSON format. Availability not updated.', 'danger')

        db.session.commit()
        flash(f"Dr. {doctor.user.full_name}'s profile updated successfully.", 'success')
    except Exception as e:
        db.session.rollback()
        flash(f'Error updating doctor: {e}', 'danger')

    return redirect(url_for('main.admin_doctors'))
# --- (Blacklist, Delete, Department routes are unchanged) ---
@main.route('/admin/user/toggle_blacklist/<int:user_id>', methods=['POST'])
@login_required
@roles_required('Admin')
def admin_toggle_blacklist(user_id):
    user = User.query.get(user_id)
    if user:
        user.active = not user.active
        db.session.commit()
        status = "re-activated" if user.active else "blacklisted"
        flash(f'User {user.full_name} has been {status}.', 'success')
    else:
        flash('User not found.', 'danger')
    return redirect(url_for('main.admin_doctors'))

@main.route('/admin/doctor/delete/<int:doctor_id>', methods=['POST'])
@login_required
@roles_required('Admin')
def admin_delete_doctor(doctor_id):
    try:
        doctor = Doctor.query.get(doctor_id)
        if not doctor:
            flash('Doctor not found.', 'danger')
            return redirect(url_for('main.admin_doctors'))
        
        user = doctor.user 
        
        # Try to delete the profile picture file
        try:
            if doctor.profile_pic_url and not doctor.profile_pic_url.endswith('default-profile.svg'):
                file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], os.path.basename(doctor.profile_pic_url))
                if os.path.exists(file_path):
                    os.remove(file_path)
        except Exception as e:
            flash(f'Could not delete profile pic: {str(e)}', 'warning')

        db.session.delete(doctor)
        db.session.commit()
        
        datastore.delete_user(user)
        db.session.commit()
        
        flash(f'Dr. {user.full_name} and their account have been permanently deleted.', 'success')
    except Exception as e:
        db.session.rollback()
        flash(f'Error deleting doctor: {str(e)}', 'danger')
        
    return redirect(url_for('main.admin_doctors'))

@main.route('/admin/department/add', methods=['POST'])
@login_required
@roles_required('Admin')
def admin_add_department():
    name = request.form.get('name')
    if name:
        if Department.query.filter_by(name=name).first():
            flash('Department already exists.', 'warning')
        else:
            new_dept = Department(name=name)
            db.session.add(new_dept)
            db.session.commit()
            flash('Department added successfully.', 'success')
    return redirect(url_for('main.admin_doctors'))

# --- Placeholder Routes (unchanged) ---
@main.route('/admin/patients')
@login_required
@roles_required('Admin')
def admin_patients():
    return render_template('admin/admin_base.html')

@main.route('/admin/appointments')
@login_required
@roles_required('Admin')
def admin_appointments():
    return render_template('admin/admin_base.html')

# --- Doctor & Patient Routes (unchanged) ---
@main.route('/doctor/dashboard')
@login_required
@roles_required('Doctor')
def doctor_dashboard():
    return f"<h1>Doctor Dashboard</h1><p>Hello, Dr. {current_user.full_name}!</p><a href='/logout'>Logout</a>"

@main.route('/patient/dashboard')
@login_required
@roles_required('Patient')
def patient_dashboard():
    return f"<h1>Patient Dashboard</h1><p>Hello, {current_user.full_name}!</p><a href='/logout'>Logout</a>"