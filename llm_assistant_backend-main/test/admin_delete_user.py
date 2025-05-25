import requests

user_id = 4  # 要删除的用户ID
url = f"http://localhost:8000/auth/users/{user_id}"
admin_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsImV4cCI6MTc0ODAxNzczMH0.F3FJVqTt7NnYChhi2NIKtc_YMRhoQSXURSzZM7j_8g8"

headers = {
    "Authorization": f"Bearer {admin_token}"
}

resp = requests.delete(url, headers=headers)
print("删除用户：", resp.status_code)
print("响应内容：", resp.text)
