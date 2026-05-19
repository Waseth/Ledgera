import os
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY")
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY")
    JWT_EXPIRATION_HOURS = int(os.environ.get("JWT_EXPIRATION_HOURS", 168))

    # Database
    DATABASE_URL = os.environ.get("DATABASE_URL") or os.environ.get("MYSQL_URL")

    if DATABASE_URL:
        SQLALCHEMY_DATABASE_URI = DATABASE_URL.replace('mysql://', 'mysql+pymysql://')
        SQLALCHEMY_ENGINE_OPTIONS = {
            "pool_size": 3,
            "pool_recycle": 300,
            "pool_pre_ping": True,
            "max_overflow": 0,
            "pool_timeout": 10,
        }
    else:
        DB_TYPE = os.environ.get("DB_TYPE", "sqlite")

        if DB_TYPE == "mysql":
            SQLALCHEMY_DATABASE_URI = (
                f"mysql+pymysql://{os.environ.get('MYSQL_USER', 'root')}:"
                f"{os.environ.get('MYSQL_PASSWORD', '')}@"
                f"{os.environ.get('MYSQL_HOST', 'localhost')}:"
                f"{os.environ.get('MYSQL_PORT', '3306')}/"
                f"{os.environ.get('MYSQL_DATABASE', 'ledgera')}"
            )
            SQLALCHEMY_ENGINE_OPTIONS = {
                "pool_size": 10,
                "pool_recycle": 3600,
                "pool_pre_ping": True,
            }
        else:
            SQLALCHEMY_DATABASE_URI = f"sqlite:///{os.path.join(BASE_DIR, 'ledgera.db')}"
            SQLALCHEMY_ENGINE_OPTIONS = {
                "connect_args": {"check_same_thread": False},
                "pool_size": 1,
                "max_overflow": 0,
            }

    SQLALCHEMY_TRACK_MODIFICATIONS = False

    ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL")
    ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD")
    ADMIN_PASSWORD_HASH = None

    LOW_STOCK_THRESHOLD = int(os.environ.get("LOW_STOCK_THRESHOLD", "5"))

    PRODUCT_LIST_LIMIT = 200
    NOTIFICATION_LIMIT = 20
    REPORT_SALE_LIMIT = 500
