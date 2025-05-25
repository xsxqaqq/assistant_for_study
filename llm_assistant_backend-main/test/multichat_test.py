import requests

url = "http://localhost:8000/chat/history" 

token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0X3VzZXIiLCJleHAiOjE3NDgwMTAzNDR9.EJMkhX2pWgg23fcdWskhPArreiJgkY_2Xz9aUFOWT7M" 

headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json"
}

# 构造多轮对话的请求体
data = {
    "history": [
        {"role": "user", "content": "你好，我叫小明。"},
        {"role": "assistant", "content": "你好小明！很高兴认识你。有什么可以帮助你的吗？"},
        {"role": "user", "content": "我是谁？"}
    ]
}

resp = requests.post(url, headers=headers, json=data)
print("Status Code:", resp.status_code)
print("Response JSON:", resp.json())

