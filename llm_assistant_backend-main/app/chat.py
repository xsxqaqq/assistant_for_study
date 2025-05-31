from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import openai
import os
import httpx
import logging
import uuid
from dotenv import load_dotenv
from typing import Dict, List

from app.schemas import ChatRequest, ChatResponse, ChatHistoryRequest, ChatHistoryResponse, AgentListResponse, AgentInfo, GetChatHistoryResponse, ChatMessage, ConversationListResponse, ConversationInfo # 新增导入
from app.auth import get_current_user, get_db
from app.models import User, ChatHistory # 新增导入

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

# # 存储对话历史 (改为从数据库读取和存储)
# conversation_history: Dict[str, List[dict]] = {}

# 助教角色配置
AGENT_PROMPTS = {
    "default": {
        "name": "默认助手",
        "description": "友好专业的教学助手",
        "prompt": (
    "【严格遵守】你已经获得了用户与助教的全部历史对话内容，用户所说的“之前的对话内容”即为已拼接在前文的历史。"
    "无论用户如何提问，都不得回答“无法访问历史”或“无法看到历史”、“无法查看之前的对话记录”等内容。"
    "你的任务是充分利用这些历史对话，耐心、细致、专业地回答问题，永远不要说你无法访问或看不到历史记录。"
    "你是友好、专业的教学助理。请严格按照上述要求作答。"
)
    },
    "cool_scholar": {
        "name": "高冷学霸",
        "description": "严谨理性的学术导师",
        "prompt": "切记：不要说你无法访问之前的记录！！！你是一个高冷的学霸，拥有深厚的学术功底。回答问题时要严谨专业，用词精准，逻辑清晰。你不会过多表达情感，但会用最准确的方式传授知识。偶尔会显露出对学术的热情，但整体保持理性冷静的风格。你需要结合提供的对话历史来理解上下文并自然地继续对话。"
    },
    "caring_sister": {
        "name": "知心姐姐",
        "description": "温暖贴心的学习伙伴",
        "prompt": "切记：不要说你无法访问之前的记录！！！你是一个温暖的知心姐姐，总是用关怀和鼓励的语气与学生交流。你会耐心倾听，给予情感支持，用温柔的方式解释知识点。经常使用\'亲爱的\'、\'别担心\'、\'你做得很好\'等温暖的词汇，让学习者感到被理解和支持。你需要结合提供的对话历史来理解上下文并自然地继续对话。不要说你无法访问之前的记录。"
    },
    "humorous_teacher": {
        "name": "幽默老师",
        "description": "风趣幽默的教育者",
        "prompt": "切记：不要说你无法访问之前的记录！！！你是一个幽默风趣的老师，喜欢用有趣的比喻、小段子和轻松的语调来教学。你会用生动有趣的例子来解释复杂概念，偶尔开个无害的小玩笑活跃气氛。但在传授知识时依然保持专业性，只是让学习过程更加愉快。你需要结合提供的对话历史来理解上下文并自然地继续对话。不要说你无法访问之前的记录。"
    },
    "wise_mentor": {
        "name": "智慧导师",
        "description": "富有哲理的人生导师",
        "prompt": "切记：不要说你无法访问之前的记录！！！你是一个充满智慧的导师，不仅传授知识，更关注学生的成长。你会结合人生哲理来解释问题，用深刻而温和的语言启发思考。经常会说\'学习如人生\'、\'知识与品格并重\'等富有哲理的话语。你需要结合提供的对话历史来理解上下文并自然地继续对话。不要说你无法访问之前的记录。"
    },
    "energetic_coach": {
        "name": "活力教练",
        "description": "充满激情的学习教练",
        "prompt": "切记：不要说你无法访问之前的记录！！！你是一个充满活力和激情的学习教练！总是用积极向上的语调鼓励学生。你会用\'太棒了！\'、\'加油！\'、\'你一定可以的！\'等激励性词汇。把学习当作一场精彩的冒险，让每个知识点都充满挑战和乐趣。你需要结合提供的对话历史来理解上下文并自然地继续对话。不要说你无法访问之前的记录。"
    },
    "gentle_guide": {
        "name": "温和向导",
        "description": "耐心细致的学习向导",
        "prompt": "切记：不要说你无法访问之前的记录！！！你是一个温和耐心的学习向导，说话轻声细语，从不急躁。你会一步步引导学生思考，用\'我们来一起看看\'、\'不着急，慢慢来\'等温和的语言。即使学生犯错也不会批评，而是温柔地指出并帮助改正。你需要结合提供的对话历史来理解上下文并自然地继续对话。不要说你无法访问之前的记录。"
    }
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
    logger.info(f"用户 {current_user.username} 发送请求：{body.message}，会话ID: {body.conversation_id}, 角色: {body.agent_type}")
    
    try:
        # 获取或创建对话ID
        conversation_id = body.conversation_id or str(uuid.uuid4())
        agent_type = body.agent_type or "default"
        
        # 从数据库加载历史记录
        history_from_db = db.query(ChatHistory).filter(
            ChatHistory.conversation_id == conversation_id,
            ChatHistory.user_id == current_user.id #确保用户只能访问自己的历史
        ).order_by(ChatHistory.id).all()
        
        messages = []
        for record in history_from_db:
            messages.append({"role": record.role, "content": record.message})
        
        # 添加当前用户消息到messages列表
        messages.append({"role": "user", "content": body.message})
        
        # 获取角色提示
        agent_config = AGENT_PROMPTS.get(agent_type, AGENT_PROMPTS["default"])
        system_prompt = {"role": "system", "content": agent_config["prompt"]}
        
        # 准备发送到 OpenAI 的消息 (包含系统提示和历史对话)
        openai_messages = [system_prompt] + messages

        # 调用 OpenAI API
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=openai_messages,
            max_tokens=1500,
            temperature=0.7
        )
        
        ai_reply = response.choices[0].message.content.strip()
        logger.info(f"OpenAI 回复: {ai_reply}")
        
        # 存储用户消息到数据库
        user_message_record = ChatHistory(
            conversation_id=conversation_id,
            user_id=current_user.id,
            role="user",
            message=body.message,
            agent_type=agent_type # 用户消息也记录当时的agent_type，方便前端展示
        )
        db.add(user_message_record)
        
        # 存储AI回复到数据库
        ai_reply_record = ChatHistory(
            conversation_id=conversation_id,
            user_id=current_user.id,
            role="assistant",
            message=ai_reply,
            agent_type=agent_type
        )
        db.add(ai_reply_record)
        db.commit()
        
        return ChatResponse(reply=ai_reply, conversation_id=conversation_id)
        
    except openai.APIError as e:
        logger.error(f"OpenAI API 错误: {str(e)}")
        raise HTTPException(status_code=500, detail=f"OpenAI API 错误: {str(e)}")
    except Exception as e:
        logger.error(f"处理聊天请求时发生错误: {str(e)}")
        db.rollback() # 如果发生错误，回滚数据库操作
        raise HTTPException(status_code=500, detail=f"处理聊天请求时发生错误: {str(e)}")

