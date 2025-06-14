from fastapi import APIRouter, Depends
import httpx
from openai import OpenAI
import os
import logging
from dotenv import load_dotenv
from fastapi import HTTPException, status
# 配置代理

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()
proxies = {
    "http://": "http://127.0.0.1:7897",
    "https://": "http://127.0.0.1:7897",
}

http_client = httpx.Client(proxies=proxies)  

# 初始化OpenAI客户端
client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    base_url="https://api.vveai.com/v1/",
    http_client=http_client
)

# 使用client而不是openai模块Exception, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from pydantic import BaseModel
from typing import Optional

from app.models import User, SessionLocal
from app.schemas import UserCreate, UserResponse, Token, UserUpdate, PasswordUpdate, AdminUserUpdate, PasswordResetRequest, PasswordResetConfirm # 新增导入
from app.email_service import send_reset_password_email, send_password_changed_notification # 导入邮件服务

# JWT配置
SECRET_KEY = "your-secret-key-for-jwt"  # 生产环境应使用安全的密钥
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# 密码哈希
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

router = APIRouter()

# 依赖项：获取数据库会话
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# 验证密码
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

# 生成密码哈希
def get_password_hash(password):
    return pwd_context.hash(password)

# 验证用户
def authenticate_user(db: Session, username: str, password: str):
    user = db.query(User).filter(User.username == username).first()
    if not user or not verify_password(password, user.hashed_password):
        return False
    return user

# 创建访问令牌
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# 获取当前用户
async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无效的认证凭据",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
    return user

# 注册新用户
@router.post("/register", response_model=UserResponse)
def register_user(user: UserCreate, db: Session = Depends(get_db)):
    try:
        print(f"Received registration request for user: {user.username}, email: {user.email}")
        
        # 检查用户名是否已存在
        db_user = db.query(User).filter(User.username == user.username).first()
        if db_user:
            print(f"Username {user.username} already exists")
            raise HTTPException(status_code=400, detail="用户名已注册")
            
        # 检查邮箱是否已存在
        db_user_email = db.query(User).filter(User.email == user.email).first()
        if db_user_email:
            print(f"Email {user.email} already exists")
            raise HTTPException(status_code=400, detail="邮箱已注册")
        
        try:
            hashed_password = get_password_hash(user.password)
            # 确保注册时 is_admin 为 False
            db_user = User(username=user.username, email=user.email, hashed_password=hashed_password, is_admin=False)
            db.add(db_user)
            db.commit()
            db.refresh(db_user)
            print(f"Successfully registered user: {user.username}")
            return db_user
        except Exception as e:
            print(f"Database error during registration: {str(e)}")
            db.rollback()
            raise HTTPException(status_code=500, detail=f"数据库错误: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Unexpected error during registration: {str(e)}")
        raise HTTPException(status_code=500, detail=f"注册失败: {str(e)}")

