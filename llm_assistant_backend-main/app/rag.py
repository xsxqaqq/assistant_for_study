from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional, Tuple, Dict, Any
import os
import uuid
import logging
import traceback
from datetime import datetime
from pypdf import PdfReader
import io
import markdown
from langchain.text_splitter import RecursiveCharacterTextSplitter
from sentence_transformers import SentenceTransformer
import faiss
import numpy as np
import json
import re
from typing import Dict, List, Tuple
import hashlib
from collections import defaultdict
import openai
from dotenv import load_dotenv
import httpx
from docx import Document

from app.auth import get_current_user, get_db
from app.models import User, KnowledgeDocument, Base
from app.schemas import (
    DocumentUploadResponse,
    DocumentListResponse,
    DocumentInfo,
    RAGQueryRequest,
    RAGQueryResponse,
    TaskStatusResponse
)

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
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
        base_url="https://api.vveai.com/v1/"
    )
    logger.info("OpenAI 客户端初始化成功")
except Exception as e:
    logger.error(f"OpenAI 客户端初始化失败: {str(e)}")
    raise

# 配置
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200
EMBEDDING_MODEL = "all-MiniLM-L6-v2"
VECTOR_DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "vector_db", "vector_db.faiss")
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "uploads")
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
CACHE_TTL = 3600  # 缓存过期时间（秒）

# 确保目录存在
os.makedirs(os.path.dirname(VECTOR_DB_PATH), exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)

# 初始化全局变量
vector_db = None
document_chunks = {}  # 存储文档ID到其文本块的映射
vector_index_to_doc_id = {}  # 存储向量索引到文档ID的映射
doc_id_to_vector_indices = {}  # 存储文档ID到向量索引范围的映射
query_cache = {}  # 简单的内存缓存

# 监控指标
class Metrics:
    def __init__(self):
        self.query_count = 0
        self.cache_hits = 0
        self.processing_times = []
        self.error_count = 0
        self.avg_response_time = 0

metrics = Metrics()

def update_metrics(start_time: float, cache_hit: bool = False, error: bool = False):
    """更新监控指标"""
    metrics.query_count += 1
    if cache_hit:
        metrics.cache_hits += 1
    if error:
        metrics.error_count += 1
    
    processing_time = datetime.now().timestamp() - start_time
    metrics.processing_times.append(processing_time)
    metrics.avg_response_time = sum(metrics.processing_times) / len(metrics.processing_times)
    
    # 只保留最近1000个查询的时间记录
    if len(metrics.processing_times) > 1000:
        metrics.processing_times = metrics.processing_times[-1000:]

# 初始化文本分割器
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=CHUNK_SIZE,
    chunk_overlap=CHUNK_OVERLAP,
    length_function=len,
    is_separator_regex=False,
)

# 设置模型缓存目录
MODEL_CACHE_DIR = os.path.join(os.path.dirname(__file__), "model_cache")
os.makedirs(MODEL_CACHE_DIR, exist_ok=True)

# 初始化嵌入模型
try:
    # 尝试从本地缓存加载模型
    if os.path.exists(os.path.join(MODEL_CACHE_DIR, "all-MiniLM-L6-v2")):
        logger.info("从本地缓存加载模型")
        embedder = SentenceTransformer(os.path.join(MODEL_CACHE_DIR, "all-MiniLM-L6-v2"))
    else:
        # 如果本地没有缓存，尝试从HuggingFace下载
        logger.info("从HuggingFace下载模型")
        embedder = SentenceTransformer(EMBEDDING_MODEL, cache_folder=MODEL_CACHE_DIR)
        # 保存到本地缓存
        embedder.save(os.path.join(MODEL_CACHE_DIR, "all-MiniLM-L6-v2"))
    logger.info("嵌入模型加载成功")
except Exception as e:
    logger.error(f"加载嵌入模型失败: {str(e)}")
    logger.error(f"错误堆栈: {traceback.format_exc()}")
    # 如果加载失败，使用一个简单的备用模型
    logger.warning("使用备用模型")
    from sentence_transformers import SentenceTransformer, util
    embedder = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2', cache_folder=MODEL_CACHE_DIR)
    if not os.path.exists(os.path.join(MODEL_CACHE_DIR, "paraphrase-multilingual-MiniLM-L12-v2")):
        embedder.save(os.path.join(MODEL_CACHE_DIR, "paraphrase-multilingual-MiniLM-L12-v2"))

