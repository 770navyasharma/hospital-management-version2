from flask import Blueprint, render_template, jsonify, request, current_app
from flask_login import login_required, current_user
from flask_security import roles_required
from .models import Appointment, Patient, Doctor, Treatment, Attachment, db, Notification, User
from datetime import datetime, timedelta, time
from .utils import is_doctor_available
from werkzeug.utils import secure_filename
import os
import hashlib
from sqlalchemy import func

doctor_blueprint = Blueprint('doctor', __name__)

@doctor_blueprint.route('/profile')
@login_required
@roles_required('Doctor')
def doctor_profile():
    return render_template('doctor/profile.html', user=current_user)

@doctor_blueprint.route('/dashboard')
@login_required
@roles_required('Doctor')
def doctor_dashboard():
    return render_template('doctor/doctor_dashboard.html', user=current_user)

@doctor_blueprint.route('/api/notifications')
@login_required
@roles_required('Doctor')
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

@doctor_blueprint.route('/api/notifications/mark-read', methods=['POST'])
@login_required
@roles_required('Doctor')
def mark_notifications_read():
    from .models import Notification
    Notification.query.filter_by(user_id=current_user.id, is_read=False).update({"is_read": True})
    db.session.commit()
    return jsonify({"status": "success"})

@doctor_blueprint.route('/ongoing-appointment')
@login_required
@roles_required('Doctor')
def ongoing_appointment_page():
    return render_template('doctor/ongoing_appointment.html', user=current_user)

