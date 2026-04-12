from flask import Blueprint, render_template, redirect, url_for, request, flash, current_app, jsonify
from flask_security import login_required, roles_required, current_user, utils
from .models import db, Patient, Role, Doctor, Appointment, Department, User
from . import datastore 
from functools import wraps
import json 
import os
from werkzeug.utils import secure_filename
from datetime import datetime, date, timedelta
from sqlalchemy import func

main = Blueprint('main', __name__)

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in current_app.config['ALLOWED_EXTENSIONS']

def prevent_logged_in_access(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if current_user.is_authenticated:
            return redirect(url_for('main.dashboard'))
        return f(*args, **kwargs)
    return decorated_function

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
        gender = request.form.get('gender')
        date_of_birth_str = request.form.get('date_of_birth')
        profile_pic = request.files.get('profile_pic')

        if not all([full_name, email, contact_number, password, gender, date_of_birth_str]):
            flash("All fields are required", "danger")
            return render_template('patient_register.html', **request.form)

        if datastore.find_user(email=email):
            flash("User already exists", "danger")
            return render_template('patient_register.html', **request.form)

        profile_pic_path = url_for('static', filename='images/default-profile.svg')
        if profile_pic and allowed_file(profile_pic.filename):
            filename = secure_filename(f"patient_{email}_" + profile_pic.filename)
            upload_path = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
            profile_pic.save(upload_path)
            profile_pic_path = f'/static/uploads/{filename}'

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
            contact_number=contact_number,
            profile_pic_url=profile_pic_path, 
            gender=gender, 
            date_of_birth=datetime.strptime(date_of_birth_str, '%Y-%m-%d').date()
        )
        
        db.session.add(patient_profile)
        db.session.commit()

        flash("Registration successful! Your account is ready. Please sign in below.", "success")
        return redirect(url_for('security.login'))

    return render_template('patient_register.html')

@main.route('/dashboard')
@login_required
def dashboard():
    if current_user.has_role('Admin'):
        return redirect(url_for('main.admin_dashboard'))
    elif current_user.has_role('Doctor'):
        return redirect(url_for('doctor.doctor_dashboard'))
    elif current_user.has_role('Patient'):
        return redirect(url_for('patient.patient_dashboard'))
    else:
        return redirect(url_for('security.logout'))




@main.route('/admin/dashboard')
@login_required
@roles_required('Admin')
def admin_dashboard():
    patient_count = Patient.query.count()
    doctor_count = Doctor.query.count()
    appointment_count = Appointment.query.count()
    
    return render_template(
        'admin/admin_dashboard.html',
        patient_count=patient_count,
        doctor_count=doctor_count,
        appointment_count=appointment_count
    )
    
    
@main.route('/api/admin/dashboard-stats')
@login_required
@roles_required('Admin')
def dashboard_stats_api():
    start_str = request.args.get('start_date')
    end_str = request.args.get('end_date')

    if start_str and end_str:
        start_date = datetime.strptime(start_str, '%Y-%m-%d')
        end_date = datetime.strptime(end_str, '%Y-%m-%d') + timedelta(days=1)
    else:
        # NEW: Default to 180 days (6 months) as requested
        end_date = datetime.now()
        start_date = end_date - timedelta(days=180)

    appt_stats = db.session.query(
        func.date(Appointment.appointment_datetime).label('date'),
        func.count(Appointment.id).label('count')
    ).filter(Appointment.appointment_datetime >= start_date, 
             Appointment.appointment_datetime < end_date)\
     .group_by(func.date(Appointment.appointment_datetime)).all()

    # 1. Appointment status distribution (Filtered by date range)
    status_stats = db.session.query(
        Appointment.status, func.count(Appointment.id)
    ).filter(Appointment.appointment_datetime >= start_date, 
             Appointment.appointment_datetime < end_date)\
     .group_by(Appointment.status).all()

    # 2. Department-wise stats (Comprehensive)
    # Get all departments first to ensure they appear
    all_depts = Department.query.order_by(Department.name).all()
    dept_stats = []
    for dept in all_depts:
        doc_count = Doctor.query.filter_by(department_id=dept.id).count()
        # Count unique patients who have visited this department's doctors
        pat_count = db.session.query(func.count(func.distinct(Appointment.patient_id)))\
            .join(Doctor, Appointment.doctor_id == Doctor.id)\
            .filter(Doctor.department_id == dept.id)\
            .scalar() or 0
        
        dept_stats.append({
            "name": dept.name,
            "doctors": doc_count,
            "patients": pat_count
        })

    # Add absolute totals for the summary cards
    totals = {
        "patients": Patient.query.count(),
        "doctors": Doctor.query.count(),
        "appointments": Appointment.query.count()
    }

    return jsonify({
        "status_distribution": {s[0]: s[1] for s in status_stats},
        "dept_stats": dept_stats,
        "totals": totals
    })