def save_vector_db():
    """保存向量数据库到磁盘"""
    global vector_db, vector_index_to_doc_id, doc_id_to_vector_indices, document_chunks
    try:
        if vector_db is not None:
            # 确保目录存在
            os.makedirs(os.path.dirname(VECTOR_DB_PATH), exist_ok=True)
            
            # 保存向量数据库
            faiss.write_index(vector_db, VECTOR_DB_PATH)
            logger.info(f"已保存向量数据库到: {VECTOR_DB_PATH}")
            
            # 保存映射关系
            mapping_file = os.path.join(os.path.dirname(VECTOR_DB_PATH), "mapping.json")
            mapping_data = {
                "vector_index_to_doc_id": vector_index_to_doc_id,
                "doc_id_to_vector_indices": doc_id_to_vector_indices
            }
            with open(mapping_file, "w", encoding="utf-8") as f:
                json.dump(mapping_data, f, ensure_ascii=False, indent=2)
            logger.info(f"已保存映射关系到: {mapping_file}")
            
            # 保存文档块
            chunks_file = os.path.join(os.path.dirname(VECTOR_DB_PATH), "chunks.json")
            with open(chunks_file, "w", encoding="utf-8") as f:
                json.dump(document_chunks, f, ensure_ascii=False, indent=2)
            logger.info(f"已保存文档块到: {chunks_file}")
            
            logger.info(f"已保存向量数据库和映射关系: 文档数={len(document_chunks)}, 向量数={vector_db.ntotal}")
        else:
            logger.warning("向量数据库为空，无需保存")
    except Exception as e:
        logger.error(f"保存向量数据库失败: {str(e)}")
        logger.error(f"错误堆栈: {traceback.format_exc()}")
        raise

def load_vector_db(db: Session = None):
    """加载或创建向量数据库"""
    global vector_db, vector_index_to_doc_id, doc_id_to_vector_indices, document_chunks
    try:
        # 检查向量数据库文件是否存在
        vector_db_exists = os.path.exists(VECTOR_DB_PATH)
        mapping_file = os.path.join(os.path.dirname(VECTOR_DB_PATH), "mapping.json")
        mapping_exists = os.path.exists(mapping_file)
        chunks_file = os.path.join(os.path.dirname(VECTOR_DB_PATH), "chunks.json")
        
        # 如果向量数据库文件不存在，但映射文件存在，删除映射文件
        if not vector_db_exists and mapping_exists:
            try:
                os.remove(mapping_file)
                logger.info("向量数据库文件不存在，已删除映射文件")
            except Exception as e:
                logger.error(f"删除映射文件失败: {str(e)}")
        
        if vector_db_exists:
            try:
                # 加载向量数据库
                vector_db = faiss.read_index(VECTOR_DB_PATH)
                logger.info(f"已加载向量数据库，大小: {vector_db.ntotal}")
                
                # 加载映射关系
                if mapping_exists:
                    with open(mapping_file, "r", encoding="utf-8") as f:
                        mapping_data = json.load(f)
                        vector_index_to_doc_id = mapping_data.get("vector_index_to_doc_id", {})
                        doc_id_to_vector_indices = mapping_data.get("doc_id_to_vector_indices", {})
                    
                    # 加载文档块
                    if os.path.exists(chunks_file):
                        with open(chunks_file, "r", encoding="utf-8") as f:
                            document_chunks = json.load(f)
                    else:
                        logger.warning("文档块文件不存在，将重新创建")
                        document_chunks = {}
                        
                    # 验证数据一致性
                    if not verify_data_consistency():
                        logger.warning("检测到数据不一致，尝试修复...")
                        if db is not None:
                            repair_data_consistency(db)
                        else:
                            logger.error("无法修复数据一致性：数据库会话未提供")
                        
                    logger.info(f"已加载映射关系: 向量索引数={len(vector_index_to_doc_id)}, 文档数={len(doc_id_to_vector_indices)}, 文档块数={len(document_chunks)}")
                else:
                    logger.warning("映射文件不存在，将创建新的映射关系")
                    vector_index_to_doc_id = {}
                    doc_id_to_vector_indices = {}
                    document_chunks = {}
            except Exception as e:
                logger.error(f"加载向量数据库失败: {str(e)}")
                logger.error(f"错误堆栈: {traceback.format_exc()}")
                # 如果加载失败，创建新的向量数据库
                vector_db = None
                vector_index_to_doc_id = {}
                doc_id_to_vector_indices = {}
                document_chunks = {}
        
        # 如果向量数据库不存在或加载失败，创建新的
        if vector_db is None:
            try:
                # 创建向量数据库目录
                os.makedirs(os.path.dirname(VECTOR_DB_PATH), exist_ok=True)
                
                # 创建新的向量数据库
                dimension = 768  # 使用默认维度
                vector_db = faiss.IndexFlatL2(dimension)
                vector_index_to_doc_id = {}
                doc_id_to_vector_indices = {}
                document_chunks = {}
                logger.info("已创建新的向量数据库")
            except Exception as e:
                logger.error(f"创建向量数据库失败: {str(e)}")
                logger.error(f"错误堆栈: {traceback.format_exc()}")
                raise
        
        # 验证向量数据库状态
        if vector_db is not None:
            logger.info(f"向量数据库状态: 维度={vector_db.d}, 向量数={vector_db.ntotal}")
            if vector_db.ntotal > 0:
                logger.info(f"映射关系: 向量索引数={len(vector_index_to_doc_id)}, 文档数={len(doc_id_to_vector_indices)}, 文档块数={len(document_chunks)}")
        else:
            logger.warning("向量数据库未初始化")
            
    except Exception as e:
        logger.error(f"初始化向量数据库失败: {str(e)}")
        logger.error(f"错误堆栈: {traceback.format_exc()}")
        raise