@doctor_blueprint.route('/api/doctor/stats')
@login_required
@roles_required('Doctor')
def get_doctor_stats():
    doctor = current_user.doctor_profile

    cleanup_overdue_appointments(doctor.id)

    
    if not doctor:
        print(f"DEBUG: No doctor profile found for {current_user.email}")
        return jsonify({"status": "error", "message": "No doctor profile"}), 404
    
    now = datetime.now()
    today = now.date()

    start_of_day = datetime(today.year, today.month, today.day, 0, 0, 0)
    end_of_day = datetime(today.year, today.month, today.day, 23, 59, 59)


    treated_count = Appointment.query.filter(
        Appointment.doctor_id == doctor.id,
        Appointment.status == 'Completed',
        Appointment.appointment_datetime >= start_of_day,
        Appointment.appointment_datetime <= end_of_day
    ).count()

    cancelled_count = Appointment.query.filter(
        Appointment.doctor_id == doctor.id, 
        Appointment.status.in_(['Cancelled', 'Declined', 'Expired', 'Rejected']),
        Appointment.appointment_datetime >= start_of_day,
        Appointment.appointment_datetime <= end_of_day
    ).count()

    queue_count = Appointment.query.filter(
        Appointment.doctor_id == doctor.id, 
        Appointment.status.in_(['Ongoing', 'Booked']),
        Appointment.appointment_datetime >= start_of_day,
        Appointment.appointment_datetime <= end_of_day
    ).count()

    total_patients_count = db.session.query(db.func.count(db.distinct(Appointment.patient_id)))\
        .filter(Appointment.doctor_id == doctor.id).scalar() or 0

    new_patients_count = 0 
    returning_patients_count = total_patients_count - new_patients_count

    today_appts = Appointment.query.filter(
        Appointment.doctor_id == doctor.id,
        Appointment.status.in_(['Ongoing', 'Booked']),
        Appointment.appointment_datetime >= start_of_day,
        Appointment.appointment_datetime <= end_of_day
    ).order_by(Appointment.appointment_datetime.asc()).all()

    all_today_appts_count = Appointment.query.filter(
        Appointment.doctor_id == doctor.id,
        Appointment.appointment_datetime >= start_of_day,
        Appointment.appointment_datetime <= end_of_day
    ).count()
    
    total_today = all_today_appts_count
    left_today  = len(today_appts)

    pending_requests_count = Appointment.query.filter(
        Appointment.doctor_id == doctor.id,
        Appointment.status == 'Requested'
    ).count()

    filtered_requests = Appointment.query.filter(
        Appointment.doctor_id == doctor.id,
        Appointment.status == 'Requested',
        db.func.date(Appointment.appointment_datetime) >= today
    ).order_by(Appointment.is_urgent.desc(), Appointment.appointment_datetime.asc()).all()

    current_status = 'offline'
    status_override = doctor.status_override

    ongoing_appt = Appointment.query.filter(
        Appointment.doctor_id == doctor.id,
        Appointment.status == 'Ongoing'
    ).first()

    if ongoing_appt:
        current_status = 'busy'
    elif status_override != 'auto':
        current_status = status_override
    else:

        day_name = now.strftime('%A')
        date_str = now.strftime('%Y-%m-%d')
        availability = doctor.availability or {}
        slots = availability.get(day_name, [])
        date_specific_slots = availability.get(date_str, [])
        all_slots = list(set(slots + date_specific_slots))
        
        in_slot = False
        curr_time_str = now.strftime('%H:%M')
        for slot in all_slots:
            try:
                start, end = slot.split('-')
                if start <= curr_time_str <= end:
                    in_slot = True
                    break
            except: continue
        
        current_status = 'available' if in_slot else 'offline'

    return jsonify({
        "doctor_name": current_user.full_name,
        "status_override": status_override,
        "current_status": current_status,
        "total_patients": total_patients_count,
        "new_patients_count": new_patients_count,
        "treated_count": treated_count,
        "cancelled_count": cancelled_count,
        "queue_count": queue_count,
        "returning_patients_count": returning_patients_count,
        "today_count": len(today_appts),

        "total_today": total_today,
        "left_today": left_today,
        "pending_requests_count": pending_requests_count,
        "requests_count": len(filtered_requests),
        "availability": doctor.availability or {},
        "appointments": [{
            "id": a.id,
            "patient_id": a.patient.id if a.patient else None,
            "patient_name": a.patient.user.full_name if a.patient and a.patient.user else "Unknown Patient",
            "patient_pic": a.patient.profile_pic_url if a.patient else "/static/images/default-profile.svg",
            "patient_gender": a.patient.gender if a.patient else "N/A",
            "patient_age": a.patient.age if a.patient else "??",
            "start_time": a.appointment_datetime.strftime("%I:%M %p"),
            "end_time": (a.appointment_datetime + timedelta(minutes=(a.duration or 30))).strftime("%I:%M %p"),
            "duration": a.duration or 30,
            "status": a.status,
            "urgent_note": a.urgent_note or "",
            "internal_notes": a.internal_notes or ""
        } for a in today_appts],
        "requests": [{
            "id": r.id,
            "patient_id": r.patient.id if r.patient else None,
            "name": r.patient.user.full_name if r.patient and r.patient.user else "Unknown Patient",
            "pic": r.patient.profile_pic_url if r.patient else "/static/images/default-profile.svg",
            "gender": r.patient.gender if r.patient else "N/A",
            "age": r.patient.age if r.patient else "??",
            "is_urgent": r.is_urgent,
            "proposed_time": r.appointment_datetime.strftime("%d %b, %I:%M %p"),
            "note": r.urgent_note or "Reason not specified",
            "internal_notes": r.internal_notes or ""
        } for r in filtered_requests],
        "next_patient": {
            "appt_id": actual_next.id,
            "name": actual_next.patient.user.full_name if actual_next.patient and actual_next.patient.user else "Unknown",
            "pic": actual_next.patient.profile_pic_url if actual_next.patient else "/static/images/default-profile.svg",
            "start_time": actual_next.appointment_datetime.strftime("%I:%M %p"),
            "end_time": (actual_next.appointment_datetime + timedelta(minutes=(actual_next.duration or 30))).strftime("%I:%M %p"),
            "problem_stated": actual_next.urgent_note or "Reason not specified",
            "internal_notes": actual_next.internal_notes or ""
        } if (actual_next := next((a for a in today_appts if a.status == 'Booked'), None)) else None
    })
    
    
@doctor_blueprint.route('/api/appointment/start/<int:appt_id>', methods=['POST'])
@login_required
@roles_required('Doctor')
def start_appointment(appt_id):
    doctor_id = current_user.doctor_profile.id

    Appointment.query.filter_by(doctor_id=doctor_id, status='Ongoing').update({"status": "Completed"})

    new_appt = Appointment.query.get_or_404(appt_id)
    
    if new_appt.doctor_id != doctor_id:
        return jsonify({"status": "error", "message": "Unauthorized"}), 403
        
    new_appt.status = 'Ongoing'

    if not new_appt.treatment:
        treatment = Treatment(appointment_id=new_appt.id)
        db.session.add(treatment)
        
    db.session.commit()
    return jsonify({"status": "success"})

