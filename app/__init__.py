# app/__init__.py
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from config import Config
from flask_security import Security, SQLAlchemyUserDatastore
from flask_bootstrap import Bootstrap

db = SQLAlchemy()
datastore = None 

def create_app():
    global datastore 
    
    # --- UPDATE THIS LINE ---
    # Point 'static_folder' to our new static directory
    app = Flask(__name__, template_folder='templates', static_folder='static')
    
    app.config.from_object(Config)
    Bootstrap(app)
    db.init_app(app)

    from . import models 
    
    datastore = SQLAlchemyUserDatastore(db, models.User, models.Role)
    app.security = Security(app, datastore)
    
    from .routes import main as main_blueprint
    app.register_blueprint(main_blueprint)

    with app.app_context():
        pass 

    return app