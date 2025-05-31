import requests

# 先登录获取token
login_url = "http://localhost:8000/auth/token"
login_data = {
    "username": "mytestuser",
    "password": "mytestuser"
}

login_resp = requests.post(login_url, data=login_data)
print("Login:", login_resp.json())

token = login_resp.json().get("access_token")
print("Token obtained:", token[:50] + "..." if token else None)

# 测试获取用户信息端点
if token:
    user_info_url = "http://localhost:8000/auth/user"
    headers = {"Authorization": f"Bearer {token}"}
    
    user_resp = requests.get(user_info_url, headers=headers)
    print("User Info Response Status:", user_resp.status_code)
    print("User Info:", user_resp.json())
else:
    print("No token received, cannot test user info endpoint")
