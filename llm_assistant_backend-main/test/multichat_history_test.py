#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
测试多轮对话及历史记录获取功能
"""

import requests
import json

# API 基础 URL
BASE_URL = "http://localhost:8000"
TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJteXRlc3R1c2VyIiwiZXhwIjoxNzQ4NTY4ODg3fQ.hdlmxk5mtMWk0K4f9QDnRLBNmZTrLOgP2FCPPer97iE" # 请在此处填入您的有效Token

def test_multi_turn_conversation_and_history(token):
    """测试多轮对话并获取历史记录"""
    if not token:
        print("Token 未设置，跳过测试。请在脚本中填入有效Token后重试。")
        return

    print("=== 测试多轮对话与历史记录 ===")
    
    conversation_id = None
    test_agent_type = "default" # 可以选择一个agent进行测试
    
    # 第一轮对话
    print(f"\n--- 第一轮对话 (Agent: {test_agent_type}) ---")
    message1 = "我刚才说什么？"
    url_chat = f"{BASE_URL}/chat/"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    data1 = {
        "message": message1,
        "agent_type": test_agent_type
    }
    
    try:
        response1 = requests.post(url_chat, headers=headers, json=data1)
        print(f"第一轮 - 状态码: {response1.status_code}")
        
        if response1.status_code == 200:
            result1 = response1.json()
            conversation_id = result1.get("conversation_id")
            print(f"第一轮 - AI 回复: {result1.get('reply')}")
            print(f"第一轮 - 会话 ID: {conversation_id}")
            
            if not conversation_id:
                print("错误：第一轮对话未返回 conversation_id，测试中止。")
                return
        else:
            print(f"第一轮 - 请求失败: {response1.text}")
            return
            
    except Exception as e:
        print(f"第一轮 - 请求异常: {str(e)}")
        return

    # # 第二轮对话
    # print(f"\n--- 第二轮对话 (使用会话 ID: {conversation_id}) ---")
    # message2 = "我刚才问了你什么问题？"
    # data2 = {
    #     "message": message2,
    #     "agent_type": test_agent_type,
    #     "conversation_id": conversation_id
    # }
    
    # try:
    #     response2 = requests.post(url_chat, headers=headers, json=data2)
    #     print(f"第二轮 - 状态码: {response2.status_code}")
        
    #     if response2.status_code == 200:
    #         result2 = response2.json()
    #         print(f"第二轮 - AI 回复: {result2.get('reply')}")
    #     else:
    #         print(f"第二轮 - 请求失败: {response2.text}")
            
    # except Exception as e:
    #     print(f"第二轮 - 请求异常: {str(e)}")

    # 获取对话历史
    if conversation_id:
        print(f"\n--- 获取会话历史 (ID: {conversation_id}) ---")
        url_history = f"{BASE_URL}/chat/history/{conversation_id}"
        try:
            response_history = requests.get(url_history, headers=headers)
            print(f"获取历史 - 状态码: {response_history.status_code}")
            
            if response_history.status_code == 200:
                history_data = response_history.json()
                print("获取历史 - 成功！")
                print(f"会话ID: {history_data.get('conversation_id')}")
                print(f"历史记录条数: {len(history_data.get('history', []))}")
                for i, msg in enumerate(history_data.get('history', [])):
                    print(f"  {i+1}. 角色: {msg.get('role')}, Agent: {msg.get('agent_type', 'N/A')}, 内容: {msg.get('message')[:100]}...")
            else:
                print(f"获取历史 - 请求失败: {response_history.text}")
        except Exception as e:
            print(f"获取历史 - 请求异常: {str(e)}")
            
    # 获取用户所有会话列表
    print("\n--- 获取用户所有会话列表 ---")
    url_conversations = f"{BASE_URL}/chat/conversations/"
    try:
        response_conv_list = requests.get(url_conversations, headers=headers)
        print(f"获取会话列表 - 状态码: {response_conv_list.status_code}")
        if response_conv_list.status_code == 200:
            conv_list = response_conv_list.json()
            print("获取会话列表 - 成功！")
            print(f"共有 {len(conv_list)} 个会话: {conv_list}")
        else:
            print(f"获取会话列表 - 请求失败: {response_conv_list.text}")
    except Exception as e:
        print(f"获取会话列表 - 请求异常: {str(e)}")

# 新增：辅助函数，用于获取并打印指定会话ID的历史记录
def fetch_history_for_id(token, conv_id, context_message=""):
    """获取并打印指定会话ID的历史记录"""
    if not token:
        print(f"({context_message}) Token 未设置，无法获取历史。")
        return
    print(f"\\n--- ({context_message}) 获取会话历史 (ID: {conv_id}) ---")
    url_history = f"{BASE_URL}/chat/history/{conv_id}"
    headers = {"Authorization": f"Bearer {token}"}
    try:
        response_history = requests.get(url_history, headers=headers)
        print(f"获取历史 ({conv_id}) - 状态码: {response_history.status_code}")
        if response_history.status_code == 200:
            history_data = response_history.json()
            print(f"历史记录 ({conv_id}):")
            for i, msg in enumerate(history_data.get('history', [])):
                # 修改此处，移除 [:70] 来显示完整消息
                print(f"  {i+1}. 角色: {msg.get('role')}, Agent: {msg.get('agent_type', 'N/A')}, 内容: {msg.get('message')}")
        else:
            print(f"获取历史 ({conv_id}) 失败: {response_history.text}")
    except Exception as e:
        print(f"获取历史 ({conv_id}) 异常: {str(e)}")

# 新增：测试继续一个已知的对话
def test_continue_specific_conversation(token, specific_conversation_id, message_to_continue_with, agent_type="default"):
    """测试继续一个已知的对话"""
    if not token:
        print("Token 未设置，跳过继续对话测试。")
        return
    if not specific_conversation_id or specific_conversation_id == "YOUR_PREVIOUSLY_OBTAINED_CONVERSATION_ID":
        print("需要提供一个有效的 specific_conversation_id 来继续对话，跳过测试。")
        print("请先运行一次完整的 test_multi_turn_conversation_and_history,")
        print("然后将其中的一个 conversation_id 填入 'known_conversation_id' 变量中再试。")
        return

    print(f"\\n--- 测试继续已知会话 (ID: {specific_conversation_id}, Agent: {agent_type}) ---")
    url_chat = f"{BASE_URL}/chat/"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    data = {
        "message": message_to_continue_with,
        "agent_type": agent_type,
        "conversation_id": specific_conversation_id
    }

    try:
        response = requests.post(url_chat, headers=headers, json=data)
        print(f"继续对话 - 状态码: {response.status_code}")

        if response.status_code == 200:
            result = response.json()
            print(f"继续对话 - AI 回复: {result.get('reply')}")
            # 获取并打印更新后的历史记录
            fetch_history_for_id(token, specific_conversation_id, context_message="继续对话后")
        else:
            print(f"继续对话 - 请求失败: {response.text}")

    except Exception as e:
        print(f"继续对话 - 请求异常: {str(e)}")


if __name__ == "__main__":
    print("开始测试多轮对话与历史记录功能...")
    
    # 步骤 1: 运行一次完整的对话流程来创建新的对话
    # 这个函数会从一个新的对话开始，获取conversation_id，并进行后续操作
    test_multi_turn_conversation_and_history(TOKEN)
    
    # # --- 测试继续对话部分 (暂时注释掉，以专注于新对话测试) ---
    # print("\\n" + "="*20 + " 测试继续对话部分 " + "="*20)
    
    # # 步骤 2: 设置一个从之前运行中获取到的 conversation_id
    # known_conversation_id = None 
    # ORIGINAL_PLACEHOLDER_ID = "YOUR_PREVIOUSLY_OBTAINED_CONVERSATION_ID" 
    
    # # 检查用户是否已替换占位符ID
    # if known_conversation_id == ORIGINAL_PLACEHOLDER_ID: 
    #     print("\\n重要提示：")
    #     print("要测试继续对话功能，请编辑 multichat_history_test.py 文件，")
    #     print(f"将变量 'known_conversation_id' 的值替换为你从上一次运行中获得的实际会话ID。")
    #     print(f"例如: known_conversation_id = \"{ORIGINAL_PLACEHOLDER_ID.replace('YOUR_PREVIOUSLY_OBTAINED_CONVERSATION_ID', 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx')}\"")
    #     print("如果不替换，继续对话的测试将被跳过。")

    # # 如果提供了有效的 known_conversation_id (不是原始占位符)，则尝试继续对话
    # elif TOKEN and known_conversation_id: 
    #     print(f"\\n将尝试继续已知的对话ID: {known_conversation_id}")
        
    #     # 在继续对话前，先获取一次历史记录（可选，用于对比）
    #     fetch_history_for_id(TOKEN, known_conversation_id, context_message="继续对话前")

    #     test_continue_specific_conversation(
    #         TOKEN, 
    #         known_conversation_id, 
    #         "我上一句话说的是什么？", # 你想继续聊的话题
    #         "wise_mentor"  # 使用与该会话一致的agent或新的agent
    #     )
    # elif not TOKEN and known_conversation_id: # Added check for known_conversation_id to avoid message if not testing continue
    #     print("\\nToken 未设置，无法进行继续对话的测试。")

    print("\n测试完成！")