@doctor_blueprint.route('/api/appointment/save-session/<int:appt_id>', methods=['POST'])
@login_required
@roles_required('Doctor')
def save_session(appt_id):
    try:
        appt = Appointment.query.get_or_404(appt_id)
        if appt.doctor_id != current_user.doctor_profile.id:
            return jsonify({"status": "error", "message": "Unauthorized"}), 403
        
        data = request.json or {}
        print(f"DEBUG: Saving session {appt_id}. Data: {data}")

        treatment = appt.treatment
        if not treatment:
            treatment = Treatment(appointment_id=appt.id)
            db.session.add(treatment)
        
        treatment.diagnosis = data.get('diagnosis', treatment.diagnosis)
        treatment.notes = data.get('problem_stated', treatment.notes)
        treatment.clinical_notes = data.get('clinical_notes', treatment.clinical_notes)

        prescriptions = data.get('prescriptions')
        if prescriptions is not None:

            treatment.prescriptions_json = prescriptions

        patient = appt.patient
        if 'medical_history' in data:
            patient.medical_history = data['medical_history']
        
        db.session.commit()
        return jsonify({"status": "success"})
    except Exception as e:
        import traceback
        error_msg = traceback.format_exc()
        print(f"CRITICAL ERROR in save_session: {error_msg}")
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

@doctor_blueprint.route('/api/appointment/upload-attachment/<int:appt_id>', methods=['POST'])
@login_required
@roles_required('Doctor')
def upload_attachment(appt_id):
    appt = Appointment.query.get_or_404(appt_id)
    if appt.doctor_id != current_user.doctor_profile.id:
        return jsonify({"status": "error", "message": "Unauthorized"}), 403
    
    if 'file' not in request.files:
        return jsonify({"status": "error", "message": "No file part"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"status": "error", "message": "No selected file"}), 400

    file_type = 'other'
    ext = file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else ''
    if ext in ['jpg', 'jpeg', 'png', 'gif', 'webp']: file_type = 'image'
    elif ext in ['mp4', 'webm', 'mov']: file_type = 'video'
    elif ext == 'pdf': file_type = 'pdf'
    
    filename = secure_filename(f"appt_{appt.id}_{int(datetime.now().timestamp())}_{file.filename}")
    upload_dir = os.path.join(current_app.root_path, 'static', 'uploads', 'treatments')
    os.makedirs(upload_dir, exist_ok=True)
    filepath = os.path.join(upload_dir, filename)
    file.save(filepath)

    treatment = appt.treatment
    if not treatment:
        treatment = Treatment(appointment_id=appt.id)
        db.session.add(treatment)
        db.session.commit()
    
    new_attachment = Attachment(
        treatment_id=treatment.id,
        file_path=f"/static/uploads/treatments/{filename}",
        file_type=file_type,
        filename=file.filename
    )
    db.session.add(new_attachment)
    db.session.commit()
    
    return jsonify({
        "status": "success",
        "attachment": {
            "id": new_attachment.id,
            "path": new_attachment.file_path,
            "type": new_attachment.file_type,
            "name": new_attachment.filename
        }
    })

@doctor_blueprint.route('/api/appointment/complete/<int:appt_id>', methods=['POST'])
@login_required
@roles_required('Doctor')
def complete_appointment(appt_id):
    try:
        appt = Appointment.query.get_or_404(appt_id)
        if appt.doctor_id != current_user.doctor_profile.id:
            return jsonify({"status": "error", "message": "Unauthorized"}), 403
        
        data = request.json or {}

        if data:
            treatment = appt.treatment
            if not treatment:
                treatment = Treatment(appointment_id=appt.id)
                db.session.add(treatment)
            
            treatment.diagnosis = data.get('diagnosis', treatment.diagnosis)
            treatment.notes = data.get('problem_stated', treatment.notes)
            treatment.clinical_notes = data.get('clinical_notes', treatment.clinical_notes)
            treatment.prescriptions_json = data.get('prescriptions', treatment.prescriptions_json)
            
            if 'medical_history' in data and appt.patient:
                appt.patient.medical_history = data['medical_history']

        appt.status = 'Completed'
        db.session.commit()
        return jsonify({"status": "success"})
    except Exception as e:
        print(f"ERROR in complete_appointment: {str(e)}")
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

