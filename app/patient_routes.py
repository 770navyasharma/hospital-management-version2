from flask import Blueprint, render_template, redirect, url_for, request, jsonify, current_app
from flask_security import login_required, roles_required, current_user
from .models import db, Patient, Role, Doctor, Appointment, Department, User
from datetime import datetime, timedelta
from sqlalchemy import func
from .utils import is_doctor_available

patient_blueprint = Blueprint('patient', __name__)

@patient_blueprint.route('/dashboard')
@login_required
@roles_required('Patient')
def patient_dashboard():
    departments = Department.query.all()
    doctors = Doctor.query.all()
    return render_template('patient/patient_dashboard.html', user=current_user, departments=departments, doctors=doctors)

@patient_blueprint.route('/book-appointment')
@login_required
@roles_required('Patient')
def book_appointment_page():
    departments = Department.query.all()
    doctors = Doctor.query.all()
    return render_template('patient/book_visit.html', user=current_user, departments=departments, doctors=doctors)


@patient_blueprint.route('/api/doctor-statuses')
@login_required
@roles_required('Patient')
def get_doctor_statuses():
    """Returns real-time computed status for all doctors."""
    from datetime import datetime, timedelta
    now = datetime.now()
    curr_time_str = now.strftime('%H:%M')
    date_str = now.strftime('%Y-%m-%d')
    day_name = now.strftime('%A')

    doctors = Doctor.query.all()
    result = {}

    for doctor in doctors:
        override = doctor.status_override or 'auto'

        ongoing = Appointment.query.filter_by(
            doctor_id=doctor.id, status='Ongoing'
        ).first()

        if ongoing:
            computed = 'busy'
        elif override != 'auto':
            computed = override
        else:

            availability = doctor.availability or {}
            slots = availability.get(day_name, []) + availability.get(date_str, [])
            in_slot = False
            for slot in set(slots):
                try:
                    start, end = [s.strip() for s in slot.split('-')]
                    if start <= curr_time_str <= end:
                        in_slot = True
                        break
                except:
                    continue
            computed = 'available' if in_slot else 'offline'

        result[doctor.id] = computed

    return jsonify(result)

@patient_blueprint.route('/profile')
@login_required
@roles_required('Patient')
def patient_profile():
    return render_template('patient/profile.html', user=current_user)

@patient_blueprint.route('/api/profile', methods=['GET'])
@login_required
@roles_required('Patient')
def get_patient_profile():
    patient = current_user.patient_profile
    return jsonify({
        "full_name": current_user.full_name,
        "email": current_user.email,
        "phone_number": patient.contact_number,
        "gender": patient.gender,
        "date_of_birth": patient.date_of_birth.isoformat() if patient.date_of_birth else '',
        "age": patient.age,
        "about_me": patient.about_me,
        "medical_history": patient.medical_history,
        "profile_pic": patient.profile_pic_url
    })

@patient_blueprint.route('/api/profile', methods=['POST'])
@login_required
@roles_required('Patient')
def update_patient_profile():
    patient = current_user.patient_profile
    data = request.json
    
    current_user.full_name = data.get('full_name', current_user.full_name)
    patient.contact_number = data.get('phone_number', patient.contact_number)
    patient.gender = data.get('gender', patient.gender)
    patient.about_me = data.get('about_me', patient.about_me)
    patient.medical_history = data.get('medical_history', patient.medical_history)
    
    if data.get('date_of_birth'):
        try:
            patient.date_of_birth = datetime.strptime(data['date_of_birth'], '%Y-%m-%d').date()
        except ValueError:
            pass

    if data.get('profile_pic'):
        patient.profile_pic_url = data['profile_pic']

    db.session.commit()
    return jsonify({"message": "Profile updated successfully"})

@patient_blueprint.route('/api/profile/upload-image', methods=['POST'])
@login_required
@roles_required('Patient')
def upload_profile_image():
    if 'profile_pic' not in request.files:
        return jsonify({"message": "No file uploaded"}), 400
        
    file = request.files['profile_pic']
    if file.filename == '':
        return jsonify({"message": "No file selected"}), 400

    from werkzeug.utils import secure_filename
    import os

    filename = f"patient_{current_user.id}_{datetime.now().strftime('%Y%m%d%H%M%S')}.jpg"
    upload_folder = os.path.join(current_app.root_path, 'static/uploads/profiles')
    os.makedirs(upload_folder, exist_ok=True)
    
    file_path = os.path.join(upload_folder, filename)
    file.save(file_path)

    file_url = f"/static/uploads/profiles/{filename}"
    current_user.patient_profile.profile_pic_url = file_url
    db.session.commit()
    
    return jsonify({"url": file_url})

@patient_blueprint.route('/api/notifications')
@login_required
@roles_required('Patient')
def get_notifications():
    from .models import Notification
    notifications = Notification.query.filter_by(user_id=current_user.id).order_by(Notification.created_at.desc()).limit(20).all()
    return jsonify([{
        "id": n.id,
        "message": n.message,
        "type": n.type,
        "is_read": n.is_read,
        "time": n.created_at.strftime("%I:%M %p")
    } for n in notifications])

