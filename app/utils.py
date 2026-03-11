from datetime import datetime

def is_doctor_available(doctor, dt):
    if not doctor.availability:
        return False
    date_str = dt.strftime('%Y-%m-%d')
    appt_time = dt.time()
    slots = doctor.availability.get(date_str, [])
    
    for slot in slots:
        try:
            parts = [s.strip() for s in slot.split('-')]
            if len(parts) < 2: continue
            
            start_time = datetime.strptime(parts[0], "%H:%M").time()
            end_time = datetime.strptime(parts[1], "%H:%M").time()
            
            if start_time <= appt_time < end_time:
                return True
        except Exception:
            continue
    return False
