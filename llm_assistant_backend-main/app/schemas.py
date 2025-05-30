from pydantic import BaseModel, EmailStr
from typing import List, Optional

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
    
    model_config = {
        "from_attributes": True
    }

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