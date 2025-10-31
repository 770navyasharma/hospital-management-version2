# app/models.py
from . import db
from datetime import datetime

# Association table for the many-to-many relationship between Users and Roles
roles_users = db.Table('roles_users',
    db.Column('user_id', db.Integer(), db.ForeignKey('user.id')),
    db.Column('role_id', db.Integer(), db.ForeignKey('role.id'))
)

class Role(db.Model):
    __tablename__ = 'role'
    id = db.Column(db.Integer(), primary_key=True)
    name = db.Column(db.String(80), unique=True)
    description = db.Column(db.String(255)) # For Flask-Security

class User(db.Model):
    __tablename__ = 'user'
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False) # We will hash this
    full_name = db.Column(db.String(255))
    active = db.Column(db.Boolean()) # For Flask-Security
    # Define the many-to-many relationship
    roles = db.relationship('Role', secondary=roles_users,
                            backref=db.backref('users', lazy='dynamic'))

    # One-to-one relationships for profiles
    doctor_profile = db.relationship('Doctor', back_populates='user', uselist=False)
    patient_profile = db.relationship('Patient', back_populates='user', uselist=False)

class Department(db.Model):
    __tablename__ = 'department'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    description = db.Column(db.Text)

class Doctor(db.Model):
    __tablename__ = 'doctor'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), unique=True)
    department_id = db.Column(db.Integer, db.ForeignKey('department.id'))
    availability = db.Column(db.JSON) # Store availability, e.g., {"Mon": "9am-5pm", ...}
    
    # Define the 1-to-1 relationship with User
    user = db.relationship('User', back_populates='doctor_profile')
    # Define the 1-to-N relationship with Department
    department = db.relationship('Department', backref=db.backref('doctors', lazy=True))
    
class Patient(db.Model):
    __tablename__ = 'patient'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), unique=True)
    contact_number = db.Column(db.String(20))
    medical_history = db.Column(db.Text) # Simple medical history
    
    # Define the 1-to-1 relationship with User
    user = db.relationship('User', back_populates='patient_profile')

class Appointment(db.Model):
    __tablename__ = 'appointment'
    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey('patient.id'), nullable=False)
    doctor_id = db.Column(db.Integer, db.ForeignKey('doctor.id'), nullable=False)
    appointment_datetime = db.Column(db.DateTime, nullable=False)
    status = db.Column(db.String(20), default='Booked') # Booked / Completed / Cancelled
    
    # Define relationships
    patient = db.relationship('Patient', backref=db.backref('appointments', lazy=True))
    doctor = db.relationship('Doctor', backref=db.backref('appointments', lazy=True))
    
    # Define 1-to-1 relationship with Treatment
    treatment = db.relationship('Treatment', back_populates='appointment', uselist=False)

class Treatment(db.Model):
    __tablename__ = 'treatment'
    id = db.Column(db.Integer, primary_key=True)
    appointment_id = db.Column(db.Integer, db.ForeignKey('appointment.id'), unique=True)
    diagnosis = db.Column(db.Text)
    prescription = db.Column(db.Text)
    notes = db.Column(db.Text)

    # Define the 1-to-1 relationship with Appointment
    appointment = db.relationship('Appointment', back_populates='treatment')