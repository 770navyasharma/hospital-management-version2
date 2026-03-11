
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from config import Config
from flask_security import Security, SQLAlchemyUserDatastore
from flask_migrate import Migrate
from flask_cors import CORS
from flask_mail import Mail, email_dispatched

db = SQLAlchemy()
datastore = None 
migrate = Migrate()
mail = Mail()

def log_mail(message, app):
    print("\n" + "="*50)
    print("📩  EMAIL SENT TO CONSOLE")
    print(f"To: {message.recipients}")
    print(f"Subject: {message.subject}")
    print("-" * 50)
    print(message.body)
    print("="*50 + "\n")

def create_app():
    global datastore 
    
    app = Flask(__name__, template_folder='templates', static_folder='static')
    CORS(app)
    app.config.from_object(Config)
    
    
    db.init_app(app)
    migrate.init_app(app, db)
    mail.init_app(app)
    email_dispatched.connect(log_mail, app)

    from . import models 
    
    datastore = SQLAlchemyUserDatastore(db, models.User, models.Role)
    app.security = Security(app, datastore)
    
    from .routes import main as main_blueprint
    app.register_blueprint(main_blueprint)

    from .doctor_routes import doctor_blueprint
    from .patient_routes import patient_blueprint
    app.register_blueprint(doctor_blueprint, url_prefix='/doctor')
    app.register_blueprint(patient_blueprint, url_prefix='/patient')

    with app.app_context():
        pass 

    return app