@main.route('/api/admin/doctors-list')
@login_required
@roles_required('Admin')
def admin_doctors_list_api():
    doctors = Doctor.query.all()
    return jsonify([{
        "id": d.id,
        "name": d.user.full_name,
        "dept": d.department.name,
        "pic": d.profile_pic_url
    } for d in doctors])

@main.route('/api/admin/doctor-schedule/<int:doctor_id>')
@login_required
@roles_required('Admin')
def admin_doctor_schedule_api(doctor_id):
    doctor = Doctor.query.get_or_404(doctor_id)
    appts = Appointment.query.filter_by(doctor_id=doctor.id).all()
    
    appt_data = [{
        "date": a.appointment_datetime.strftime("%Y-%m-%d"),
        "time": a.appointment_datetime.strftime("%H:%M"),
        "status": a.status
    } for a in appts]

    # Explicitly cast to dict to ensure MutableDict/SQLiteJSON doesn't cause serialization ghosting
    availability_data = dict(doctor.availability) if doctor.availability else {}
    has_any = len(availability_data.keys()) > 0

    return jsonify({
        "availability": availability_data,
        "has_any_availability": has_any,
        "appointments": appt_data,
        "doctor_info": {
            "name": doctor.user.full_name,
            "dept": doctor.department.name,
            "pic": doctor.profile_pic_url
        }
    })

@main.route('/api/admin/patient-case-file/<int:patient_id>')
@login_required
@roles_required('Admin')
def patient_case_file_api(patient_id):
    patient = Patient.query.get_or_404(patient_id)
    appts = Appointment.query.filter_by(patient_id=patient.id).order_by(Appointment.appointment_datetime.desc()).all()
    
    visit_history = []
    for a in appts:
        visit_history.append({
            "date": a.appointment_datetime.strftime("%d %b %Y"),
            "doctor": a.doctor.user.full_name,
            "status": a.status,
            "diagnosis": a.treatment.diagnosis if a.treatment else "Pending",
            "prescription": a.treatment.prescription if a.treatment else "None"
        })

    return jsonify({
        "info": {
            "name": patient.user.full_name,
            "email": patient.user.email,
            "contact": patient.contact_number,
            "medical_history": patient.medical_history or "No previous medical history recorded.",
            "status": patient.status,
            "pic": patient.profile_pic_url
        },
        "history": visit_history
    })

@main.route('/api/admin/doctor-performance/<int:doctor_id>')
@login_required
@roles_required('Admin')
def doctor_performance_api(doctor_id):
    start_str = request.args.get('start_date')
    end_str = request.args.get('end_date')
    
    if start_str and end_str:
        start_date = datetime.strptime(start_str, '%Y-%m-%d')
        end_date = datetime.strptime(end_str, '%Y-%m-%d') + timedelta(days=1)
    else:
        end_date = datetime.now()
        start_date = end_date - timedelta(days=180)

    doctor = Doctor.query.get_or_404(doctor_id)
    appts = Appointment.query.filter(
        Appointment.doctor_id == doctor.id,
        Appointment.appointment_datetime >= start_date,
        Appointment.appointment_datetime < end_date
    ).all()

    total_revenue = sum([doctor.fees for a in appts if a.status == 'Completed'])
    
    status_counts = {"Completed": 0, "Cancelled": 0, "Ongoing": 0, "Booked": 0}
    for a in appts:
        if a.status in status_counts:
            status_counts[a.status] += 1

    return jsonify({
        "doctor_id": doctor.id,
        "count": len(appts),
        "revenue": total_revenue,
        "status_dist": status_counts,
        "recent_patients": list(set([a.patient.user.full_name for a in appts[:5]]))
    })
