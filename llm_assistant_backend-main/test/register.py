import requests

url = "http://localhost:8000/auth/register"
data = {
    "username": "1",
    "email": "1@1.com",
    "password": "1",
    "is_admin": True  # 设置为管理员
}

resp = requests.post(url, json=data)
print(resp.json())