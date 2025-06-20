import { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  Container,
  Link,
  Alert,
} from '@mui/material';

const RequestPasswordReset = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      setErrorMessage('请输入邮箱地址');
      return;
    }
    
    // 简单的邮箱格式验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setErrorMessage('请输入有效的邮箱地址');
      return;
    }
    
    setStatus('loading');
    setErrorMessage('');
    
    try {      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus('success');
      } else {
        setStatus('error');
        setErrorMessage(data.detail || '发送失败，请稍后重试');
      }
    } catch (error) {
      console.error('重置密码错误:', error);
      setStatus('error');
      setErrorMessage('网络错误，请稍后重试');
    }
  };

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
          <Typography component="h1" variant="h5" align="center" gutterBottom>
            找回密码
          </Typography>
          
          <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
            请输入您注册时使用的邮箱地址，我们将向您发送重置密码的链接
          </Typography>

          {status === 'success' && (
            <Alert severity="success" sx={{ mb: 2 }}>
              重置密码链接已发送到您的邮箱，请查收邮件并按照指示操作
            </Alert>
          )}
          
          {status === 'error' && errorMessage && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errorMessage}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
            <TextField
              margin="normal"
              required
              fullWidth
              label="邮箱地址"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={status === 'loading'}
              autoFocus
              placeholder="请输入您的邮箱地址"
            />
            
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={status === 'loading'}
            >
              {status === 'loading' ? '发送中...' : '发送重置链接'}
            </Button>
            
            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Link href="/login" variant="body2" sx={{ mr: 2 }}>
                返回登录
              </Link>
              <Box component="span" sx={{ color: '#999' }}>|</Box>
              <Link href="/register" variant="body2" sx={{ ml: 2 }}>
                注册新账户
              </Link>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default RequestPasswordReset;