@main.route('/admin/doctors', methods=['GET'])
@login_required
@roles_required('Admin')
def admin_doctors():

    search_name = request.args.get('name', '')
    search_spec = request.args.get('specialization', '')
    page = request.args.get('page', 1, type=int)

    query = Doctor.query.join(User, Doctor.user_id == User.id).join(Department, Doctor.department_id == Department.id)

    if search_name:
        query = query.filter(User.full_name.ilike(f'%{search_name}%'))
    if search_spec:
        query = query.filter(Department.name.ilike(f'%{search_spec}%'))


    pagination = query.order_by(User.full_name).paginate(page=page, per_page=10, error_out=False)
    doctors = pagination.items
    
    departments = Department.query.order_by(Department.name).all()
    
    return render_template(
        'admin/admin_doctors.html', 
        doctors=doctors, 
        pagination=pagination,
        departments=departments
    )
    
    
    
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
        fees = float(request.form.get('fees', 0.0))
        availability_str = (request.form.get('availability') or '').strip()

        profile_pic = request.files.get('profile_pic')
        profile_pic_path = url_for('static', filename='images/default-profile.svg')

        if datastore.find_user(email=email):
            flash('Email already exists.', 'danger')
            return redirect(url_for('main.admin_doctors'))

        if profile_pic and allowed_file(profile_pic.filename):
            filename = secure_filename(f"doctor_{email}_" + profile_pic.filename)
            upload_path = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
            profile_pic.save(upload_path)
            profile_pic_path = f'/static/uploads/{filename}'

        hashed_password = utils.hash_password(password)
        doctor_role = datastore.find_or_create_role(name='Doctor', description='Doctor')
        user = datastore.create_user(
            email=email, password=hashed_password, full_name=full_name,
            roles=[doctor_role], active=True
        )

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
            fees=fees,
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
        if request.form.get('status'):
            doctor.user.active = (request.form.get('status') == 'active')
        doctor.phone_number = request.form.get('phone_number')
        doctor.department_id = request.form.get('department_id')
        # Professional bio and credentials are now doctor-managed and locked for admins
        doctor.fees = float(request.form.get('fees', 0.0))

        profile_pic = request.files.get('profile_pic')
        remove_pic = request.form.get('remove_pic') == 'true'

        if remove_pic:
            doctor.profile_pic_url = url_for('static', filename='images/default-profile.svg')
        elif profile_pic and allowed_file(profile_pic.filename):
            filename = secure_filename(f"doctor_{doctor.user.email}_" + profile_pic.filename)
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
        display_name = doctor.user.full_name
        if not display_name.lower().startswith('dr.'):
            display_name = f"Dr. {display_name}"
        flash(f"{display_name}'s profile updated successfully.", 'success')
    except Exception as e:
        db.session.rollback()
        flash(f'Error updating doctor: {e}', 'danger')

    return redirect(url_for('main.admin_doctors'))

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
    
    return redirect(request.referrer or url_for('main.admin_dashboard'))

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

@main.route('/admin/department/edit/<int:dept_id>', methods=['POST'])
@login_required
@roles_required('Admin')
def admin_edit_department(dept_id):
    try:
        dept = Department.query.get_or_404(dept_id)
        new_name = request.form.get('name')

        if not new_name:
            flash('Department name cannot be empty.', 'danger')
            return redirect(url_for('main.admin_doctors'))

        existing_dept = Department.query.filter(Department.name == new_name, Department.id != dept_id).first()
        if existing_dept:
            flash(f'A department with the name "{new_name}" already exists.', 'warning')
        else:
            dept.name = new_name
            db.session.commit()
            flash('Department name updated successfully.', 'success')
    except Exception as e:
        db.session.rollback()
        flash(f'Error updating department: {str(e)}', 'danger')
        
    return redirect(url_for('main.admin_doctors'))

@main.route('/admin/department/delete/<int:dept_id>', methods=['POST'])
@login_required
@roles_required('Admin')
def admin_delete_department(dept_id):
    try:
        dept = Department.query.get_or_404(dept_id)
        
        if dept.doctors:
            flash(f'Cannot delete department "{dept.name}". It is still assigned to {len(dept.doctors)} doctor(s).', 'danger')
        else:
            db.session.delete(dept)
            db.session.commit()
            flash(f'Department "{dept.name}" deleted successfully.', 'success')
    except Exception as e:
        db.session.rollback()
        flash(f'Error deleting department: {str(e)}', 'danger')
        
    return redirect(url_for('main.admin_doctors'))


