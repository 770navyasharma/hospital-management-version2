from app import create_app, db
from app.models import User
from flask_security import utils

app = create_app()
with app.app_context():
    # Replace with the email you forgot the password for
    user = User.query.filter_by(email="navyasharmaa56@rh.com").first()
    if user:
        user.password = utils.hash_password("password123")
        db.session.commit()
        print(f"Password for {user.email} reset to: password123")
    else:
        print("User not found.")