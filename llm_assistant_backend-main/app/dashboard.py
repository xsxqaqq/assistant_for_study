# llm_assistant_backend-main/app/dashboard.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct
from typing import List

from app.auth import get_current_user, get_db
from app.models import User, ChatHistory
from app.schemas import DashboardStatsResponse, AgentUsageStat

router = APIRouter()

# 依赖项，用于确保只有管理员才能访问
def require_admin(current_user: User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="没有权限访问此资源")

@router.get("/stats", response_model=DashboardStatsResponse, dependencies=[Depends(require_admin)])
async def get_dashboard_stats(db: Session = Depends(get_db)):
    """
    获取仪表盘核心统计数据。
    仅限管理员访问。
    """
    try:
        # 1. 核心统计
        total_users = db.query(func.count(User.id)).scalar()
        total_messages = db.query(func.count(ChatHistory.id)).scalar()
        total_conversations = db.query(func.count(distinct(ChatHistory.conversation_id))).scalar()

        # 2. 助教角色使用分布 (用于圆形图)
        agent_usage_query = db.query(
            ChatHistory.agent_type,
            func.count(ChatHistory.id)
        ).filter(
            ChatHistory.role == 'assistant'
        ).group_by(
            ChatHistory.agent_type
        ).all()

        agent_usage = [AgentUsageStat(agent_type=agent, count=count) for agent, count in agent_usage_query]

        return DashboardStatsResponse(
            total_users=total_users or 0,
            total_messages=total_messages or 0,
            total_conversations=total_conversations or 0,
            agent_usage=agent_usage,
        )

    except Exception as e:
        # 实际项目中，这里应该记录详细的错误日志
        print(f"Error fetching dashboard stats: {e}")
        raise HTTPException(status_code=500, detail="获取仪表盘数据时发生内部错误")