@main.route('/admin/patients', methods=['GET'])
@login_required
@roles_required('Admin')
def admin_patients():
    search_name = request.args.get('name', '').strip()
    page = request.args.get('page', 1, type=int)


    default_start = (date.today() - timedelta(days=30)).isoformat()
    default_end = date.today().isoformat()
    
    start_date = request.args.get('start_date', default_start)
    end_date = request.args.get('end_date', default_end)
    
    query = Patient.query.join(User, Patient.user_id == User.id)
    
    if search_name:
        query = query.filter(
            db.or_(User.full_name.ilike(f'%{search_name}%'), User.email.ilike(f'%{search_name}%'))
        )

    pagination = query.order_by(User.full_name).paginate(page=page, per_page=6, error_out=False)
    patients = pagination.items 
    
    stats = {
        'total': Patient.query.count(),
        'under_treatment': Patient.query.filter_by(status='Under Treatment').count(),
        'recovered': Patient.query.filter_by(status='Recovered').count()
    }
    
    return render_template(
        'admin/admin_patients.html', 
        patients=patients, 
        pagination=pagination, 
        stats=stats, 
        search_name=search_name,
        start_date=start_date,
        end_date=end_date,
        date=date
    )

@main.route('/admin/patient/edit/<int:patient_id>', methods=['POST'])
@login_required
@roles_required('Admin')
def admin_edit_patient(patient_id):
    try:
        patient = Patient.query.get_or_404(patient_id)
        name_input = request.form.get('full_name')
        
        if name_input:
            patient.user.full_name = name_input
            
        patient.contact_number = request.form.get('contact_number')
        patient.status = request.form.get('status')
        patient.medical_history = request.form.get('medical_history')

        db.session.commit()
        flash(f"Patient {patient.user.full_name} updated successfully.", 'success')
    except Exception as e:
        db.session.rollback()
        flash(f'Error: {str(e)}', 'danger')
    return redirect(url_for('main.admin_patients'))

@main.route('/admin/api/patient_stats')
@login_required
@roles_required('Admin')
def patient_stats_api():
    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')
    
    start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
    end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
    
    # Get total count of patients before the start date
    base_count = db.session.query(func.count(User.id)).join(User.roles).filter(
        Role.name == 'Patient',
        User.created_at < datetime.combine(start_date, datetime.min.time())
    ).scalar() or 0

    # Get daily new patient counts for the range
    new_patients = db.session.query(
        func.date(User.created_at).label('date'),
        func.count(User.id).label('count')
    ).join(User.roles).filter(
        Role.name == 'Patient',
        User.created_at >= datetime.combine(start_date, datetime.min.time()),
        User.created_at <= datetime.combine(end_date, datetime.max.time())
    ).group_by(func.date(User.created_at)).all()

    labels = []
    data_points = []
    current_total = base_count
    
    delta = end_date - start_date
    for i in range(delta.days + 1):
        day = (start_date + timedelta(days=i)).isoformat()
        labels.append(day)
        
        # Find daily count
        daily_new = next((x.count for x in new_patients if str(x.date) == day), 0)
        current_total += daily_new
        data_points.append(current_total)

    return jsonify({'labels': labels, 'new_patients_data': data_points})



@main.route('/admin/patient/delete/<int:patient_id>', methods=['POST'])
@login_required
@roles_required('Admin')
def admin_delete_patient(patient_id):
    try:
        patient = Patient.query.get(patient_id)
        if not patient:
            flash('Patient not found.', 'danger')
            return redirect(url_for('main.admin_patients'))
        
        user = patient.user
        
        if patient.appointments:
            flash(f'Cannot delete {user.full_name}. They have {len(patient.appointments)} appointment(s) on record.', 'danger')
            return redirect(url_for('main.admin_patients'))

        try:
            if patient.profile_pic_url and not patient.profile_pic_url.endswith('default-profile.svg'):
                file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], os.path.basename(patient.profile_pic_url))
                if os.path.exists(file_path):
                    os.remove(file_path)
        except Exception as e:
            flash(f'Could not delete profile pic: {str(e)}', 'warning')
        
        db.session.delete(patient)
        db.session.commit()
        
        datastore.delete_user(user)
        db.session.commit()
        
        flash(f'Patient {user.full_name} and their account have been permanently deleted.', 'success')
    except Exception as e:
        db.session.rollback()
        flash(f'Error deleting patient: {str(e)}', 'danger')
    
    return redirect(url_for('main.admin_patients'))


