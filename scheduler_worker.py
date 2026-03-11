import sys
import os
import time
from datetime import datetime, timedelta

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__))))

from app import create_app, db
from app.models import Appointment, Notification, User

def run_scheduler():
    app = create_app()
    # Ensure SQLite handles concurrent access gracefully
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {'connect_args': {'timeout': 20}}
    
    with app.app_context():
        print(f"[{datetime.now()}] Scheduler worker started (Local Time)...")
        
        while True:
            try:
                # Use local time for all comparisons as appt_datetime is local
                now = datetime.now()
                
                # 1. Check for 10-minute reminders (Booked in 10 mins)
                reminder_window_start = now + timedelta(minutes=9)
                reminder_window_end = now + timedelta(minutes=11)
                
                upcoming = Appointment.query.filter(
                    Appointment.status == 'Booked',
                    Appointment.appointment_datetime.between(reminder_window_start, reminder_window_end)
                ).all()
                
                for appt in upcoming:
                    doc_name = appt.doctor.user.full_name if (appt.doctor and appt.doctor.user) else 'your doctor'
                    prefix = "Dr. " if not doc_name.startswith("Dr.") else ""
                    msg = f"Reminder: You have an appointment with {prefix + doc_name} in 10 minutes."
                    
                    if not Notification.query.filter_by(user_id=appt.patient.user.id, message=msg).first():
                        db.session.add(Notification(user_id=appt.patient.user.id, message=msg, type='info'))
                    
                    d_msg = f"Reminder: Your appointment with {appt.patient.user.full_name} starts in 10 minutes."
                    if not Notification.query.filter_by(user_id=appt.doctor.user.id, message=d_msg).first():
                        db.session.add(Notification(user_id=appt.doctor.user.id, message=d_msg, type='info'))

                # 2. Auto-Cancellation for Missed Appointments (Booked > 10 mins ago)
                booked_threshold = now - timedelta(minutes=10)
                missed_booked = Appointment.query.filter(
                    Appointment.status == 'Booked',
                    Appointment.appointment_datetime < booked_threshold
                ).all()
                
                for appt in missed_booked:
                    appt.status = 'Cancelled'
                    reason = "Cancelled coz you didn't join on time. We've notified the patient for the same."
                    appt.internal_notes = f"CANCELLED: {reason}"
                    
                    db.session.add(Notification(user_id=appt.patient.user.id, 
                                              message=f"Your {appt.appointment_datetime.strftime('%I:%M %p')} appointment was auto-cancelled. {reason}", 
                                              type='danger'))
                    db.session.add(Notification(user_id=appt.doctor.user.id, 
                                              message=f"Appointment at {appt.appointment_datetime.strftime('%I:%M %p')} was auto-cancelled. {reason}", 
                                              type='warning'))
                    print(f"[{datetime.now()}] Auto-cancelled missed booked {appt.id}")

                # 3. Auto-Cancellation for Stale Requests (Requested < 10 mins from now)
                request_threshold = now + timedelta(minutes=10)
                stale_requests = Appointment.query.filter(
                    Appointment.status == 'Requested',
                    Appointment.appointment_datetime < request_threshold
                ).all()

                for appt in stale_requests:
                    appt.status = 'Cancelled'
                    reason = "Doctor not able to take that. They didn't accept or reject the appointment in time."
                    appt.internal_notes = f"CANCELLED: {reason}"
                    
                    db.session.add(Notification(user_id=appt.patient.user.id, 
                                              message=f"Your request for {appt.appointment_datetime.strftime('%I:%M %p')} was cancelled. {reason}", 
                                              type='warning'))
                    db.session.add(Notification(user_id=appt.doctor.user.id, 
                                              message=f"Request at {appt.appointment_datetime.strftime('%I:%M %p')} unhandled: {reason}", 
                                              type='info'))
                    print(f"[{datetime.now()}] Auto-cancelled stale request {appt.id}")
                
                db.session.commit()
                
            except Exception as e:
                print(f"[{datetime.now()}] Scheduler Error Loop: {str(e)}")
                db.session.rollback()
            
            time.sleep(60)

if __name__ == "__main__":
    run_scheduler()
