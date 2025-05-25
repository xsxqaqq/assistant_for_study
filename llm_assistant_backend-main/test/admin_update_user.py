import requests

user_id = 1  # 要更新的用户ID
url = f"http://localhost:8000/auth/users/{user_id}"
admin_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsImV4cCI6MTc0ODAxNzczMH0.F3FJVqTt7NnYChhi2NIKtc_YMRhoQSXURSzZM7j_8g8"

headers = {
    "Authorization": f"Bearer {admin_token}",
    "Content-Type": "application/json"
}

data = {
    "username": "new_username",
    "email": "new_email@example.com",
    "password": "newPassword123"
}

resp = requests.put(url, headers=headers, json=data)
print("更新用户：", resp.status_code, resp.json())
