from sqlalchemy import Column, Integer, String, create_engine, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
import logging
from passlib.context import CryptContext

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 密码哈希
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# 创建数据库连接
DATABASE_URL = "sqlite:///./assistant.db"
try:
    logger.info(f"Connecting to database at {DATABASE_URL}")
    engine = create_engine(DATABASE_URL, echo=True)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base = declarative_base()
    logger.info("Database connection established successfully")
except Exception as e:
    logger.error(f"Failed to connect to database: {str(e)}")
    raise

# 用户模型
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_admin = Column(Boolean, default=False) # 新增管理员字段

# 新增：聊天记录模型
class ChatHistory(Base):
    __tablename__ = "chat_history"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(String, index=True)
    user_id = Column(Integer, index=True) #  ForeignKey("users.id") 理论上应该加，但为了简化，暂时不加外键约束
    role = Column(String)  # 'user' or 'assistant'
    message = Column(String)
    agent_type = Column(String) # 记录当时使用的agent_type

# 创建数据库表
def create_tables():
    try:
        logger.info("Creating database tables...")
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created successfully")
        
        # 创建测试用户
        create_test_user()
    except Exception as e:
        logger.error(f"Failed to create database tables: {str(e)}")
        raise

def create_test_user():
    try:
        db = SessionLocal()
        # 检查测试用户是否已存在
        test_user = db.query(User).filter(User.username == "test").first()
        if not test_user:
            hashed_password = pwd_context.hash("test123")
            test_user = User(
                username="test",
                email="test@example.com",
                hashed_password=hashed_password,
                is_admin=True  # 设置为管理员
            )
            db.add(test_user)
            db.commit()
            logger.info("Test user created successfully")
        else:
            # 如果用户已存在，更新为管理员
            test_user.is_admin = True
            db.commit()
            logger.info("Test user updated to admin")
    except Exception as e:
        logger.error(f"Failed to create test user: {str(e)}")
        db.rollback()
    finally:
        db.close()