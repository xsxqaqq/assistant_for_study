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
import { useNavigate } from 'react-router-dom';

const ResetPassword = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error' | 'email-not-found'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const navigate = useNavigate();  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    setStatus('loading');
    setErrorMessage('');
    
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus('success');
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } else {
        if (response.status === 404 || data.detail?.includes('邮箱') || data.detail?.includes('不存在')) {
          setStatus('email-not-found');
          setErrorMessage('该邮箱尚未注册，请先注册账号');
        } else {
          setStatus('error');
          setErrorMessage(data.detail || '发送失败，请稍后重试');
        }
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
          <Box component="form" onSubmit={handleResetPassword} sx={{ mt: 1 }}>            {status === 'success' && (
              <Alert severity="success" sx={{ mb: 2 }}>
                重置密码链接已发送到您的邮箱，请查收
              </Alert>
            )}
            {status === 'email-not-found' && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                {errorMessage}
              </Alert>
            )}
            {status === 'error' && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {errorMessage}
              </Alert>
            )}
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
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={status === 'loading'}
            >
              发送重置链接
            </Button>
            <Box sx={{ textAlign: 'center' }}>
              <Link href="/login" variant="body2">
                {"返回登录"}
              </Link>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default ResetPassword; 