import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging
import os
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

# 邮件配置
SMTP_HOST = "smtp.163.com"
SMTP_PORT = 465  # 使用SSL端口
EMAIL_ADDRESS = "lrd_hit@163.com"
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD", "LNbSMLZfVwCmU688")  # 从环境变量获取邮箱授权码
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")  # 从环境变量获取前端URL

async def send_reset_password_email(to_email: str, reset_token: str):
    """
    发送重置密码邮件
    
    Args:
        to_email: 接收邮件的邮箱地址
        reset_token: 重置密码的令牌
    """
    try:
        # 创建邮件内容
        message = MIMEMultipart()
        message["From"] = EMAIL_ADDRESS
        message["To"] = to_email
        message["Subject"] = "重置您的密码"
          # 构建重置密码链接 - 使用环境变量中的前端URL
        reset_url = f"{FRONTEND_URL}/reset-password/confirm?token={reset_token}"
        
        # 邮件HTML内容
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>重置密码</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #1976d2;">重置您的密码</h2>
                <p>您好！</p>
                <p>我们收到了您重置密码的请求。请点击下面的链接来设置新密码：</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{reset_url}" 
                       style="display: inline-block; padding: 12px 24px; 
                              background-color: #1976d2; color: white; 
                              text-decoration: none; border-radius: 4px;">
                        重置密码
                    </a>
                </div>
                <p>如果按钮无法点击，请复制以下链接到浏览器中打开：</p>
                <p style="word-break: break-all; background-color: #f5f5f5; padding: 10px; border-radius: 4px;">
                    {reset_url}
                </p>
                <p><strong>注意：</strong></p>
                <ul>
                    <li>此链接有效期为1小时</li>
                    <li>如果您没有请求重置密码，请忽略此邮件</li>
                    <li>为了账户安全，请不要将此链接分享给他人</li>
                </ul>
                <p>祝您使用愉快！</p>
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                <p style="font-size: 12px; color: #888;">
                    此邮件由系统自动发送，请勿回复。
                </p>
            </div>
        </body>
        </html>
        """
        
        # 添加HTML内容到邮件
        message.attach(MIMEText(html_content, "html", "utf-8"))
          # 发送邮件 - 使用SSL连接
        await aiosmtplib.send(
            message,
            hostname=SMTP_HOST,
            port=SMTP_PORT,
            use_tls=True,  # 使用SSL
            username=EMAIL_ADDRESS,
            password=EMAIL_PASSWORD,
        )
        
        logger.info(f"重置密码邮件已发送到: {to_email}")
        return True
        
    except Exception as e:
        logger.error(f"发送邮件失败: {str(e)}")
        return False

async def send_password_changed_notification(to_email: str, username: str):
    """
    发送密码已更改通知邮件
    
    Args:
        to_email: 接收邮件的邮箱地址
        username: 用户名
    """
    try:
        message = MIMEMultipart()
        message["From"] = EMAIL_ADDRESS
        message["To"] = to_email
        message["Subject"] = "密码已成功更改"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>密码已更改</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #1976d2;">密码更改通知</h2>
                <p>您好 {username}！</p>
                <p>您的账户密码已成功更改。</p>
                <p><strong>更改时间：</strong> {logger.info}</p>
                <p>如果这不是您本人操作，请立即联系我们的客服团队。</p>
                <p>为了账户安全，建议您：</p>
                <ul>
                    <li>定期更改密码</li>
                    <li>使用强密码（包含字母、数字和特殊字符）</li>
                    <li>不要在多个网站使用相同密码</li>
                </ul>
                <p>祝您使用愉快！</p>
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                <p style="font-size: 12px; color: #888;">
                    此邮件由系统自动发送，请勿回复。
                </p>
            </div>
        </body>
        </html>
        """
        message.attach(MIMEText(html_content, "html", "utf-8"))
        
        await aiosmtplib.send(
            message,
            hostname=SMTP_HOST,
            port=SMTP_PORT,
            use_tls=True,  # 使用SSL
            username=EMAIL_ADDRESS,
            password=EMAIL_PASSWORD,
        )
        
        logger.info(f"密码更改通知邮件已发送到: {to_email}")
        return True
        
    except Exception as e:
        logger.error(f"发送密码更改通知邮件失败: {str(e)}")
        return False