@doctor_blueprint.route('/api/appointment/handle/<int:appt_id>/<string:status>', methods=['POST'])
@login_required
@roles_required('Doctor')
def handle_request(appt_id, status):
    appt = Appointment.query.get_or_404(appt_id)
    
    data = request.json or {}
    reason = data.get('reason')
    duration = int(data.get('duration', 30))

    if status == 'Booked':

        if not is_doctor_available(current_user.doctor_profile, appt.appointment_datetime):
            return jsonify({
                "status": "error",
                "message": "You need to add a slot for this time first then only you can accept this appointment."
            }), 400

        appt.duration = duration
        new_start = appt.appointment_datetime
        new_end = new_start + timedelta(minutes=duration)

        existing_appts = Appointment.query.filter(
            Appointment.doctor_id == appt.doctor_id,
            Appointment.status.in_(['Booked', 'Ongoing']),
            Appointment.id != appt_id
        ).all()

        for ex in existing_appts:
            ex_start = ex.appointment_datetime
            ex_end = ex_start + timedelta(minutes=ex.duration or 30)
            
            if ex_start < new_end and new_start < ex_end:
                return jsonify({
                    "status": "error", 
                    "message": f"Time Conflict! This overlaps with an appointment for {ex.patient.user.full_name} ({ex_start.strftime('%H:%M')} - {ex_end.strftime('%H:%M')})."
                }), 400

    appt.status = status
    if status == 'Rejected' and reason:
        appt.internal_notes = f"REJECTED: {reason}" 

    patient_user_id = appt.patient.user.id
    doctor_name = f"Dr. {current_user.full_name}"
    appt_time = appt.appointment_datetime.strftime("%d %b at %I:%M %p")

    if status == 'Booked':
        db.session.add(Notification(
            user_id=patient_user_id,
            message=f"✅ {doctor_name} has accepted your appointment on {appt_time}. You're all set!",
            type='success'
        ))
    elif status in ['Rejected', 'Declined', 'Cancelled']:
        reason_text = f" Reason: {reason}" if reason else ""
        db.session.add(Notification(
            user_id=patient_user_id,
            message=f"❌ {doctor_name} has {status.lower()} your appointment requested for {appt_time}.{reason_text}",
            type='danger'
        ))

    db.session.commit()
    return jsonify({"status": "success"})

@doctor_blueprint.route('/api/doctor/update-availability', methods=['POST'])
@login_required
@roles_required('Doctor')
def update_availability():
    doctor = current_user.doctor_profile
    doctor.availability = request.json 
    db.session.commit()
    return jsonify({"status": "success"})

@doctor_blueprint.route('/api/doctor/update-treatment-history/<int:appt_id>', methods=['POST'])
@login_required
@roles_required('Doctor')
def update_treatment_history(appt_id):
    data = request.json
    appt = Appointment.query.get_or_404(appt_id)

    if appt.doctor_id != current_user.doctor_profile.id:
        return jsonify({"status": "error", "message": "Unauthorized"}), 403

    if not appt.treatment:
        from app.models import Treatment
        appt.treatment = Treatment(appointment_id=appt.id)
        db.session.add(appt.treatment)

    treatment = appt.treatment
    treatment.diagnosis = data.get('diagnosis', treatment.diagnosis)
    treatment.clinical_notes = data.get('clinical_notes', treatment.clinical_notes)

    if 'complaint' in data:
        appt.urgent_note = data['complaint']
        treatment.notes = data['complaint']
        
    if 'patient_history' in data and appt.patient:
        appt.patient.medical_history = data['patient_history']

    if 'prescription' in data:
        treatment.prescription = data['prescription']

        treatment.prescriptions_json = [s.strip() for s in data['prescription'].split(',')] if data['prescription'] else []

    appt.updated_at = datetime.utcnow()
    db.session.commit()
    
    return jsonify({"status": "success"})

@doctor_blueprint.route('/appointments')
@login_required
@roles_required('Doctor')
def appointments_page():
    return render_template('doctor/appointments.html', user=current_user)

