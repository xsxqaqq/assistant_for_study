import requests
import uuid # 用于生成唯一的用户名和邮箱，避免冲突

url = "http://localhost:8000/auth/admin/create_user"  # 管理员创建用户的URL

# !!! 重要: 这里的token需要是具有管理员权限的有效JWT !!!
admin_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsImV4cCI6MTc0ODAxNzczMH0.F3FJVqTt7NnYChhi2NIKtc_YMRhoQSXURSzZM7j_8g8" 

headers = {
    "Authorization": f"Bearer {admin_token}",
    "Content-Type": "application/json"
}


new_username = f"testuser_{uuid.uuid4().hex[:8]}"
new_email = f"{new_username}@example.com"

data = {
    "username": new_username,
    "email": new_email,
    "password": "aSecurePassword123!"
}

print(f"Attempting to create user: {new_username} with email: {new_email}")

resp = requests.post(url, headers=headers, json=data)

print("Status Code:", resp.status_code)
try:
    print("Response JSON:", resp.json())
except requests.exceptions.JSONDecodeError:
    print("Response Content:", resp.text)

