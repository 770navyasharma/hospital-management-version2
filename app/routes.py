# app/routes.py
from flask import Blueprint, render_template, redirect, url_for, request, flash
from flask_security import login_required, roles_required, current_user, utils, auth_required
from .models import db, Patient, Role
from . import datastore 
from functools import wraps # <-- Import wraps

main = Blueprint('main', __name__)

# --- This decorator handles the "going back" problem ---
def prevent_logged_in_access(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if current_user.is_authenticated:
            # If logged in, redirect to their dashboard
            return redirect(url_for('main.dashboard'))
        return f(*args, **kwargs)
    return decorated_function

@main.route('/')
@prevent_logged_in_access # <-- Add the decorator
def index():
    """Home page."""
    return render_template('index.html')

@main.route('/dashboard')
@login_required
def dashboard():
    """Redirects user to their role-specific dashboard."""
    if current_user.has_role('Admin'):
        return redirect(url_for('main.admin_dashboard'))
    elif current_user.has_role('Doctor'):
        return redirect(url_for('main.doctor_dashboard'))
    elif current_user.has_role('Patient'):
        return redirect(url_for('main.patient_dashboard'))
    else:
        # Fallback (shouldn't be reached with our roles)
        return redirect(url_for('security.logout'))

# --- Dashboard Placeholders (we'll build these later) ---
@main.route('/admin-dashboard')
@login_required
@roles_required('Admin')
def admin_dashboard():
    # You'll replace this with your real dashboard template
    return f"<h1>Admin Dashboard</h1><p>Hello, {current_user.full_name}!</p><a href='/logout'>Logout</a>"

@main.route('/doctor-dashboard')
@login_required
@roles_required('Doctor')
def doctor_dashboard():
    # You'll replace this with your real dashboard template
    return f"<h1>Doctor Dashboard</h1><p>Hello, Dr. {current_user.full_name}!</p><a href='/logout'>Logout</a>"

@main.route('/patient-dashboard')
@login_required
@roles_required('Patient')
def patient_dashboard():
    # You'll replace this with your real dashboard template
    return f"<h1>Patient Dashboard</h1><p>Hello, {current_user.full_name}!</p><a href='/logout'>Logout</a>"

@main.route('/patient-register', methods=['GET', 'POST'])
@prevent_logged_in_access # <-- Add the decorator
def patient_register():
    """Custom patient registration route."""
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