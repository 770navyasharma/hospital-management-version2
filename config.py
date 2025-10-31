# config.py
import os

# Get the absolute path of the directory where this file is
basedir = os.path.abspath(os.path.dirname(__file__))

class Config:
    # We're using SQLite.
    SQLALCHEMY_DATABASE_URI = 'sqlite:///' + os.path.join(basedir, 'hospital.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False