def verify_data_consistency() -> bool:
    """验证数据一致性"""
    try:
        # 检查向量数据库和文档的对应关系
        vector_db_size = vector_db.ntotal if vector_db is not None else 0
        actual_docs = set(vector_index_to_doc_id.values())
        
        if vector_db_size != len(actual_docs):
            logger.error(f"数据不一致：向量数据库大小({vector_db_size}) != 实际文档数({len(actual_docs)})")
            return False
            
        # 检查文档块
        for doc_id, (start_idx, end_idx) in doc_id_to_vector_indices.items():
            for i in range(start_idx, end_idx + 1):
                if i not in document_chunks:
                    logger.error(f"文档块缺失：索引 {i}")
                    return False
                    
        return True
    except Exception as e:
        logger.error(f"数据一致性验证失败: {str(e)}")
        return False

def repair_data_consistency(db: Session):
    """修复数据一致性"""
    try:
        # 获取所有有效的文档ID
        valid_doc_ids = set()
        for doc_id, (start_idx, end_idx) in doc_id_to_vector_indices.items():
            if all(i in vector_index_to_doc_id for i in range(start_idx, end_idx + 1)):
                valid_doc_ids.add(doc_id)
        
        # 清理无效的映射关系
        vector_index_to_doc_id.clear()
        doc_id_to_vector_indices.clear()
        document_chunks.clear()
        
        # 重新建立映射关系
        for doc_id in valid_doc_ids:
            try:
                # 从数据库获取文档信息
                doc = db.query(KnowledgeDocument).filter(KnowledgeDocument.id == doc_id).first()
                if doc and doc.vector_db_reference:
                    vector_ref = json.loads(doc.vector_db_reference)
                    start_idx = vector_ref.get("start_index")
                    end_idx = vector_ref.get("end_index")
                    if start_idx is not None and end_idx is not None:
                        doc_id_to_vector_indices[doc_id] = (start_idx, end_idx)
                        for i in range(start_idx, end_idx + 1):
                            vector_index_to_doc_id[i] = doc_id
            except Exception as e:
                logger.error(f"修复文档 {doc_id} 的映射关系失败: {str(e)}")
                continue
        
        # 保存修复后的数据
        save_vector_db()
        logger.info("数据一致性修复完成")
    except Exception as e:
        logger.error(f"数据一致性修复失败: {str(e)}")
        raise

def initialize_vector_db(db: Session):
    """初始化向量数据库"""
    global vector_db, vector_index_to_doc_id, doc_id_to_vector_indices, document_chunks
    try:
        # 确保目录存在
        os.makedirs(os.path.dirname(VECTOR_DB_PATH), exist_ok=True)
        
        # 尝试加载现有数据库
        if os.path.exists(VECTOR_DB_PATH):
            try:
                load_vector_db(db)
                logger.info("成功加载现有向量数据库")
            except Exception as e:
                logger.error(f"加载现有向量数据库失败: {str(e)}")
                # 如果加载失败，创建新的向量数据库
                dimension = embedder.get_sentence_embedding_dimension()
                vector_db = faiss.IndexFlatIP(dimension)
                vector_index_to_doc_id = {}
                doc_id_to_vector_indices = {}
                document_chunks = {}
                save_vector_db()
                logger.info(f"创建新的向量数据库，维度: {dimension}")
        else:
            # 创建新的向量数据库
            dimension = embedder.get_sentence_embedding_dimension()
            vector_db = faiss.IndexFlatIP(dimension)
            vector_index_to_doc_id = {}
            doc_id_to_vector_indices = {}
            document_chunks = {}
            save_vector_db()
            logger.info(f"创建新的向量数据库，维度: {dimension}")
    except Exception as e:
        logger.error(f"初始化向量数据库失败: {str(e)}")
        logger.error(f"错误堆栈: {traceback.format_exc()}")
        raise

# 在应用启动时调用初始化
@router.on_event("startup")
async def startup_event():
    """应用启动时初始化"""
    db = next(get_db())
    try:
        initialize_vector_db(db)
    finally:
        db.close()

def preprocess_text(text: str) -> str:
    """文本预处理函数"""
    # 移除多余空白字符
    text = re.sub(r'\s+', ' ', text)
    # 移除特殊字符
    text = re.sub(r'[^\w\s\u4e00-\u9fff]', '', text)
    # 移除重复段落
    paragraphs = text.split('\n\n')
    unique_paragraphs = []
    seen = set()
    for p in paragraphs:
        p_hash = hashlib.md5(p.encode()).hexdigest()
        if p_hash not in seen:
            seen.add(p_hash)
            unique_paragraphs.append(p)
    return '\n\n'.join(unique_paragraphs)

def extract_text_from_file(file_content: bytes, filename: str) -> str:
    """从文件中提取文本"""
    try:
        if filename.endswith('.pdf'):
            pdf_file = io.BytesIO(file_content)
            reader = PdfReader(pdf_file)
            text = ""
            for page in reader.pages:
                text += page.extract_text()
        elif filename.endswith('.md'):
            text = markdown.markdown(file_content.decode('utf-8'))
        else:  # txt
            text = file_content.decode('utf-8')
            
        # 应用预处理
        return preprocess_text(text)
    except Exception as e:
        logger.error(f"文件文本提取失败: {str(e)}")
        raise HTTPException(status_code=400, detail="文件处理失败")

