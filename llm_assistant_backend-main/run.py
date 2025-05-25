import uvicorn
import sys
print(sys.executable)

import httpx
print("httpx version:", httpx.__version__)

from app.models import create_tables

if __name__ == "__main__":
    # 初始化数据库表
    create_tables()
    
    # 启动FastAPI应用
    # 参数说明:
    # app: 应用模块路径
    # host: 监听地址，0.0.0.0表示监听所有网络接口
    # port: 监听端口
    # reload: 是否在代码变更时自动重启（开发模式下使用）
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True) 