import requests

# 首先登录获取token
login_url = "http://localhost:8000/auth/token"
login_data = {
    "username": "mytestuser",
    "password": "mytestuser"
}

print("1. 登录测试...")
resp = requests.post(login_url, data=login_data)
print("登录响应:", resp.json())

if resp.status_code == 200:
    token = resp.json().get("access_token")
    print("Token:", token)
    
    # 测试用户信息端点
    print("\n2. 获取用户信息测试...")
    user_url = "http://localhost:8000/auth/user"
    headers = {"Authorization": f"Bearer {token}"}
    
    user_resp = requests.get(user_url, headers=headers)
    print("用户信息响应状态:", user_resp.status_code)
    print("用户信息响应内容:", user_resp.json())
else:
    print("登录失败，无法测试用户信息端点")
