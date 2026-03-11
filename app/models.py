
from . import db
from datetime import datetime
from flask_security import UserMixin, RoleMixin
import uuid
import json 
import os 
from werkzeug.utils import secure_filename 
from sqlalchemy.dialects.sqlite import JSON as SQLiteJSON
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.mutable import MutableDict, MutableList
from sqlalchemy import func
from datetime import date

roles_users = db.Table('roles_users',
    db.Column('user_id', db.Integer(), db.ForeignKey('user.id')),
    db.Column('role_id', db.Integer(), db.ForeignKey('role.id'))
)

class Role(db.Model, RoleMixin):
    __tablename__ = 'role'
    id = db.Column(db.Integer(), primary_key=True)
    name = db.Column(db.String(80), unique=True)
    description = db.Column(db.String(255))

class User(db.Model, UserMixin):
    __tablename__ = 'user'
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    full_name = db.Column(db.String(255))
    active = db.Column(db.Boolean())
    confirmed_at = db.Column(db.DateTime())

    fs_uniquifier = db.Column(db.String(64), unique=True, nullable=False, default=lambda: str(uuid.uuid4()))
    created_at = db.Column(db.DateTime, default=datetime.now)

    roles = db.relationship('Role', secondary=roles_users,
                            backref=db.backref('users', lazy='dynamic'))
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
    phone_number = db.Column(db.String(20))
    bio = db.Column(db.Text)
    profile_pic_url = db.Column(db.String(255), default='/static/images/default-profile.svg')

    degree = db.Column(db.String(100))
    experience_years = db.Column(db.Integer, default=0)
    tagline = db.Column(db.String(255))
    about_me = db.Column(db.Text)
    fees = db.Column(db.Float, default=0.0)
    
    availability = db.Column(MutableDict.as_mutable(SQLiteJSON))
    status_override = db.Column(db.String(20), default='auto')

    user = db.relationship('User', back_populates='doctor_profile')

    department = db.relationship('Department', backref=db.backref('doctors', lazy=True))

    @property
    def unique_patients_count(self):


        from .models import Appointment
        count = db.session.query(func.count(func.distinct(Appointment.patient_id))).\
            filter(Appointment.doctor_id == self.id, Appointment.status == 'Completed').scalar()
        return count or 0
    
class Patient(db.Model):
    __tablename__ = 'patient'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), unique=True)
    contact_number = db.Column(db.String(20))
    medical_history = db.Column(db.Text)

    profile_pic_url = db.Column(db.String(255), default='/static/images/default-profile.svg')
    gender = db.Column(db.String(10))
    date_of_birth = db.Column(db.Date)
    status = db.Column(db.String(50), default='New')
    about_me = db.Column(db.Text)


    user = db.relationship('User', back_populates='patient_profile')

    @property
    def age(self):
        if not self.date_of_birth:
            return None
        today = date.today()
        return today.year - self.date_of_birth.year - ((today.month, today.day) < (self.date_of_birth.month, self.date_of_birth.day))


class Appointment(db.Model):
    __tablename__ = 'appointment'
    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey('patient.id'), nullable=False)
    doctor_id = db.Column(db.Integer, db.ForeignKey('doctor.id'), nullable=False)
    appointment_datetime = db.Column(db.DateTime, nullable=False)


    status = db.Column(db.String(20), default='Requested') 
    is_urgent = db.Column(db.Boolean, default=False)
    urgent_note = db.Column(db.Text)
    internal_notes = db.Column(db.Text)
    duration = db.Column(db.Integer, default=30)

    payment_method = db.Column(db.String(50))
    payment_status = db.Column(db.String(20), default='Pending')
    amount = db.Column(db.Float, default=0.0)
    
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)

    patient = db.relationship('Patient', backref=db.backref('appointments', lazy=True))
    doctor = db.relationship('Doctor', backref=db.backref('appointments', lazy=True))
    treatment = db.relationship('Treatment', back_populates='appointment', uselist=False)
    
    
class Treatment(db.Model):
    __tablename__ = 'treatment'
    id = db.Column(db.Integer, primary_key=True)
    appointment_id = db.Column(db.Integer, db.ForeignKey('appointment.id'), unique=True)
    diagnosis = db.Column(db.Text)
    prescription = db.Column(db.Text)
    prescriptions_json = db.Column(SQLiteJSON)
    notes = db.Column(db.Text)
    clinical_notes = db.Column(db.Text)

    appointment = db.relationship('Appointment', back_populates='treatment')
    attachments = db.relationship('Attachment', backref='treatment', lazy=True, cascade="all, delete-orphan")

class Attachment(db.Model):
    __tablename__ = 'attachment'
    id = db.Column(db.Integer, primary_key=True)
    treatment_id = db.Column(db.Integer, db.ForeignKey('treatment.id'), nullable=False)
    file_path = db.Column(db.String(255), nullable=False)
    file_type = db.Column(db.String(50))
    filename = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=datetime.now)

class Notification(db.Model):
    __tablename__ = 'notification'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    message = db.Column(db.Text, nullable=False)
    type = db.Column(db.String(20), default='info')
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.now)
    
    user = db.relationship('User', backref=db.backref('notifications', lazy=True))