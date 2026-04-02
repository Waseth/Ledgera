from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from flask_cors import CORS

# Single instances imported everywhere – avoids circular imports
db = SQLAlchemy()
login_manager = LoginManager()
cors = CORS()
login_manager.login_view = "auth.login"
login_manager.login_message_category = "info"
login_manager.session_protection = "strong"