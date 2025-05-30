import requests

url = "http://localhost:8000/auth/register"
data = {
    "username": "mytestuser",
    "email": "1@2.com",
    "password": "123",
}

resp = requests.post(url, json=data)
print(resp.json())