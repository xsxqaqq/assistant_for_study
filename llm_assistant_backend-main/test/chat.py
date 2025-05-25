import requests

url = "http://localhost:8000/chat/"
token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0X3VzZXIiLCJleHAiOjE3NDgwMTAzNDR9.EJMkhX2pWgg23fcdWskhPArreiJgkY_2Xz9aUFOWT7M" 

headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json"
}

data = {
    "message": "什么是机器学习？"
}

resp = requests.post(url, headers=headers, json=data)
print(resp.json())
