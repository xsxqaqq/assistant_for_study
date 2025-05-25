import requests

url = "http://localhost:8000/auth/users/"
admin_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsImV4cCI6MTc0ODAxNzczMH0.F3FJVqTt7NnYChhi2NIKtc_YMRhoQSXURSzZM7j_8g8"

headers = {
    "Authorization": f"Bearer {admin_token}",
}

resp = requests.get(url, headers=headers)
print("所有用户：", resp.status_code)
for user in resp.json():
    print(user)
