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