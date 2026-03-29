from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager

# Single instances imported everywhere – avoids circular imports
db = SQLAlchemy()
login_manager = LoginManager()
login_manager.login_view = "auth.login"
login_manager.login_message_category = "info"