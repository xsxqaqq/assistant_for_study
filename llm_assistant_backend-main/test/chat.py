import requests

url = "http://localhost:8000/chat/"
token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwiZXhwIjoxNzQ5ODMyMTEwfQ.4n8Bidc1IvcyC-pPUqMbjc_p_7TR1p-nmA6cN_7nJk0" 

headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json"
}

data = {
    "message": "什么是机器学习？"
}

resp = requests.post(url, headers=headers, json=data)
print(resp.json())
