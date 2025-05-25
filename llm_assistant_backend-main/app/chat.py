from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import openai
import os
import httpx
import logging
import uuid
from dotenv import load_dotenv
from typing import Dict, List

from app.schemas import ChatRequest, ChatResponse, ChatHistoryRequest, ChatHistoryResponse
from app.auth import get_current_user, get_db
from app.models import User

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()
load_dotenv()

# 检查环境变量
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    logger.error("未设置 OPENAI_API_KEY 环境变量")
    raise ValueError("未设置 OPENAI_API_KEY 环境变量")

# 使用正确的方式初始化OpenAI客户端
try:
    client = openai.OpenAI(
        api_key=api_key,
        base_url="https://free.v36.cm/v1/"
    )
    logger.info("OpenAI 客户端初始化成功")
except Exception as e:
    logger.error(f"OpenAI 客户端初始化失败: {str(e)}")
    raise

# 存储对话历史
conversation_history: Dict[str, List[dict]] = {}

# 助教角色配置
AGENT_PROMPTS = {
    "default": "你是一个友好、专业的教学助手。",
    "strict": "你是一个严谨、要求严格的导师。",
    "friendly": "你是一个轻松、幽默的学习伙伴。"
}

@router.post("/", response_model=ChatResponse)
async def chat_endpoint(
    body: ChatRequest, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    智能问答接口
    
    支持单轮对话和多轮对话
    支持不同的助教角色
    
    需要用户认证
    """
    logger.info(f"用户 {current_user.username} 发送请求：{body.message}")
    
    try:
        # 获取或创建对话ID
        conversation_id = body.conversation_id or str(uuid.uuid4())
        
        # 获取对话历史
        history = conversation_history.get(conversation_id, [])
        
        # 添加系统角色提示
        if not history:
            history.append({
                "role": "system",
                "content": AGENT_PROMPTS.get(body.agent_type, AGENT_PROMPTS["default"])
            })
        
        # 添加用户消息
        history.append({"role": "user", "content": body.message})
        
        # 调用OpenAI API
        completion = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=history,
        )
        
        # 获取AI回复
        reply = completion.choices[0].message.content
        
        # 添加AI回复到历史记录
        history.append({"role": "assistant", "content": reply})
        
        # 更新对话历史
        conversation_history[conversation_id] = history
        
        # 如果历史记录太长，只保留最近的10轮对话
        if len(history) > 21:  # 1个系统消息 + 10轮对话（每轮2条消息）
            history = [history[0]] + history[-20:]
            conversation_history[conversation_id] = history
        
        logger.info(f"AI 回复成功：{reply[:100]}...")
        return ChatResponse(
            reply=reply,
            conversation_id=conversation_id
        )
    except Exception as e:
        logger.error(f"调用 AI 服务失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"调用AI服务失败: {str(e)}")

@router.post("/history", response_model=ChatHistoryResponse)
async def chat_with_history(
    body: ChatHistoryRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    多轮对话接口
    
    用户提交完整的对话历史，系统继续对话
    
    需要用户认证
    """
    logger.info(f"用户 {current_user.username} 发送历史对话请求")
    
    try:
        # 添加系统角色提示
        messages = [{
            "role": "system",
            "content": AGENT_PROMPTS.get(body.agent_type, AGENT_PROMPTS["default"])
        }] + body.history
        
        completion = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=messages,
        )
        reply = completion.choices[0].message.content
        logger.info(f"AI 回复成功：{reply[:100]}...")
        return ChatHistoryResponse(reply=reply)
    except Exception as e:
        logger.error(f"调用 AI 服务失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"调用AI服务失败: {str(e)}")