@patient_blueprint.route('/api/notifications/mark-read', methods=['POST'])
@login_required
@roles_required('Patient')
def mark_notifications_read():
    from .models import Notification
    Notification.query.filter_by(user_id=current_user.id, is_read=False).update({"is_read": True})
    db.session.commit()
    return jsonify({"status": "success"})

@patient_blueprint.route('/api/appointments')
@login_required
@roles_required('Patient')
def get_appointments():
    patient_id = current_user.patient_profile.id
    appts = Appointment.query.filter_by(patient_id=patient_id).order_by(Appointment.appointment_datetime.desc()).all()
    
    return jsonify([{
        "id": a.id,
        "doctor_id": a.doctor_id,
        "doctor_name": a.doctor.user.full_name,
        "doctor_pic": a.doctor.profile_pic_url,
        "doctor_dept": a.doctor.department.name,
        "doctor_tagline": a.doctor.tagline or f"Specialist in {a.doctor.department.name}",
        "doctor_degree": a.doctor.degree or "MBBS",
        "doctor_about": a.doctor.about_me or "Professional healthcare provider dedicated to patient wellness.",
        "doctor_experience": a.doctor.experience_years or 5,
        "doctor_fees": a.doctor.fees or 500,
        "datetime": a.appointment_datetime.strftime("%d %b %Y at %I:%M %p"),
        "raw_date": a.appointment_datetime.strftime("%Y-%m-%d"),
        "time_only": a.appointment_datetime.strftime("%I:%M %p"),
        "status": a.status,
        "is_urgent": a.is_urgent,
        "urgent_note": a.urgent_note,
        "patient_history": a.patient.medical_history if a.patient else "",
        "diagnosis": a.treatment.diagnosis if a.treatment else None,
        "clinical_notes": a.treatment.clinical_notes if a.treatment else None,
        "prescriptions": a.treatment.prescriptions_json if a.treatment and a.treatment.prescriptions_json else [],
        "attachments": [
            {
                "id": att.id,
                "name": att.filename or os.path.basename(att.file_path),
                "path": url_for('static', filename=att.file_path.replace('app/static/', '').replace('static/', '').lstrip('/')),
                "type": att.file_type or ("image" if att.file_path.lower().endswith(('.png', '.jpg', '.jpeg', '.gif')) else "pdf" if att.file_path.lower().endswith('.pdf') else "other")
            } for att in a.treatment.attachments
        ] if a.treatment else [],
        "raw_datetime": a.appointment_datetime.strftime("%Y-%m-%dT%H:%M")
    } for a in appts])

@patient_blueprint.route('/api/doctor-availability/<int:doctor_id>/<string:date_str>')
@login_required
def get_doctor_availability(doctor_id, date_str):
    doctor = Doctor.query.get_or_404(doctor_id)
    if not doctor.availability:
        return jsonify({"available_slots": [], "booked_intervals": []})
    
    slots = doctor.availability.get(date_str, [])
    try:
        search_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({"status": "error", "message": "Invalid date format"}), 400

    booked = Appointment.query.filter(
        Appointment.doctor_id == doctor_id,
        db.func.date(Appointment.appointment_datetime) == search_date,
        Appointment.status.in_(['Booked', 'Ongoing', 'Requested'])
    ).all()

    booked_intervals = []
    for a in booked:
        start_t = a.appointment_datetime
        end_t = start_t + timedelta(minutes=(a.duration or 30))
        booked_intervals.append({
            "start": start_t.strftime("%H:%M"),
            "end": end_t.strftime("%H:%M"),
            "status": a.status
        })
    
    now = datetime.now()
    today_str = now.strftime("%Y-%m-%d")
    current_time_str = now.strftime("%H:%M")

    formatted_slots = []
    for slot in slots:
        try:

            parts = [s.strip() for s in slot.split('-')]
            if len(parts) < 2: continue
            start_str, end_str = parts[0], parts[1]

            if date_str == today_str and end_str < current_time_str:
                continue

            start_dt = datetime.strptime(start_str, "%H:%M")
            end_dt = datetime.strptime(end_str, "%H:%M")
            display_str = f"{start_dt.strftime('%I:%M %p')} - {end_dt.strftime('%I:%M %p')}"
            
            formatted_slots.append({
                "display": display_str,
                "start": start_str,
                "end": end_str
            })
        except Exception as e:
            print(f"Error parsing slot {slot}: {e}")
            continue
            
    return jsonify({
        "available_slots": formatted_slots,
        "booked_intervals": booked_intervals
    })


