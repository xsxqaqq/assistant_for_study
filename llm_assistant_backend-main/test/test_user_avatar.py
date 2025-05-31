import requests

# 第一步：登录获取token
login_url = "http://localhost:8000/auth/token"
login_data = {
    "username": "mytestuser",
    "password": "mytestuser"
}

print("正在登录...")
login_resp = requests.post(login_url, data=login_data)
print("登录响应:", login_resp.json())

if login_resp.status_code == 200:
    token = login_resp.json().get("access_token")
    print("Token获取成功:", token[:20] + "..." if token else "None")
    
    # 第二步：使用token获取用户信息
    user_info_url = "http://localhost:8000/auth/user"
    headers = {"Authorization": f"Bearer {token}"}
    
    print("\n正在获取用户信息...")
    user_resp = requests.get(user_info_url, headers=headers)
    print("用户信息响应状态码:", user_resp.status_code)
    print("用户信息响应内容:", user_resp.json())
    
else:
    print("登录失败，状态码:", login_resp.status_code)
