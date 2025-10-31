# app/routes.py
from flask import Blueprint, render_template, redirect, url_for, request
from flask_security import login_required, roles_required, current_user, utils
from .models import db, Patient, Role
from . import datastore 
from flask_security.forms import RegisterForm # <-- Import the form

main = Blueprint('main', __name__)

@main.route('/')
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
        return render_template('index.html')

@main.route('/admin-dashboard')
@login_required
@roles_required('Admin')
def admin_dashboard():
    return render_template('admin_dashboard.html')

@main.route('/doctor-dashboard')
@login_required
@roles_required('Doctor')
def doctor_dashboard():
    return render_template('doctor_dashboard.html')

@main.route('/patient-dashboard')
@login_required
@roles_required('Patient')
def patient_dashboard():
    return render_template('patient_dashboard.html')

@main.route('/patient-register', methods=['GET', 'POST'])
def patient_register():
    """Custom patient registration route."""
    
    # Pass the form to the template
    form = RegisterForm() 

    if request.method == 'POST':
        # Get form data
        full_name = request.form.get('full_name')
        email = request.form.get('email')
        contact_number = request.form.get('contact_number')
        password = request.form.get('password')

        if not all([full_name, email, contact_number, password]):
            return render_template('patient_register.html', security={'register_form': form}, error="All fields are required")

        if datastore.find_user(email=email):
            return render_template('patient_register.html', security={'register_form': form}, error="User already exists")

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

    # Show the registration form on GET request
    # We pass the form inside a 'security' dict to match how render_form expects it
    return render_template('patient_register.html', security={'register_form': form})