@main.route('/admin/appointments')
@login_required
@roles_required('Admin')
def admin_appointments():


    from datetime import date
    return render_template('admin/admin_appointments.html', date=date)

@main.route('/api/admin/appointment-stats')
@login_required
@roles_required('Admin')
def appointment_stats_api():

    days = request.args.get('days')
    start_str = request.args.get('start_date')
    end_str = request.args.get('end_date')

    if start_str and end_str:
        start_date = datetime.strptime(start_str, '%Y-%m-%d')
        end_date = datetime.strptime(end_str, '%Y-%m-%d') + timedelta(days=1)
    else:
        # Default to a larger window if not specified, often 30 days is standard.
        days = int(days) if days else 30 
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)

    stats = db.session.query(
        func.date(Appointment.appointment_datetime).label('date'),
        func.count(Appointment.id).label('count')
    ).filter(Appointment.appointment_datetime >= start_date, 
             Appointment.appointment_datetime < end_date)\
     .group_by(func.date(Appointment.appointment_datetime)).all()

    status_dist = db.session.query(
        Appointment.status, func.count(Appointment.id)
    ).filter(Appointment.appointment_datetime >= start_date, 
             Appointment.appointment_datetime < end_date)\
     .group_by(Appointment.status).all()

    appts = Appointment.query.filter(
        Appointment.appointment_datetime >= start_date,
        Appointment.appointment_datetime < end_date
    ).order_by(Appointment.appointment_datetime.desc()).all()

    appt_list = [{
        "id": a.id,
        "date": a.appointment_datetime.strftime("%Y-%m-%d %H:%M"),
        "patient": a.patient.user.full_name,
        "doctor": a.doctor.user.full_name,
        "status": a.status
    } for a in appts]

    return jsonify({
        "line_chart": [{"date": str(s.date), "count": s.count} for s in stats],
        "status_pie": {s[0]: s[1] for s in status_dist},
        "appointments": appt_list
    })

@main.route('/api/admin/appointment-details/<int:appt_id>')
@login_required
@roles_required('Admin')
def appointment_details_api(appt_id):
    appt = Appointment.query.get_or_404(appt_id)
    return jsonify({
        "id": appt.id,
        "date": appt.appointment_datetime.strftime("%d %b %Y at %H:%M"),
        "status": appt.status,
        "is_urgent": appt.is_urgent,
        "urgent_note": appt.urgent_note,
        "patient": {
            "name": appt.patient.user.full_name if appt.patient and appt.patient.user else "Deleted Patient",
            "email": appt.patient.user.email if appt.patient and appt.patient.user else "",
            "contact": appt.patient.contact_number if appt.patient else "",
            "pic": appt.patient.profile_pic_url if appt.patient and appt.patient.profile_pic_url else "/static/images/default-profile.svg",
            "medical_history": (appt.patient.medical_history if appt.patient else None) or "No previous clinical notes available."
        },
        "doctor": {
            "name": appt.doctor.user.full_name if appt.doctor and appt.doctor.user else "Deleted Doctor", 
            "email": appt.doctor.user.email if appt.doctor and appt.doctor.user else "",
            "dept": appt.doctor.department.name if appt.doctor and appt.doctor.department else "Unassigned",
            "degree": (appt.doctor.degree if appt.doctor else None) or "",
            "pic": appt.doctor.profile_pic_url if appt.doctor and appt.doctor.profile_pic_url else "/static/images/default-profile.svg"
        },
        "treatment": {
            "diagnosis": appt.treatment.diagnosis if appt.treatment else "Pending",
            "prescription": appt.treatment.prescription if appt.treatment else "None issued",
            "notes": appt.treatment.notes if appt.treatment else "",
            "clinical_notes": appt.treatment.clinical_notes if appt.treatment else "",
            "attachments": [{
                "id": att.id,
                "name": att.filename,
                "type": att.file_type,
                "path": att.file_path
            } for att in (appt.treatment.attachments if appt.treatment else [])]
        }
    })