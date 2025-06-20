from sqlalchemy import Column, Integer, String, create_engine, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship, Session
import os
import logging
from passlib.context import CryptContext
from datetime import datetime

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
    documents = relationship("KnowledgeDocument", back_populates="user", cascade="all, delete-orphan")

# 新增：聊天记录模型
class ChatHistory(Base):
    __tablename__ = "chat_history"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(String, index=True)
    user_id = Column(Integer, index=True) #  ForeignKey("users.id") 理论上应该加，但为了简化，暂时不加外键约束
    role = Column(String)  # 'user' or 'assistant'
    message = Column(String)
    agent_type = Column(String) # 记录当时使用的agent_type

# 新增：会话标题模型
class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String, primary_key=True, index=True)  # conversation_id
    user_id = Column(Integer, index=True)
    title = Column(String, default="")  # 用户自定义标题
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# 知识库文档模型
class KnowledgeDocument(Base):
    """知识库文档模型"""
    __tablename__ = "knowledge_documents"

    id = Column(String, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    filename = Column(String)  # 存储系统生成的文件名
    original_filename = Column(String)  # 存储原始文件名
    custom_filename = Column(String, nullable=True)  # 新增：自定义文档名
    upload_time = Column(DateTime)
    status = Column(String)  # processing, processed, failed
    chunk_count = Column(Integer, default=0)
    vector_db_reference = Column(String)  # JSON格式存储向量索引信息

    # 关联关系
    user = relationship("User", back_populates="documents")
    
    @classmethod
    def cleanup_invalid_documents(cls, db: Session, valid_doc_ids: set):
        """清理无效的文档记录"""
        try:
            # 查找所有不在valid_doc_ids中的文档
            invalid_docs = db.query(cls).filter(~cls.id.in_(valid_doc_ids)).all()
            for doc in invalid_docs:
                db.delete(doc)
            db.commit()
            logger.info(f"已清理 {len(invalid_docs)} 个无效文档记录")
            return len(invalid_docs)
        except Exception as e:
            logger.error(f"清理无效文档记录失败: {str(e)}")
            db.rollback()
            return 0

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