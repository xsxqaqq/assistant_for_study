import requests

# 测试登录
url = "http://localhost:8000/auth/token"
data = {
    "username": "test", 
    "password": "test123"
}

print("1. 测试登录...")
resp = requests.post(url, data=data)
print("Login response:", resp.json())

if resp.status_code == 200:
    token = resp.json().get("access_token")
    print("Token:", token)
    
    # 测试获取用户信息
    print("\n2. 测试获取用户信息...")
    headers = {"Authorization": f"Bearer {token}"}
    user_resp = requests.get("http://localhost:8000/auth/user", headers=headers)
    print("User info response:", user_resp.json())
    
    # 测试获取agents
    print("\n3. 测试获取agents...")
    agents_resp = requests.get("http://localhost:8000/chat/agents", headers=headers)
    print("Agents response:", agents_resp.json())
    
else:
    print("登录失败！")
