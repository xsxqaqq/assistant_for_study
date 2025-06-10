from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from app.chat import router as chat_router
from app.summary import router as summary_router
from app.auth import router as auth_router, get_current_user  # 修正导入
from app.models import create_tables, User  # 确保 User 被导入
from app.schemas import UserUpdate, PasswordUpdate, UserResponse, AdminUserUpdate  # 确保模型被导入
from app.dashboard import router as dashboard_router

# 创建FastAPI应用
app = FastAPI(
    title="大模型助教系统",
    description="提供用户认证、智能问答和讲义摘要功能的API",
    version="1.0.0"
)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 在生产环境中应该限制为前端域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 创建数据库表
create_tables()

# 注册路由
app.include_router(auth_router, prefix="/auth", tags=["认证"])
app.include_router(chat_router, prefix="/chat", tags=["聊天"])
app.include_router(summary_router, prefix="/summary", tags=["摘要"])
app.include_router(dashboard_router, prefix="/dashboard", tags=["仪表盘"])

# 新增用户管理相关端点
@app.get("/auth/user", response_model=UserResponse, tags=["用户管理"])
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """获取当前用户信息"""
    return current_user

@app.put("/users/me", response_model=UserResponse, tags=["用户管理"])
async def update_current_user_info(user_update: UserUpdate, current_user: User = Depends(get_current_user)):
    return await auth_router.update_user_info(user_id=current_user.id, user_update=user_update)

@app.put("/users/me/password", tags=["用户管理"])
async def update_current_user_password(password_update: PasswordUpdate, current_user: User = Depends(get_current_user)):
    return await auth_router.update_password(user_id=current_user.id, password_update=password_update)

@app.get("/")
async def root():
    return {"message": "欢迎使用大模型助教系统API"}
