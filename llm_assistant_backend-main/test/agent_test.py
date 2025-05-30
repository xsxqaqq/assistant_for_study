#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
测试不同角色选择功能
"""

import requests
import json

# API 基础 URL
BASE_URL = "http://localhost:8000"

def test_get_agents():
    """测试获取角色列表"""
    print("=== 测试获取角色列表 ===")
    
    url = f"{BASE_URL}/chat/agents"
    
    try:
        response = requests.get(url)
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("获取角色列表成功！")
            print(f"共有 {len(data['agents'])} 个角色:")
            
            for agent in data['agents']:
                print(f"- ID: {agent['id']}")
                print(f"  名称: {agent['name']}")
                print(f"  描述: {agent['description']}")
                print()
        else:
            print(f"获取角色列表失败: {response.text}")
            
    except Exception as e:
        print(f"请求失败: {str(e)}")

def test_chat_with_different_agents(token):
    """测试与不同角色对话"""
    print("=== 测试与不同角色对话 ===")
    
    # 测试的角色列表
    test_agents = [
        "default",
        "cool_scholar", 
        "caring_sister",
        "humorous_teacher",
        "wise_mentor",
        "energetic_coach",
        "gentle_guide"
    ]
    
    test_message = "请帮我解释一下什么是机器学习？"
    
    for agent_type in test_agents:
        print(f"\n--- 测试角色: {agent_type} ---")
        
        url = f"{BASE_URL}/chat/"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        data = {
            "message": test_message,
            "agent_type": agent_type
        }
        
        try:
            response = requests.post(url, headers=headers, json=data)
            
            if response.status_code == 200:
                result = response.json()
                print(f"回复长度: {len(result['reply'])} 字符")
                print(f"回复内容: {result['reply'][:100]}...")
            else:
                print(f"请求失败: {response.text}")
                
        except Exception as e:
            print(f"请求失败: {str(e)}")

if __name__ == "__main__":
    print("开始测试角色选择功能...\n")
    
    # 1. 测试获取角色列表（无需认证）
    test_get_agents()
    
    # 2. 登录获取token
    token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJteXRlc3R1c2VyIiwiZXhwIjoxNzQ4NTY4ODg3fQ.hdlmxk5mtMWk0K4f9QDnRLBNmZTrLOgP2FCPPer97iE"
    
    if token:
        # 3. 测试与不同角色对话
        test_chat_with_different_agents(token)
    else:
        print("无法获取token，跳过对话测试")
    
    print("\n测试完成！")
