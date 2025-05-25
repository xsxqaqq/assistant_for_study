import requests

url = "http://localhost:8000/auth/token"
data = {
    "username": "admin",
    "password": "admin123"
}

resp = requests.post(url, data=data)
print("Login:", resp.json())

# 如果要获取 token，可以这样拿
token = resp.json().get("access_token")
print("Token:", token)
