import requests
import json
import os
from datetime import datetime
import time
from typing import Dict, Any

# 测试配置
BASE_URL = "http://localhost:8000"
TEST_USERNAME = "test"
TEST_PASSWORD = "test123"
TEST_FILE_PATH = os.path.join(os.path.dirname(__file__), "test_doc.txt")

def login() -> str:
    """登录并获取token"""
    response = requests.post(
        f"{BASE_URL}/auth/login",
        data={"username": TEST_USERNAME, "password": TEST_PASSWORD}
    )
    if response.status_code != 200:
        raise Exception(f"登录失败: {response.text}")
    return response.json()["access_token"]

def test_knowledge_base(token: str):
    """测试知识库功能"""
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. 上传测试文档
    test_doc = """
    这是一个测试文档。
    用于验证知识库功能是否正常工作。
    包含一些测试内容。
    """
    
    # 保存测试文档到临时文件
    test_file_path = "test_doc.txt"
    with open(test_file_path, "w", encoding="utf-8") as f:
        f.write(test_doc)
    
    try:
        # 上传文件
        with open(test_file_path, "rb") as f:
            files = {"file": ("test_doc.txt", f, "text/plain")}
            response = requests.post(
                f"{BASE_URL}/rag/documents/upload",
                headers=headers,
                files=files
            )
        
        if response.status_code != 200:
            raise Exception(f"上传文档失败: {response.text}")
        
        upload_result = response.json()
        print("\n1. 文档上传结果:")
        print(f"文档ID: {upload_result['document_id']}")
        print(f"状态: {upload_result['status']}")
        print(f"消息: {upload_result['message']}")
        
        # 等待文档处理完成
        doc_id = upload_result["document_id"]
        max_retries = 10
        retry_count = 0
        
        while retry_count < max_retries:
            response = requests.get(
                f"{BASE_URL}/rag/tasks/{doc_id}/status",
                headers=headers
            )
            if response.status_code == 200:
                status = response.json()
                if status["status"] == "processed":
                    break
                elif status["status"] == "failed":
                    raise Exception("文档处理失败")
            time.sleep(1)
            retry_count += 1
        
        if retry_count >= max_retries:
            raise Exception("文档处理超时")
        
        # 2. 检查文档列表
        response = requests.get(
            f"{BASE_URL}/rag/documents",
            headers=headers
        )
        
        if response.status_code != 200:
            raise Exception(f"获取文档列表失败: {response.text}")
        
        doc_list = response.json()
        print("\n2. 文档列表:")
        for doc in doc_list["documents"]:
            print(f"文件名: {doc['filename']}")
            print(f"上传时间: {doc['upload_time']}")
            print(f"状态: {doc['status']}")
            print(f"块数: {doc['chunk_count']}")
            print("---")
        
        # 3. 测试查询
        test_questions = [
            "这个文档是做什么用的？",
            "文档包含什么内容？"
        ]
        
        print("\n3. 测试查询:")
        for question in test_questions:
            response = requests.post(
                f"{BASE_URL}/rag/query",
                headers=headers,
                json={"question": question}
            )
            
            if response.status_code != 200:
                raise Exception(f"查询失败: {response.text}")
            
            result = response.json()
            print(f"\n问题: {question}")
            print(f"回答: {result['answer']}")
            print("相关文档块:")
            for chunk in result['relevant_chunks']:
                print(f"- {chunk}")
            print("---")
        
        # 4. 检查系统指标
        response = requests.get(
            f"{BASE_URL}/rag/metrics",
            headers=headers
        )
        
        if response.status_code != 200:
            raise Exception(f"获取系统指标失败: {response.text}")
        
        metrics = response.json()
        print("\n4. 系统指标:")
        print(f"总查询数: {metrics['total_queries']}")
        print(f"缓存命中率: {metrics['cache_hit_rate']:.2%}")
        print(f"错误率: {metrics['error_rate']:.2%}")
        print(f"平均响应时间: {metrics['avg_response_time']:.2f}秒")
        print(f"向量数据库大小: {metrics['vector_db_size']}")
        print(f"文档数: {metrics['document_count']}")
        
        # 5. 清理测试文档
        response = requests.delete(
            f"{BASE_URL}/rag/documents/{doc_id}",
            headers=headers
        )
        
        if response.status_code != 204:
            raise Exception(f"删除文档失败: {response.text}")
        
        print("\n5. 测试文档已清理")
        
    finally:
        # 清理临时文件
        if os.path.exists(test_file_path):
            os.remove(test_file_path)

def main():
    """主函数"""
    try:
        print("开始测试RAG系统...")
        token = login()
        print("登录成功，获取到token")
        
        test_knowledge_base(token)
        
        print("\n测试完成！")
    except Exception as e:
        print(f"测试失败: {str(e)}")
        raise

if __name__ == "__main__":
    main() 