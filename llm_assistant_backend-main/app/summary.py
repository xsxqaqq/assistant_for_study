from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
import openai
import os
import logging
from dotenv import load_dotenv
import PyPDF2
import io

from app.auth import get_current_user, get_db
from app.models import User
from app.schemas import SummaryResponse

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

# 初始化OpenAI客户端
client = openai.OpenAI(
    api_key=api_key,
    base_url="https://api.vveai.com/v1/"
)

def extract_text_from_pdf(file_content: bytes) -> str:
    """从PDF文件中提取文本"""
    try:
        pdf_file = io.BytesIO(file_content)
        pdf_reader = PyPDF2.PdfReader(pdf_file)
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text()
        return text
    except Exception as e:
        logger.error(f"PDF文本提取失败: {str(e)}")
        raise HTTPException(status_code=400, detail="PDF文件处理失败")

@router.post("/", response_model=SummaryResponse)
async def generate_summary(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    生成文件摘要
    
    支持txt和pdf文件
    返回5个要点
    
    需要用户认证
    """
    try:
        # 检查文件类型
        if not file.filename.endswith(('.txt', '.pdf')):
            raise HTTPException(status_code=400, detail="仅支持txt和pdf文件")
        
        # 读取文件内容
        content = await file.read()
        
        # 根据文件类型提取文本
        if file.filename.endswith('.pdf'):
            text = extract_text_from_pdf(content)
        else:
            text = content.decode('utf-8')
        
        # 调用OpenAI API生成摘要
        completion = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "你是一个专业的教学助手，请将以下内容总结为5个要点，每个要点用换行符分隔。"},
                {"role": "user", "content": text}
            ],
        )
        
        summary = completion.choices[0].message.content
        logger.info(f"用户 {current_user.username} 成功生成摘要")
        
        return SummaryResponse(summary=summary)
    except Exception as e:
        logger.error(f"生成摘要失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"生成摘要失败: {str(e)}")