def extract_text_from_docx(file_path: str) -> str:
    """从docx文件中提取文本"""
    try:
        doc = Document(file_path)
        text = "\n".join([paragraph.text for paragraph in doc.paragraphs])
        return preprocess_text(text)
    except Exception as e:
        logger.error(f"docx文件处理失败: {str(e)}")
        raise HTTPException(status_code=400, detail="docx文件处理失败")

def normalize_vector(vector: List[float]) -> List[float]:
    """归一化向量"""
    norm = np.linalg.norm(vector)
    if norm == 0:
        return vector
    return (vector / norm).tolist()

def check_data_consistency(db: Session) -> Dict[str, Any]:
    """检查数据一致性并返回统计信息"""
    try:
        # 获取所有文档
        all_docs = db.query(KnowledgeDocument).all()
        total_docs = len(all_docs)
        
        # 统计不同状态的文档
        status_counts = defaultdict(int)
        valid_docs = set()
        invalid_docs = set()
        processing_docs = set()
        
        for doc in all_docs:
            status_counts[doc.status] += 1
            try:
                if doc.status == "processing":
                    processing_docs.add(doc.id)
                    continue
                    
                if doc.vector_db_reference:
                    vector_ref = json.loads(doc.vector_db_reference)
                    start_index = vector_ref.get("start_index")
                    end_index = vector_ref.get("end_index")
                    file_path = vector_ref.get("file_path")
                    
                    # 检查向量索引是否有效
                    if (
                        start_index is not None and 
                        end_index is not None and 
                        start_index < vector_db.ntotal and 
                        end_index < vector_db.ntotal and
                        all(i in vector_index_to_doc_id for i in range(start_index, end_index + 1)) and
                        all(i in document_chunks for i in range(start_index, end_index + 1)) and
                        os.path.exists(file_path)
                    ):
                        valid_docs.add(doc.id)
                    else:
                        invalid_docs.add(doc.id)
                        logger.warning(f"文档 {doc.id} 数据不一致: 向量索引={start_index}-{end_index}, 文件存在={os.path.exists(file_path) if file_path else False}")
                else:
                    invalid_docs.add(doc.id)
                    logger.warning(f"文档 {doc.id} 缺少向量引用")
            except Exception as e:
                logger.error(f"检查文档 {doc.id} 时出错: {str(e)}")
                invalid_docs.add(doc.id)
        
        # 检查向量数据库
        vector_db_size = vector_db.ntotal if vector_db is not None else 0
        actual_docs = set(vector_index_to_doc_id.values())
        
        # 检查文档块
        chunk_count = len(document_chunks)
        
        # 检查映射关系
        mapping_issues = []
        for doc_id, (start_idx, end_idx) in doc_id_to_vector_indices.items():
            if doc_id not in valid_docs and doc_id not in processing_docs:
                mapping_issues.append(f"文档 {doc_id} 的映射关系无效")
            for i in range(start_idx, end_idx + 1):
                if i not in vector_index_to_doc_id:
                    mapping_issues.append(f"向量索引 {i} 缺少文档映射")
                if i not in document_chunks:
                    mapping_issues.append(f"向量索引 {i} 缺少文档块")
        
        # 记录警告信息
        if invalid_docs:
            logger.warning(f"检测到 {len(invalid_docs)} 个无效文档，文档ID: {list(invalid_docs)}")
        if mapping_issues:
            logger.warning(f"检测到 {len(mapping_issues)} 个映射问题: {mapping_issues}")
        
        return {
            "total_documents": total_docs,
            "status_counts": dict(status_counts),
            "valid_documents": len(valid_docs),
            "invalid_documents": len(invalid_docs),
            "processing_documents": len(processing_docs),
            "invalid_doc_ids": list(invalid_docs),
            "vector_db_size": vector_db_size,
            "actual_documents": len(actual_docs),
            "document_chunks_count": chunk_count,
            "mapping_issues": mapping_issues
        }
    except Exception as e:
        logger.error(f"数据一致性检查失败: {str(e)}")
        logger.error(f"错误堆栈: {traceback.format_exc()}")
        raise