# 用户登录获取令牌
@router.post("/login", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

# OAuth2标准token端点（兼容OAuth2PasswordBearer）
@router.post("/token", response_model=Token)
async def login_for_access_token_oauth2(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """
    OAuth2标准登录端点
    
    与/login端点功能相同，但遵循OAuth2标准路径
    用于兼容OAuth2PasswordBearer的tokenUrl配置
    """
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

# 获取当前用户信息
@router.get("/users/me/", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

# 新增：更新当前用户信息（例如邮箱）
@router.put("/users/me/info", response_model=UserResponse, tags=["用户管理"]) # 更改路径以避免与 main.py 中的冲突
async def update_user_info_endpoint(user_update: UserUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if user_update.email:
        # 检查邮箱是否已被其他用户使用
        existing_user = db.query(User).filter(User.email == user_update.email).first()
        if existing_user and existing_user.id != current_user.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="邮箱已被注册")
        current_user.email = user_update.email
    
    db.commit()
    db.refresh(current_user)
    return current_user

# 新增：修改当前用户密码
@router.put("/users/me/password", tags=["用户管理"]) # 更改路径以避免与 main.py 中的冲突
async def update_password_endpoint(password_update: PasswordUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # 移除当前密码验证，直接允许更新密码
    current_user.hashed_password = get_password_hash(password_update.new_password)
    db.commit()
    return {"message": "密码修改成功"}

# 管理员获取所有用户列表
@router.get("/users/", response_model=list[UserResponse])
async def read_all_users(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="仅管理员可查看所有用户")
    users = db.query(User).all()
    return users

# 管理员根据ID获取特定用户信息
@router.get("/users/{user_id}", response_model=UserResponse)
async def read_user_by_id(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.is_admin:
        # 普通用户只能获取自己的信息，如果 user_id 与 current_user.id 不匹配则禁止
        if current_user.id != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="没有权限查看此用户信息")
    
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")
    return target_user

# 更新用户信息 - 示例，管理员可以更新其他用户信息
@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user_info(user_id: int, user_update: AdminUserUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="没有权限操作")
    
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")

    # 管理员只能修改用户的 is_admin 状态
    db_user.is_admin = user_update.is_admin

    db.commit()
    db.refresh(db_user)
    return db_user

# 管理员删除用户
@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_by_admin(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="没有权限操作")

    user_to_delete = db.query(User).filter(User.id == user_id).first()
    if not user_to_delete:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")

    # 防止管理员删除自己 (可选逻辑)
    if user_to_delete.id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="管理员不能删除自己")

    db.delete(user_to_delete)
    db.commit()
    return 

# 管理员创建用户 - 示例
@router.post("/admin/create_user", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def admin_create_user(user_data: UserCreate, db: Session = Depends(get_db), current_admin: User = Depends(get_current_user)):
    if not current_admin.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="仅管理员可创建用户")

    existing_user = db.query(User).filter((User.username == user_data.username) | (User.email == user_data.email)).first()
    if existing_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="用户名或邮箱已存在")

    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hashed_password,
        is_admin=user_data.is_admin  # 管理员创建用户时可以指定 is_admin
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

# 重置密码
@router.post("/reset-password")
async def reset_password(request: PasswordResetRequest, db: Session = Depends(get_db)):
    """
    重置密码接口
    
    用户提供邮箱，系统发送重置密码链接
    
    不需要认证
    """
    try:
        # 检查邮箱是否存在
        user = db.query(User).filter(User.email == request.email).first()
        if not user:
            # 为了安全考虑，即使邮箱不存在也返回成功消息，避免暴露用户信息
            return {"message": "如果该邮箱已注册，重置密码链接已发送到您的邮箱"}
        
        # 生成重置令牌
        reset_token = create_access_token(
            data={"sub": user.username, "type": "reset"},
            expires_delta=timedelta(hours=1)
        )
        
        # 发送重置密码邮件
        email_sent = await send_reset_password_email(request.email, reset_token)
        
        if not email_sent:
            logger.error(f"发送重置密码邮件失败: {request.email}")
            raise HTTPException(status_code=500, detail="发送邮件失败，请稍后重试")
        
        return {"message": "重置密码链接已发送到您的邮箱"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"重置密码失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"重置密码失败: {str(e)}")

# 验证重置令牌并设置新密码
@router.post("/reset-password/confirm")
async def confirm_reset_password(
    request: PasswordResetConfirm,
    db: Session = Depends(get_db)
):
    """
    确认重置密码接口
    
    用户提供重置令牌和新密码，系统更新密码
    
    不需要认证
    """
    try:
        # 验证令牌
        try:
            payload = jwt.decode(request.token, SECRET_KEY, algorithms=[ALGORITHM])
            username = payload.get("sub")
            token_type = payload.get("type")
            
            if not username or token_type != "reset":
                raise HTTPException(status_code=400, detail="无效的重置令牌")
        except JWTError:
            raise HTTPException(status_code=400, detail="无效的重置令牌")
        
        # 更新密码
        user = db.query(User).filter(User.username == username).first()
        if not user:
            raise HTTPException(status_code=404, detail="用户不存在")
        
        user.hashed_password = get_password_hash(request.new_password)
        db.commit()
        
        # 发送密码更改通知邮件
        await send_password_changed_notification(user.email, user.username)
        
        return {"message": "密码重置成功"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"重置密码失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"重置密码失败: {str(e)}")
