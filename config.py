# config.py
import os
from datetime import timedelta

basedir = os.path.abspath(os.path.dirname(__file__))

class Config:
    SQLALCHEMY_DATABASE_URI = 'sqlite:///' + os.path.join(basedir, 'hospital.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'a-very-hard-to-guess-string'
    
    # --- Authentication & Session Management ---
    SESSION_PROTECTION = 'strong'
    
    # --- Flask-Security-Too Settings ---
    SECURITY_PASSWORD_SALT = os.environ.get('SECURITY_PASSWORD_SALT') or 'a-very-secure-salt'
    SECURITY_REMEMBER_SALT = os.environ.get('SECURITY_REMEMBER_SALT') or 'a-very-secure-remember-salt'
    SECURITY_REGISTERABLE = False 
    SECURITY_POST_LOGIN_VIEW = '/dashboard'
    SECURITY_POST_REGISTER_VIEW = '/dashboard'
    SECURITY_SEND_REGISTER_EMAIL = False
    SECURITY_UNAUTHORIZED_VIEW = '/login'
    SECURITY_USER_IDENTITY_ATTRIBUTES = [
    {"email": {"mapper": None, "case_insensitive": True}}
]
    
    SECURITY_HASHING_SCHEMES = ['bcrypt']
    SECURITY_DEPRECATED_HASHING_SCHEMES = []
    # --- File Upload Settings ---
    UPLOAD_FOLDER = os.path.join(basedir, 'app/static/uploads')
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'svg'}
    
    # --- Recovery Features ---
    SECURITY_RECOVERABLE = True  # Enables /forgot-password route
    SECURITY_EMAIL_SENDER = "no-reply@hms.com"
    
    
    # This makes the "email" content print to your terminal for testing
    # instead of actually trying to connect to a mail server
    MAIL_BACKEND = 'console' 
    SECURITY_EMAIL_SUBJECT_PASSWORD_RESET = "Password Reset Request - HMS"
    
    # Keep Bcrypt for passwords
    SECURITY_PASSWORD_HASH = 'bcrypt'
    
    # 🟢 FIX: This tells Flask-Security to use SHA512 for internal tokens 
    # instead of trying to Bcrypt an already hashed password.
    SECURITY_HASHING_SCHEMES = ['sha256_crypt', 'bcrypt']
    SECURITY_DEPRECATED_HASHING_SCHEMES = []

    # This is also helpful to prevent the 72-byte error during reset
    SECURITY_PASSWORD_SINGLE_HASH = True