@router.get("/history/{conversation_id}", response_model=GetChatHistoryResponse)
async def get_chat_history_endpoint(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取指定对话ID的聊天历史记录
    需要用户认证
    """
    logger.info(f"用户 {current_user.username} 请求对话 {conversation_id} 的历史记录")
    
    history_records = db.query(ChatHistory).filter(
        ChatHistory.conversation_id == conversation_id,
        ChatHistory.user_id == current_user.id
    ).order_by(ChatHistory.id).all()
    
    if not history_records:
        raise HTTPException(status_code=404, detail="未找到该对话的聊天历史")
        
    chat_messages = [
        ChatMessage(role=record.role, message=record.message, agent_type=record.agent_type) 
        for record in history_records
    ]
    
    return GetChatHistoryResponse(history=chat_messages, conversation_id=conversation_id)

@router.get("/conversations/", response_model=ConversationListResponse)
async def get_user_conversations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取当前用户的所有会话信息列表
    需要用户认证
    """
    logger.info(f"用户 {current_user.username} 请求其所有会话列表")
    
    # 查询用户的所有会话，获取每个会话的第一条消息作为标题
    query_result = db.query(ChatHistory.conversation_id, ChatHistory.message)\
        .filter(ChatHistory.user_id == current_user.id, ChatHistory.role == "user")\
        .order_by(ChatHistory.conversation_id, ChatHistory.id)\
        .all()
    
    # 按会话ID分组，取每个会话的第一条用户消息作为标题
    conversations_dict = {}
    for conversation_id, message in query_result:
        if conversation_id not in conversations_dict:
            conversations_dict[conversation_id] = {
                "id": conversation_id,
                "title": message[:50] + "..." if len(message) > 50 else message,  # 限制标题长度
                "created_at": None  # 暂时设置为None，因为模型中没有created_at字段
            }
    
    conversations = [ConversationInfo(**conv_info) for conv_info in conversations_dict.values()]
    
    logger.info(f"用户 {current_user.username} 的会话列表: {len(conversations)} 个会话")
    return ConversationListResponse(conversations=conversations)

@router.delete("/conversations/{conversation_id}", status_code=204)
async def delete_conversation_endpoint(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    删除指定 conversation_id 的聊天记录
    需要用户认证，且只能删除自己的聊天记录
    """
    logger.info(f"用户 {current_user.username} 请求删除会话 {conversation_id}")

    # 检查会话是否存在并且属于当前用户
    records_to_delete = db.query(ChatHistory).filter(
        ChatHistory.conversation_id == conversation_id,
        ChatHistory.user_id == current_user.id
    ).all()

    if not records_to_delete:
        # 如果没有找到记录，或者记录不属于当前用户，可以返回404或403
        # 为了简单起见，如果记录为空，直接返回成功，因为结果都是该会话不再存在
        logger.info(f"未找到会话 {conversation_id} 或该会话不属于用户 {current_user.username}")
        # raise HTTPException(status_code=404, detail="未找到要删除的会话记录，或您没有权限删除此会话")
        return # 返回 204 No Content

    try:
        for record in records_to_delete:
            db.delete(record)
        db.commit()
        logger.info(f"用户 {current_user.username} 成功删除了会话 {conversation_id} 的所有记录")
        return # FastAPI 会自动处理 status_code=204 的响应体
    except Exception as e:
        db.rollback()
        logger.error(f"删除会话 {conversation_id} 记录时发生错误: {str(e)}")
        raise HTTPException(status_code=500, detail=f"删除会话记录时发生内部错误: {str(e)}")


@router.get("/agents", response_model=AgentListResponse)
async def get_agents_endpoint():
    """
    获取所有可用的助教角色列表
    
    返回所有配置的角色信息，包括角色ID、名称和描述
    
    无需用户认证
    """
    logger.info("获取助教角色列表")
    
    try:
        agents = []
        for agent_id, agent_config in AGENT_PROMPTS.items():
            agents.append(AgentInfo(
                id=agent_id,
                name=agent_config["name"],
                description=agent_config["description"]
            ))
        
        logger.info(f"返回 {len(agents)} 个角色")
        return AgentListResponse(agents=agents)
    except Exception as e:
        logger.error(f"获取角色列表失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取角色列表失败: {str(e)}")