@doctor_blueprint.route('/api/doctor/appointments-list')
@login_required
@roles_required('Doctor')
def get_all_appointments():
    doctor = current_user.doctor_profile
    date_filter = request.args.get('date_range')
    query = Appointment.query.filter(Appointment.doctor_id == doctor.id)

    if date_filter:
        try:
            if ' to ' in date_filter:
                start_str, end_str = date_filter.split(' to ')
                start_date = datetime.strptime(start_str, '%Y-%m-%d')
                end_date = datetime.strptime(end_str, '%Y-%m-%d') + timedelta(days=1)
                query = query.filter(Appointment.appointment_datetime.between(start_date, end_date))
            else:
                single_date = datetime.strptime(date_filter, '%Y-%m-%d').date()
                query = query.filter(db.func.date(Appointment.appointment_datetime) == single_date)
        except ValueError:
            pass

    appointments = query.order_by(Appointment.appointment_datetime.desc(), Appointment.status.asc()).all()

    return jsonify([{
        "id": a.id,
        "patient_id": a.patient.id if a.patient else None,
        "patient_name": a.patient.user.full_name if a.patient and a.patient.user else "Unknown Patient",
        "patient_pic": a.patient.profile_pic_url if a.patient else "/static/images/default-profile.svg",
        "patient_gender": a.patient.gender if a.patient else "N/A",
        "patient_dob": a.patient.date_of_birth.strftime("%Y-%m-%d") if a.patient and a.patient.date_of_birth else None,
        "patient_history": a.patient.medical_history if a.patient else "",
        "datetime": a.appointment_datetime.strftime("%d %b %Y, %I:%M %p"),
        "raw_date": a.appointment_datetime.strftime("%Y-%m-%d"),
        "status": a.status,
        "is_urgent": a.is_urgent,
        "urgent_note": a.urgent_note or "",
        "internal_notes": a.internal_notes or "",
        "diagnosis": a.treatment.diagnosis if (a.treatment and a.treatment.diagnosis) else "",
        "clinical_notes": a.treatment.clinical_notes if (a.treatment and a.treatment.clinical_notes) else "",
        "prescriptions": a.treatment.prescriptions_json if (a.treatment and a.treatment.prescriptions_json) else [],
        "attachments": [{
            "id": att.id,
            "path": att.file_path,
            "type": att.file_type,
            "name": att.filename
        } for att in (a.treatment.attachments if a.treatment else [])],
        "payment_method": a.payment_method,
        "payment_status": a.payment_status,
        "amount": a.amount,
        "patient_email": a.patient.user.email if a.patient and a.patient.user else "N/A",
        "patient_phone": a.patient.contact_number if a.patient else "N/A"
    } for a in appointments])

@doctor_blueprint.route('/api/doctor/update-status', methods=['POST'])
@login_required
@roles_required('Doctor')
def update_status():
    data = request.json or {}
    new_override = data.get('status') 
    
    if new_override not in ['auto', 'available', 'busy', 'offline', 'break']:
        return jsonify({"status": "error", "message": "Invalid status"}), 400
        
    doctor = current_user.doctor_profile
    doctor.status_override = new_override
    db.session.commit()
    return jsonify({"status": "success"})

@doctor_blueprint.route('/api/doctor/patient-history/<int:patient_id>')
@login_required
@roles_required('Doctor')
def get_patient_history(patient_id):
    patient = Patient.query.get_or_404(patient_id)
    history = Appointment.query.filter(
        Appointment.patient_id == patient_id,
        Appointment.status == 'Completed'
    ).order_by(Appointment.appointment_datetime.desc()).all()
    
    return jsonify([{
        "id": h.id,
        "date": h.appointment_datetime.strftime("%d %b %Y"),
        "diagnosis": h.treatment.diagnosis if (h.treatment and h.treatment.diagnosis) else "N/A",
        "notes": h.treatment.clinical_notes if (h.treatment and h.treatment.clinical_notes) else (h.treatment.notes if h.treatment else ""),
        "primary_concern": h.urgent_note or "General Checkup"
    } for h in history])