@patient_blueprint.route('/api/book', methods=['POST'])
@login_required
@roles_required('Patient')
def book_appointment():
    data = request.json
    doctor_id = data.get('doctor_id')
    dt_str = data.get('datetime')
    is_urgent = data.get('is_urgent', False)
    urgent_note = data.get('note', '')
    medical_history = data.get('medical_history', '')

    if not all([doctor_id, dt_str]):
        return jsonify({"status": "error", "message": "Missing doctor or date/time"}), 400

    try:
        dt = datetime.strptime(dt_str, '%Y-%m-%dT%H:%M')
    except ValueError:
        return jsonify({"status": "error", "message": "Invalid date/time format"}), 400

    if medical_history and current_user.patient_profile:
        current_user.patient_profile.history = medical_history
        db.session.commit()

    doctor = Doctor.query.get_or_404(doctor_id)
    
    if doctor.status_override in ['break', 'offline', 'busy']:
        status_names = {'break': 'On Break', 'offline': 'Offline', 'busy': 'Busy'}
        return jsonify({
            "status": "error", 
            "message": f"Doctor is currently {status_names.get(doctor.status_override)}. Please try again later."
        }), 400

    if not is_doctor_available(doctor, dt):
        return jsonify({
            "status": "error", 
            "message": "Doctor is not available at this time. Please choose a time within their availability slots."
        }), 400

    if is_urgent and not urgent_note:
        return jsonify({
            "status": "error", 
            "message": "A reason is required for urgent appointments."
        }), 400

    new_start = dt
    new_end = new_start + timedelta(minutes=30)

    existing_appts = Appointment.query.filter(
        Appointment.doctor_id == doctor_id,
        Appointment.status.in_(['Booked', 'Ongoing'])
    ).all()

    for ex in existing_appts:
        ex_start = ex.appointment_datetime
        ex_end = ex_start + timedelta(minutes=ex.duration or 30)
        if ex_start < new_end and new_start < ex_end:
            return jsonify({
                "status": "error", 
                "message": f"Doctor is already busy during this timeframe."
            }), 400

    appt = Appointment(
        patient_id=current_user.patient_profile.id,
        doctor_id=doctor_id,
        appointment_datetime=dt,
        status='Requested',
        is_urgent=is_urgent,
        urgent_note=urgent_note
    )
    
    db.session.add(appt)
    db.session.commit()
    
    return jsonify({"status": "success", "message": "Appointment requested successfully!"})

@patient_blueprint.route('/api/cancel/<int:appt_id>', methods=['POST'])
@login_required
@roles_required('Patient')
def cancel_appointment(appt_id):
    appt = Appointment.query.get_or_404(appt_id)
    if appt.patient_id != current_user.patient_profile.id:
        return jsonify({"status": "error", "message": "Unauthorized"}), 403
    data = request.json or {}
    reason = data.get('reason', '').strip()
    
    appt.status = 'Cancelled'
    appt.internal_notes = reason

    doc_user_id = appt.doctor.user.id
    patient_name = current_user.full_name
    appt_time = appt.appointment_datetime.strftime('%b %d at %I:%M %p')
    
    msg = f"❌ {patient_name} has cancelled their appointment for {appt_time}."
    if reason and reason != 'Cancelled by patient':
        msg += f" Reason: {reason}"
        
    note = Notification(
        user_id=doc_user_id,
        message=msg,
        type='danger'
    )
    db.session.add(note)
    db.session.commit()
    return jsonify({"status": "success", "message": "Appointment cancelled."})


@patient_blueprint.route('/api/edit/<int:appt_id>', methods=['POST'])
@login_required
@roles_required('Patient')
def edit_appointment(appt_id):
    appt = Appointment.query.get_or_404(appt_id)
    if appt.patient_id != current_user.patient_profile.id:
        return jsonify({"status": "error", "message": "Unauthorized"}), 403

    if appt.status not in ['Booked', 'Ongoing', 'Requested']:
        return jsonify({"status": "error", "message": "Cannot edit this appointment"}), 400

    data = request.json
    dt_str = data.get('datetime')
    is_urgent = data.get('is_urgent', appt.is_urgent)
    urgent_note = data.get('note', appt.urgent_note)
    medical_history = data.get('medical_history', '')

    if not dt_str:
        return jsonify({"status": "error", "message": "Date/time required"}), 400

    try:
        new_dt = datetime.strptime(dt_str, '%Y-%m-%dT%H:%M')
    except ValueError:
        return jsonify({"status": "error", "message": "Invalid date format"}), 400

    if new_dt.date() != appt.appointment_datetime.date():
        return jsonify({"status": "error", "message": "Can only edit timing for the same day"}), 400

    if not is_doctor_available(appt.doctor, new_dt):
        return jsonify({"status": "error", "message": "Doctor not available at this time."}), 400

    old_time_str = appt.appointment_datetime.strftime('%I:%M %p')
    new_time_str = new_dt.strftime('%I:%M %p')

    appt.appointment_datetime = new_dt
    appt.is_urgent = is_urgent
    appt.urgent_note = urgent_note
    appt.status = 'Requested'

    if medical_history and current_user.patient_profile:
        current_user.patient_profile.history = medical_history

    doc_user_id = appt.doctor.user.id
    patient_name = current_user.full_name
    note = Notification(
        user_id=doc_user_id,
        message=f"🕒 {patient_name} rescheduled their {new_dt.strftime('%b %d')} appointment from {old_time_str} to {new_time_str}. Please review.",
        type='info'
    )
    db.session.add(note)

    db.session.commit()
    return jsonify({"status": "success", "message": "Appointment updated and pending doctor approval."})

