# run.py
import os
import threading
from app import create_app, db
from scheduler_worker import run_scheduler

app = create_app()

def start_scheduler():
    scheduler_thread = threading.Thread(target=run_scheduler, daemon=True)
    scheduler_thread.start()

if __name__ == '__main__':
    # Only launch the thread in the main Werkzeug process to avoid duplicate firing
    if os.environ.get('WERKZEUG_RUN_MAIN') == 'true' or not app.debug:
        start_scheduler()
        
    app.run(debug=True)