async def process_document(
    file: UploadFile,
    user_id: int,
    db: Session
) -> Dict[str, Any]:
    """处理上传的文档"""
    try:
        # 检查文件类型
        if not file.filename.lower().endswith(('.txt', '.pdf', '.docx')):
            raise HTTPException(status_code=400, detail="不支持的文件类型")
            
        # 检查文件大小
        file_size = 0
        content = b""
        while chunk := await file.read(8192):
            file_size += len(chunk)
            if file_size > MAX_FILE_SIZE:
                raise HTTPException(status_code=400, detail="文件大小超过限制")
            content += chunk
            
        # 重置文件指针位置
        await file.seek(0)
            
        # 创建用户目录
        user_dir = os.path.join(UPLOAD_DIR, str(user_id))
        os.makedirs(user_dir, exist_ok=True)
        
        # 保存文件
        file_path = os.path.join(user_dir, file.filename)
        with open(file_path, "wb") as f:
            f.write(content)
            
        # 提取文本
        text = extract_text_from_file(content, file.filename)
        if not text:
            raise HTTPException(status_code=400, detail="无法提取文本内容")
            
        # 分块
        chunks = text.split("\n\n")
        chunks = [chunk.strip() for chunk in chunks if chunk.strip()]
        
        # 生成向量
        embeddings = []
        for chunk in chunks:
            embedding = embedder.encode(chunk)
            embeddings.append(embedding)
            
        # 转换为numpy数组并归一化
        embeddings_array = np.array(embeddings).astype('float32')
        faiss.normalize_L2(embeddings_array)
        
        # 初始化向量数据库（如果为空）
        global vector_db
        if vector_db is None:
            # 使用嵌入模型的维度创建向量数据库
            dimension = embedder.get_sentence_embedding_dimension()
            vector_db = faiss.IndexFlatIP(dimension)
            logger.info(f"创建新的向量数据库，维度: {dimension}")
            
        # 检查向量维度是否匹配
        if embeddings_array.shape[1] != vector_db.d:
            error_msg = f"向量维度不匹配：嵌入维度={embeddings_array.shape[1]}，向量数据库维度={vector_db.d}"
            logger.error(error_msg)
            raise HTTPException(status_code=500, detail=error_msg)
            
        # 获取当前向量数量作为起始索引
        start_idx = vector_db.ntotal
        
        # 创建新文档记录
        new_doc = KnowledgeDocument(
            id=str(uuid.uuid4()),
            user_id=user_id,
            filename=file.filename,
            upload_time=datetime.now(),
            status="processing",
            vector_db_reference=None,
            chunk_count=len(chunks)
        )
        
        # 开始数据库事务
        try:
            db.add(new_doc)
            db.commit()
            
            # 添加向量到数据库
            vector_db.add(embeddings_array)
            
            # 保存文档块
            for i, chunk in enumerate(chunks):
                document_chunks[start_idx + i] = chunk
                
            # 更新文档记录
            new_doc.vector_db_reference = json.dumps({
                "start_index": start_idx,
                "end_index": start_idx + len(chunks) - 1,
                "file_path": file_path
            })
            new_doc.status = "processed"
            db.commit()
            
            # 保存文档ID和块的映射
            for i in range(len(chunks)):
                vector_index_to_doc_id[start_idx + i] = new_doc.id
                
            # 保存文档ID到向量索引的映射
            doc_id_to_vector_indices[new_doc.id] = (start_idx, start_idx + len(chunks) - 1)
            
            # 保存向量数据库
            save_vector_db()
            
            # 检查数据一致性
            consistency_info = check_data_consistency(db)
            if consistency_info["invalid_documents"] > 0:
                logger.warning(f"文档处理完成但存在数据不一致: {consistency_info}")
            
            return {
                "document_id": str(new_doc.id),
                "status": "processed",
                "message": "文档处理完成",
                "consistency_info": consistency_info
            }
            
        except Exception as e:
            # 回滚事务
            db.rollback()
            
            # 清理已添加的向量和文档块
            if vector_db is not None:
                try:
                    # 删除已添加的向量
                    vector_db.remove_ids(np.array(range(start_idx, start_idx + len(chunks))))
                except Exception as del_e:
                    logger.error(f"删除向量失败: {str(del_e)}")
            
            # 清理文档块
            for i in range(len(chunks)):
                if start_idx + i in document_chunks:
                    del document_chunks[start_idx + i]
            
            # 清理映射关系
            for i in range(len(chunks)):
                if start_idx + i in vector_index_to_doc_id:
                    del vector_index_to_doc_id[start_idx + i]
            
            if new_doc.id in doc_id_to_vector_indices:
                del doc_id_to_vector_indices[new_doc.id]
            
            # 如果文件已保存，删除它
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except Exception as del_e:
                    logger.error(f"删除失败的文件时出错: {str(del_e)}")
            
            raise HTTPException(status_code=500, detail=f"文档处理失败: {str(e)}")
            
    except Exception as e:
        logger.error(f"文档处理失败: {str(e)}")
        logger.error(f"错误堆栈: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"文档处理失败: {str(e)}")

async def process_document_in_background(file_content: bytes, filename: str, db: Session, user_id: int, doc_id: str):
    """后台处理文档"""
    try:
        doc = db.query(KnowledgeDocument).filter(KnowledgeDocument.id == doc_id).first()
        if not doc:
            logger.error(f"后台处理时找不到文档: {doc_id}")
            return
        
        try:
            # 创建一个临时的UploadFile对象
            from fastapi import UploadFile
            import io
            
            file_obj = io.BytesIO(file_content)
            upload_file = UploadFile(
                file=file_obj,
                filename=filename
            )
            
            # 调用process_document函数
            processed_doc = await process_document(upload_file, user_id, db)
            
            # 更新文档状态
            doc.status = processed_doc['status']
            doc.vector_db_reference = processed_doc.get('vector_db_reference')
            doc.chunk_count = processed_doc.get('chunk_count', 0)
            db.commit()
            
            logger.info(f"后台文档处理成功: {doc_id}")
        except Exception as e:
            doc.status = "failed"
            db.commit()
            logger.error(f"后台文档处理失败: {str(e)}")
            logger.error(f"错误堆栈: {traceback.format_exc()}")
    except Exception as e:
        logger.error(f"后台任务处理异常: {str(e)}")
        logger.error(f"错误堆栈: {traceback.format_exc()}")

@router.post("/documents/upload", response_model=DocumentUploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    background_tasks: BackgroundTasks = None
):
    """上传文档到知识库"""
    try:
        logger.info(f"开始处理文件上传: {file.filename}")
        # 检查文件类型
        if not file.filename.endswith(('.txt', '.pdf', '.md')):
            logger.warning(f"不支持的文件类型: {file.filename}")
            raise HTTPException(status_code=400, detail="仅支持txt、pdf和md文件")
        
        # 读取文件内容
        content = await file.read()
        logger.info(f"文件大小: {len(content)} bytes")
        
        # 检查文件大小
        if len(content) > MAX_FILE_SIZE:
            logger.warning(f"文件过大: {len(content)} bytes")
            raise HTTPException(status_code=400, detail="文件大小不能超过10MB")
        
        # 如果是后台任务处理
        if background_tasks:
            logger.info("使用后台任务处理文件")
            # 先创建文档记录
            doc_id = str(uuid.uuid4())
            doc = KnowledgeDocument(
                id=doc_id,
                user_id=current_user.id,
                filename=file.filename,
                upload_time=datetime.now(),
                status="processing",
                vector_db_reference=None,
                chunk_count=0
            )
            db.add(doc)
            db.commit()
            
            # 添加后台任务
            background_tasks.add_task(
                process_document_in_background,
                content, file.filename, db, current_user.id, doc_id
            )
            
            logger.info(f"文件上传成功，文档ID: {doc_id}")
            return DocumentUploadResponse(
                document_id=doc_id,
                status="processing",
                message="文档已接收，正在后台处理"
            )
        else:
            # 同步处理
            try:
                logger.info("使用同步方式处理文件")
                doc = await process_document(file, current_user.id, db)
                logger.info(f"文件处理成功，文档ID: {doc['document_id']}")
                return DocumentUploadResponse(
                    document_id=doc['document_id'],
                    status=doc['status'],
                    message=doc['message']
                )
            except Exception as e:
                logger.error(f"文档处理失败: {str(e)}")
                raise HTTPException(status_code=500, detail=f"文档处理失败: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"文件上传失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"文件上传失败: {str(e)}")

@router.get("/documents", response_model=DocumentListResponse)
async def list_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取用户上传的文档列表"""
    try:
        documents = db.query(KnowledgeDocument).filter(
            KnowledgeDocument.user_id == current_user.id
        ).order_by(KnowledgeDocument.upload_time.desc()).all()
        
        return DocumentListResponse(
            documents=[
                DocumentInfo(
                    id=doc.id,
                    filename=doc.filename,
                    upload_time=doc.upload_time,
                    status=doc.status,
                    chunk_count=doc.chunk_count
                )
                for doc in documents
            ]
        )
    except Exception as e:
        logger.error(f"获取文档列表失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取文档列表失败: {str(e)}")

@router.delete("/documents/{document_id}", status_code=204)
async def delete_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """从知识库中删除文档"""
    try:
        doc = db.query(KnowledgeDocument).filter(
            KnowledgeDocument.id == document_id,
            KnowledgeDocument.user_id == current_user.id
        ).first()
        
        if not doc:
            raise HTTPException(status_code=404, detail="文档未找到或无权访问")
        
        # 获取文档的向量索引范围
        try:
            if doc.vector_db_reference:
                vector_ref = json.loads(doc.vector_db_reference)
                start_index = vector_ref.get("start_index")
                end_index = vector_ref.get("end_index")
                file_path = vector_ref.get("file_path")
                
                if start_index is not None and end_index is not None:
                    # 标记这些索引为已删除
                    for i in range(start_index, end_index + 1):
                        if i in vector_index_to_doc_id:
                            del vector_index_to_doc_id[i]
                    
                    # 删除文档ID到向量索引的映射
                    if document_id in doc_id_to_vector_indices:
                        del doc_id_to_vector_indices[document_id]
                
                # 删除文件
                if file_path and os.path.exists(file_path):
                    try:
                        os.remove(file_path)
                        logger.info(f"已删除文件: {file_path}")
                    except Exception as e:
                        logger.error(f"删除文件失败: {str(e)}")
        except Exception as e:
            logger.error(f"处理向量引用时出错: {str(e)}")
            # 继续执行，确保至少删除数据库记录
        
        # 从数据库中删除文档
        db.delete(doc)
        db.commit()
        
        # 检查数据一致性
        consistency_info = check_data_consistency(db)
        logger.info(f"删除文档后的数据一致性检查结果: {consistency_info}")
        
        logger.info(f"文档 {document_id} 已删除")
        return
    except Exception as e:
        logger.error(f"删除文档失败: {str(e)}")
        logger.error(f"错误堆栈: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"删除文档失败: {str(e)}")

def get_cached_result(query: str) -> Optional[RAGQueryResponse]:
    """获取缓存的查询结果"""
    cache_key = hashlib.md5(query.encode()).hexdigest()
    if cache_key in query_cache:
        timestamp, result = query_cache[cache_key]
        if datetime.now().timestamp() - timestamp < CACHE_TTL:
            return result
        del query_cache[cache_key]
    return None

def cache_result(query: str, result: RAGQueryResponse):
    """缓存查询结果"""
    cache_key = hashlib.md5(query.encode()).hexdigest()
    query_cache[cache_key] = (datetime.now().timestamp(), result)

def hybrid_search(query: str, k: int = 3) -> List[Tuple[str, float]]:
    """混合检索：结合关键词和语义搜索"""
    try:
        logger.info(f"开始混合检索，查询: {query}")
        
        # 检查向量数据库状态
        if vector_db is None or vector_db.ntotal == 0:
            logger.error("向量数据库为空")
            raise ValueError("向量数据库未初始化或为空")
            
        # 检查文档块映射
        if not document_chunks:
            logger.error("文档块映射为空")
            raise ValueError("没有可用的文档块")
            
        # 获取所有文档块
        all_chunks = list(document_chunks.values())
        if not all_chunks:
            logger.error("没有可用的文档块")
            raise ValueError("文档块列表为空")
            
        logger.info(f"总文档块数量: {len(all_chunks)}")
        
        # 关键词搜索
        keywords = set(re.findall(r'\w+', query.lower()))
        keyword_scores = defaultdict(float)
        
        # 语义搜索
        try:
            # 生成查询向量并归一化
            question_embedding = embedder.encode([query])[0]
            question_embedding = question_embedding.reshape(1, -1).astype('float32')
            faiss.normalize_L2(question_embedding)
            
            # 使用余弦相似度搜索
            similarities, indices = vector_db.search(
                question_embedding, 
                min(k * 2, vector_db.ntotal)
            )
            logger.info(f"语义搜索完成，找到 {len(indices[0])} 个结果")
        except Exception as e:
            logger.error(f"语义搜索失败: {str(e)}")
            raise ValueError(f"语义搜索失败: {str(e)}")
        
        # 合并结果
        results = []
        seen_chunks = set()  # 使用集合来跟踪已处理的块
        
        # 处理语义搜索结果
        for idx, similarity in zip(indices[0], similarities[0]):
            if idx < len(all_chunks):
                chunk = all_chunks[idx]
                # 将块转换为字符串
                chunk_text = chunk if isinstance(chunk, str) else ' '.join(chunk)
                # 将块转换为元组以便可以哈希
                chunk_tuple = tuple(chunk_text.split())
                if chunk_tuple not in seen_chunks:
                    # 计算关键词匹配分数
                    chunk_words = set(re.findall(r'\w+', chunk_text.lower()))
                    keyword_score = len(keywords & chunk_words) / len(keywords) if keywords else 0
                    
                    # 使用余弦相似度分数
                    semantic_score = float(similarity)
                    
                    # 综合分数
                    final_score = 0.7 * semantic_score + 0.3 * keyword_score
                    results.append((chunk_text, final_score))
                    seen_chunks.add(chunk_tuple)
                    logger.debug(f"文档块得分: {final_score:.4f} (语义: {semantic_score:.4f}, 关键词: {keyword_score:.4f})")
        
        # 按分数排序并返回前k个结果
        results.sort(key=lambda x: x[1], reverse=True)
        logger.info(f"混合检索完成，返回 {len(results[:k])} 个结果")
        return results[:k]
        
    except Exception as e:
        logger.error(f"混合检索过程发生错误: {str(e)}")
        logger.error(f"错误堆栈: {traceback.format_exc()}")
        raise ValueError(f"混合检索失败: {str(e)}")

@router.get("/metrics", response_model=dict)
async def get_metrics():
    """获取系统监控指标"""
    global vector_db, document_chunks
    try:
        logger.info("开始获取系统指标")
        
        # 检查向量数据库状态
        if vector_db is None:
            load_vector_db()
        
        # 从数据库获取所有文档
        db = next(get_db())
        all_docs = db.query(KnowledgeDocument).all()
        total_docs = len(all_docs)
        
        # 计算有效的文档数量（在向量数据库中有对应向量的文档）
        valid_docs = set()
        for doc_id, (start_idx, end_idx) in doc_id_to_vector_indices.items():
            if all(i in vector_index_to_doc_id for i in range(start_idx, end_idx + 1)):
                valid_docs.add(doc_id)
        
        # 计算向量数据库中的实际文档数
        actual_docs = set(vector_index_to_doc_id.values())
        
        metrics_data = {
            "total_queries": metrics.query_count,
            "cache_hit_rate": metrics.cache_hits / metrics.query_count if metrics.query_count > 0 else 0,
            "error_rate": metrics.error_count / metrics.query_count if metrics.query_count > 0 else 0,
            "avg_response_time": metrics.avg_response_time,
            "vector_db_size": vector_db.ntotal if vector_db is not None else 0,
            "document_count": len(valid_docs),
            "total_documents": total_docs,
            "valid_documents": len(valid_docs),
            "actual_documents": len(actual_docs),
            "document_chunks_count": len(document_chunks)
        }
        logger.info(f"系统指标获取成功: {metrics_data}")
        return metrics_data
    except Exception as e:
        logger.error(f"获取系统指标失败: {str(e)}")
        import traceback
        logger.error(f"错误堆栈: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"获取系统指标失败: {str(e)}")

@router.post("/query", response_model=RAGQueryResponse)
async def query_knowledge_base(
    request: RAGQueryRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """基于知识库进行问答"""
    global vector_db, document_chunks
    start_time = datetime.now().timestamp()
    try:
        logger.info(f"开始处理查询请求: {request.question}")
        
        # 检查向量数据库状态
        if vector_db is None:
            logger.error("向量数据库未初始化")
            raise HTTPException(status_code=500, detail="向量数据库未初始化")
        
        if vector_db.ntotal == 0:
            logger.error("向量数据库为空")
            raise HTTPException(status_code=500, detail="向量数据库为空")
        
        # 检查文档块映射
        if not document_chunks:
            logger.error("文档块映射为空")
            raise HTTPException(status_code=500, detail="知识库中没有文档")
        
        logger.info(f"向量数据库大小: {vector_db.ntotal}, 文档数: {len(document_chunks)}")
        
        # 检查缓存
        cached_result = get_cached_result(request.question)
        if cached_result:
            logger.info("使用缓存结果")
            update_metrics(start_time, cache_hit=True)
            return cached_result
        
        # 使用混合检索
        logger.info("开始混合检索")
        try:
            relevant_chunks_with_scores = hybrid_search(request.question, request.top_k or 3)
            if not relevant_chunks_with_scores:
                logger.warning("未找到相关文档块")
                return RAGQueryResponse(
                    answer="抱歉，我没有找到相关的信息。",
                    relevant_chunks=[],
                    status_code=200,
                    message="未找到相关信息"
                )
            
            relevant_chunks = [chunk for chunk, _ in relevant_chunks_with_scores]
            logger.info(f"找到 {len(relevant_chunks)} 个相关文档块")

            # 获取相关文档块的向量信息
            vector_info = {}
            for chunk in relevant_chunks:
                # 生成文档块的向量
                chunk_embedding = embedder.encode([chunk])[0]
                vector_info[chunk] = chunk_embedding.tolist()
            
        except ValueError as e:
            logger.error(f"混合检索失败: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))
        except Exception as e:
            logger.error(f"混合检索失败: {str(e)}")
            import traceback
            logger.error(f"错误堆栈: {traceback.format_exc()}")
            raise HTTPException(status_code=500, detail=f"混合检索失败: {str(e)}")
        
        # 构建提示
        context = "\n\n".join(relevant_chunks)
        system_prompt = f"""你是一个专业助教，基于以下上下文信息回答问题。如果上下文不包含回答问题所需的信息，请回答"我不知道"。
请确保你的回答：
1. 准确：只基于提供的上下文信息
2. 完整：尽可能包含所有相关信息
3. 清晰：使用简洁明了的语言
4. 专业：保持教育者的专业态度

上下文:
{context}"""

        # 调用LLM生成回答
        try:
            logger.info("开始调用OpenAI API")
            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": request.question}
                ],
                temperature=0.7,
                max_tokens=1000
            )
            
            answer = response.choices[0].message.content
            logger.info("成功获取OpenAI回答")
            
            result = RAGQueryResponse(
                answer=answer,
                relevant_chunks=relevant_chunks,
                status_code=200,
                message="成功",
                vector_info=vector_info
            )
            
            # 缓存结果
            cache_result(request.question, result)
            
            update_metrics(start_time)
            return result
        except Exception as e:
            logger.error(f"OpenAI API 调用失败: {str(e)}")
            import traceback
            logger.error(f"错误堆栈: {traceback.format_exc()}")
            raise HTTPException(status_code=500, detail=f"OpenAI API 调用失败: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        update_metrics(start_time, error=True)
        logger.error(f"知识库查询失败: {str(e)}")
        import traceback
        logger.error(f"错误堆栈: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"知识库查询失败: {str(e)}")

@router.get("/tasks/{task_id}/status", response_model=TaskStatusResponse)
async def get_task_status(
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取后台任务状态"""
    try:
        # 首先检查处理中的文档
        doc = db.query(KnowledgeDocument).filter(
            KnowledgeDocument.id == task_id,
            KnowledgeDocument.user_id == current_user.id,
            KnowledgeDocument.status == "processing"
        ).first()
        
        if not doc:
            # 检查已完成的文档
            doc = db.query(KnowledgeDocument).filter(
                KnowledgeDocument.id == task_id,
                KnowledgeDocument.user_id == current_user.id,
                KnowledgeDocument.status.in_(["processed", "failed"])
            ).first()
            
            if not doc:
                # 如果文档不存在，返回404
                raise HTTPException(status_code=404, detail="任务未找到")
        
        return TaskStatusResponse(
            status=doc.status,
            document_id=doc.id,
            filename=doc.filename
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取任务状态失败: {str(e)}")
        logger.error(f"错误堆栈: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"获取任务状态失败: {str(e)}")

@router.get("/documents/consistency", response_model=dict)
async def check_documents_consistency(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """检查文档数据一致性"""
    try:
        consistency_info = check_data_consistency(db)
        return consistency_info
    except Exception as e:
        logger.error(f"检查数据一致性失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"检查数据一致性失败: {str(e)}")