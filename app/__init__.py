# app/__init__.py
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from config import Config

# Initialize the database extension
db = SQLAlchemy()

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Initialize the db with our app
    db.init_app(app)

    # We'll create the models file next
    with app.app_context():
        from . import models  # Import models
        db.create_all()     # Create database tables for our models

    return app