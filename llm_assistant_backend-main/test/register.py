import requests

url = "http://localhost:8000/auth/register"
data = {
    "username": "admin",
    "email": "admin@example.com",
    "password": "admin123",
}

resp = requests.post(url, json=data)
print(resp.json())