@doctor_blueprint.route('/api/doctor/past-appointment-detail/<int:appt_id>')
@login_required
@roles_required('Doctor')
def get_past_appointment_detail(appt_id):
    appt = Appointment.query.get_or_404(appt_id)
    
    if appt.doctor_id != current_user.doctor_profile.id:
        return jsonify({"error": "Unauthorized"}), 403
    
    attachments = []
    if appt.treatment:
        attachments = [{
            "id": a.id,
            "path": a.file_path,
            "type": a.file_type,
            "name": a.filename
        } for a in appt.treatment.attachments]

    return jsonify({
        "id": appt.id,
        "date": appt.appointment_datetime.strftime("%d %b %Y"),
        "time": appt.appointment_datetime.strftime("%I:%M %p"),
        "is_urgent": appt.is_urgent,
        "patient_name": appt.patient.user.full_name,
        "patient_pic": appt.patient.profile_pic_url,
        "patient_history": appt.patient.medical_history,
        "doctor_name": f"Dr. {appt.doctor.user.full_name}",
        "doctor_pic": appt.doctor.profile_pic_url,
        "doctor_dept": appt.doctor.department.name if appt.doctor.department else "General Medicine",
        "complaint": appt.urgent_note or (appt.treatment.notes if appt.treatment else "Routine Follow-up"),
        "diagnosis": appt.treatment.diagnosis if appt.treatment else "N/A",
        "prescription": ", ".join(appt.treatment.prescriptions_json) if (appt.treatment and appt.treatment.prescriptions_json) else (appt.treatment.prescription if appt.treatment and appt.treatment.prescription else "None provided"),
        "notes": appt.treatment.clinical_notes if (appt.treatment and appt.treatment.clinical_notes) else "No additional clinical notes.",
        "attachments": attachments
    })

@doctor_blueprint.route('/api/doctor/appointment-detail/<int:appt_id>')
@login_required
@roles_required('Doctor')
def get_appointment_detail(appt_id):
    appt = Appointment.query.get_or_404(appt_id)

    if appt.doctor_id != current_user.doctor_profile.id:
        return jsonify({"error": "Unauthorized"}), 403

    meet_hash = hashlib.md5(f"meet-{appt.id}".encode()).hexdigest()[:12]
    meet_link = f"https://meet.google.com/pms-{meet_hash[:4]}-{meet_hash[4:8]}"

    attachments = []
    if appt.treatment:
        attachments = [{
            "id": a.id,
            "path": a.file_path,
            "type": a.file_type,
            "name": a.filename
        } for a in appt.treatment.attachments]

    start_dt = appt.appointment_datetime
    duration_mins = appt.duration or 30
    end_dt = start_dt + timedelta(minutes=duration_mins)

    return jsonify({
        "id": appt.id,
        "status": appt.status,
        "patient": {
            "id": appt.patient.id,
            "name": appt.patient.user.full_name,
            "pic": appt.patient.profile_pic_url,
            "gender": appt.patient.gender,
            "dob": appt.patient.date_of_birth.strftime("%Y-%m-%d") if appt.patient.date_of_birth else None,
            "age": appt.patient.age,
            "medical_history": appt.patient.medical_history or ""
        },
        "datetime": start_dt.strftime("%d %B %Y at %I:%M %p"),
        "start_time": start_dt.strftime("%I:%M %p"),
        "end_time": end_dt.strftime("%I:%M %p"),
        "duration": duration_mins,
        "diagnosis": appt.treatment.diagnosis if appt.treatment else "",
        "problem_stated": appt.treatment.notes if appt.treatment else (appt.urgent_note or ""),
        "clinical_notes": appt.treatment.clinical_notes if (appt.treatment and appt.treatment.clinical_notes) else "",
        "prescriptions": (appt.treatment.prescriptions_json if appt.treatment and appt.treatment.prescriptions_json is not None else []),
        "attachments": attachments,
        "meet_link": meet_link
    })
