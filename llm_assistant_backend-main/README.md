建议重新创一个conda(py3.9可行)
示例：

conda create -n agent-assistant python=3.9

conda activate agent-assistant

pip install -r requirements.txt

在根目录创建一个文件，命名为.env,里面写上 OPENAI_API_KEY = "your key"

python run.py

另开终端做测试
