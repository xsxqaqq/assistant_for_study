from pydantic import BaseModel, EmailStr
from typing import List, Optional, Dict
from datetime import datetime

# 用户相关模型
class UserBase(BaseModel):
    username: str
    email: EmailStr

class UserCreate(UserBase):
    password: str
    is_admin: bool = False 

class UserResponse(UserBase):
    id: int
    is_admin: bool
    # email: EmailStr # email 字段已在 UserBase 中，会自动继承

    model_config = {
        "from_attributes": True
    }

# 新增：用于更新用户基本信息的模型
class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None

# 管理员专用：用于修改用户管理员状态的模型
class AdminUserUpdate(BaseModel):
    is_admin: bool

# 新增：用于修改密码的模型
class PasswordUpdate(BaseModel):
    new_password: str

# 新增：重置密码请求模型
class PasswordResetRequest(BaseModel):
    email: EmailStr

# 新增：确认重置密码模型
class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str

# 错误响应模型
class ErrorResponse(BaseModel):
    detail: str

# Token相关模型
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

# 聊天相关模型
class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    agent_type: Optional[str] = "default"

class ChatResponse(BaseModel):
    reply: str
    conversation_id: Optional[str] = None
    status_code: int = 200
    message: str = "成功"

# 聊天历史相关模型
class ChatHistoryRequest(BaseModel):
    history: List[dict]
    agent_type: Optional[str] = "default"

class ChatHistoryResponse(BaseModel):
    reply: str

# 新增：用于前端展示的单条聊天记录模型
class ChatMessage(BaseModel):
    role: str
    message: str
    agent_type: Optional[str] = None #  可选，因为用户消息没有agent_type

# 新增：获取聊天历史的响应模型
class GetChatHistoryResponse(BaseModel):
    history: List[ChatMessage]
    conversation_id: str
    status_code: int = 200
    message: str = "成功"

# 角色相关模型
class AgentInfo(BaseModel):
    id: str
    name: str
    description: str

class AgentListResponse(BaseModel):
    agents: List[AgentInfo]
    status_code: int = 200
    message: str = "成功"
    conversation_id: Optional[str] = None
    status_code: int = 200
    message: str = "成功"

# 摘要相关模型
class SummaryResponse(BaseModel):
    summary: str
    status_code: int = 200
    message: str = "成功"

# 对话信息模型
class ConversationInfo(BaseModel):
    id: str
    title: str  # 对话的第一条消息
    created_at: Optional[str] = None

class ConversationListResponse(BaseModel):
    conversations: List[ConversationInfo]
    status_code: int = 200
    message: str = "成功"

# 新增：用于仪表盘助教使用统计
class AgentUsageStat(BaseModel):
    agent_type: str
    count: int

# 新增：仪表盘统计数据的响应模型 
class DashboardStatsResponse(BaseModel):
    total_users: int
    total_messages: int
    total_conversations: int
    agent_usage: List[AgentUsageStat]
    status_code: int = 200
    message: str = "成功获取仪表盘数据"

class DocumentInfo(BaseModel):
    id: str
    filename: str
    upload_time: datetime
    status: str
    chunk_count: int

class DocumentListResponse(BaseModel):
    documents: List[DocumentInfo]

class DocumentUploadResponse(BaseModel):
    document_id: str
    status: str
    message: str
    task_id: Optional[str] = None

class RAGQueryRequest(BaseModel):
    question: str
    top_k: Optional[int] = 3
    use_cache: Optional[bool] = True

class RAGQueryResponse(BaseModel):
    answer: str
    relevant_chunks: List[str]
    status_code: int
    message: str
    processing_time: Optional[float] = None
    cache_hit: Optional[bool] = False
    vector_info: Optional[Dict[str, List[float]]] = None  # 存储文档块的向量信息

class TaskStatusResponse(BaseModel):
    status: str
    document_id: str
    filename: str
    progress: Optional[float] = None
    error: Optional[str] = None