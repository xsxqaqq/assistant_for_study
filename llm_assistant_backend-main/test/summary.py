import requests

token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0X3VzZXIiLCJleHAiOjE3NDgwMTAzNDR9.EJMkhX2pWgg23fcdWskhPArreiJgkY_2Xz9aUFOWT7M" 
url = "http://localhost:8000/summary/"
headers = {
    "Authorization": f"Bearer {token}"
}
file_path = "D:\\agent_learn\\test.txt"  # 替换为实际文件路径
files = {
    "file": open(file_path, "rb")
}

resp = requests.post(url, headers=headers, files=files)
print("Summary:", resp.json())
