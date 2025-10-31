# config.py
import os

basedir = os.path.abspath(os.path.dirname(__file__))

class Config:
    SQLALCHEMY_DATABASE_URI = 'sqlite:///' + os.path.join(basedir, 'hospital.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Secret key for sessions and security
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'a-very-hard-to-guess-string'
    
    # Flask-Security settings
    SECURITY_PASSWORD_SALT = os.environ.get('SECURITY_PASSWORD_SALT') or 'a-very-secure-salt'
    
    # --- CRITICAL FIX 1 ---
    # We are handling registration *manually* via our /patient-register route.
    # We must disable the default /register route from Flask-Security.
    SECURITY_REGISTERABLE = False 
    
    SECURITY_POST_LOGIN_VIEW = '/dashboard'     # Redirect here after login
    SECURITY_POST_REGISTER_VIEW = '/dashboard'  # Redirect here after (our custom) register
    SECURITY_SEND_REGISTER_EMAIL = False        # Don't send emails
    SECURITY_UNAUTHORIZED_VIEW = '/login'       # Show this page if not logged in
    
    # --- CRITICAL FIX 2 ---
    # Revert to the stable tuple format. The complex dict is for features we don't need
    # and is likely causing issues. This works for Flask-Security v4 and v5+.
    SECURITY_USER_IDENTITY_ATTRIBUTES = [
    {"email": {"mapper": None, "case_insensitive": True}}
]
    
    SECURITY_HASHING_SCHEMES = ['bcrypt']       
    SECURITY_DEPRECATED_HASHING_SCHEMES = []
    
    # --- NEW: Enable Bootstrap ---
    BOOTSTRAP_SERVE_LOCAL = True