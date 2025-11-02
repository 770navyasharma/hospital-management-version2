# app/__init__.py
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from config import Config
from flask_security import Security, SQLAlchemyUserDatastore
from flask_migrate import Migrate

db = SQLAlchemy()
datastore = None 
migrate = Migrate()

def create_app():
    global datastore 
    
    app = Flask(__name__, template_folder='templates', static_folder='static')
    app.config.from_object(Config)
    
    
    db.init_app(app)
    migrate.init_app(app, db)

    from . import models 
    
    datastore = SQLAlchemyUserDatastore(db, models.User, models.Role)
    app.security = Security(app, datastore)
    
    from .routes import main as main_blueprint
    app.register_blueprint(main_blueprint)

    with app.app_context():
        pass 

    return app