def cleanup_overdue_appointments(doctor_id):
    """Redundant self-healing logic in case background scheduler is down."""
    now = datetime.now()

    booked_threshold = now - timedelta(minutes=10)
    overdue_booked = Appointment.query.filter(
        Appointment.doctor_id == doctor_id,
        Appointment.status == 'Booked',
        Appointment.appointment_datetime < booked_threshold
    ).all()

    request_threshold = now + timedelta(minutes=10)
    overdue_requests = Appointment.query.filter(
        Appointment.doctor_id == doctor_id,
        Appointment.status == 'Requested',
        Appointment.appointment_datetime < request_threshold
    ).all()
    
    reason_missed = "Cancelled coz you didn't join on time. We've notified the patient for the same."
    reason_stale = "Doctor not able to take that. They didn't accept or reject the appointment in time."
    
    for appt in overdue_booked:
        appt.status = 'Cancelled'
        appt.internal_notes = f"CANCELLED: {reason_missed}"
        db.session.add(Notification(user_id=appt.patient.user.id, 
                                  message=f"Your {appt.appointment_datetime.strftime('%I:%M %p')} appointment was auto-cancelled. {reason_missed}", 
                                  type='danger'))
        db.session.add(Notification(user_id=appt.doctor.user.id, 
                                  message=f"Appointment with {appt.patient.user.full_name} was auto-cancelled. {reason_missed}", 
                                  type='warning'))

    for appt in overdue_requests:
        appt.status = 'Cancelled'
        appt.internal_notes = f"CANCELLED: {reason_stale}"
        db.session.add(Notification(user_id=appt.patient.user.id, 
                                  message=f"Your request for {appt.appointment_datetime.strftime('%I:%M %p')} was cancelled. {reason_stale}", 
                                  type='warning'))
        db.session.add(Notification(user_id=appt.doctor.user.id, 
                                  message=f"Request from {appt.patient.user.full_name} removed: {reason_stale}", 
                                  type='info'))
    
    if overdue_booked or overdue_requests:
        db.session.commit()
        print(f"[Self-Healing] Cleaned up {len(overdue_booked)} booked and {len(overdue_requests)} requests for doc {doctor_id}")

@doctor_blueprint.route('/api/doctor/profile-data')
@login_required
@roles_required('Doctor')
def get_profile_data():
    doctor = current_user.doctor_profile

    unique_patients = db.session.query(Patient).join(Appointment).filter(Appointment.doctor_id == doctor.id).distinct().count()
    
    return jsonify({
        "full_name": current_user.full_name,
        "email": current_user.email,
        "phone_number": doctor.phone_number or "",
        "department": doctor.department.name if doctor.department else "General",
        "profile_pic": doctor.profile_pic_url,
        "degree": doctor.degree or "",
        "experience": doctor.experience_years or 0,
        "tagline": doctor.tagline or "Dedicated to patient care",
        "about_me": doctor.about_me or "",
        "bio": doctor.bio or "",
        "fees": doctor.fees or 0.0,
        "unique_patients": unique_patients
    })

@doctor_blueprint.route('/api/doctor/profile-update', methods=['POST'])
@login_required
@roles_required('Doctor')
def update_profile_data():
    data = request.json or {}
    doctor = current_user.doctor_profile
    user = current_user
    
    if 'full_name' in data: user.full_name = data['full_name']
    if 'email' in data: user.email = data['email']
    if 'phone_number' in data: doctor.phone_number = data['phone_number']
    if 'degree' in data: doctor.degree = data['degree']
    if 'experience' in data: doctor.experience_years = int(data['experience'] or 0)
    if 'tagline' in data: doctor.tagline = data['tagline']
    if 'about_me' in data: doctor.about_me = data['about_me']
    if 'bio' in data: doctor.bio = data['bio']
    
    db.session.commit()
    return jsonify({"status": "success"})

@doctor_blueprint.route('/api/doctor/profile-image', methods=['POST'])
@login_required
@roles_required('Doctor')
def update_profile_image():
    import base64
    import os
    from flask import current_app
    
    data = request.json or {}
    image_data = data.get('image')
    action = data.get('action')
    
    try:
        if action == 'remove':
            current_user.doctor_profile.profile_pic_url = "/static/images/default-profile.svg"
            db.session.commit()
            return jsonify({"status": "success", "profile_pic": current_user.doctor_profile.profile_pic_url})
            
        if not image_data:
            return jsonify({"status": "error", "message": "No image data provided"}), 400

        if "base64," in image_data:
            header, image_data = image_data.split("base64,")

        upload_dir = os.path.join(current_app.root_path, 'static', 'uploads', 'profiles')
        os.makedirs(upload_dir, exist_ok=True)

        filename = f"doctor_{current_user.doctor_profile.id}_{int(datetime.now().timestamp())}.jpg"
        filepath = os.path.join(upload_dir, filename)
        
        with open(filepath, "wb") as f:
            f.write(base64.b64decode(image_data))

        current_user.doctor_profile.profile_pic_url = f"/static/uploads/profiles/{filename}"
        db.session.commit()
        
        return jsonify({"status": "success", "profile_pic": current_user.doctor_profile.profile_pic_url})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
