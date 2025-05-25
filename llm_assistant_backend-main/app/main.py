from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from app.chat import router as chat_router
from app.summary import router as summary_router
from app.auth import router as auth_router
from app.models import create_tables

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

@app.get("/")
async def root():
    return {"message": "欢迎使用大模型助教系统API"}
