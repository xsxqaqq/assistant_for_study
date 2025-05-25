import { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  Container,
  Link,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [openResetDialog, setOpenResetDialog] = useState(false);
  const [email, setEmail] = useState('');
  const [resetStatus, setResetStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [loginError, setLoginError] = useState('');
  const [userType, setUserType] = useState<'user' | 'admin'>('user');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    
    try {
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      if (response.ok) {
        const { access_token } = await response.json();
        localStorage.setItem('token', access_token);
        
        // 获取用户信息以验证身份
        const userResponse = await fetch('/api/auth/users/me/', {
          headers: {
            'Authorization': `Bearer ${access_token}`
          }
        });

        if (userResponse.ok) {
          const userData = await userResponse.json();
          
          // 如果是普通用户登录，直接跳转到聊天页面
          if (userType === 'user') {
            navigate('/chat');
            return;
          }
          
          // 如果是管理员登录，验证权限
          if (userType === 'admin') {
            if (!userData.is_admin) {
              setLoginError('您没有管理员权限');
              localStorage.removeItem('token');
              return;
            }
            navigate('/admin');
          }
        } else {
          throw new Error('获取用户信息失败');
        }
      } else {
        const { detail } = await response.json();
        setLoginError(detail || '登录失败，请检查用户名和密码');
      }
    } catch (error) {
      console.error('登录错误:', error);
      setLoginError('登录失败，请稍后重试');
      localStorage.removeItem('token');
    }
  };

  const handleResetPassword = async () => {
    if (!email) return;
    
    setResetStatus('loading');
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
        setResetStatus('success');
        setTimeout(() => {
          setOpenResetDialog(false);
          setResetStatus('idle');
          setEmail('');
        }, 2000);
      } else {
        setResetStatus('error');
      }
    } catch (error) {
      console.error('重置密码错误:', error);
      setResetStatus('error');
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
            登录
          </Typography>
          {loginError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {loginError}
            </Alert>
          )}
          <Box component="form" onSubmit={handleLogin} sx={{ mt: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
              <ToggleButtonGroup
                value={userType}
                exclusive
                onChange={(_, value) => value && setUserType(value)}
                aria-label="用户类型"
              >
                <ToggleButton value="user" aria-label="普通用户">
                  普通用户
                </ToggleButton>
                <ToggleButton value="admin" aria-label="管理员">
                  管理员
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
            <TextField
              margin="normal"
              required
              fullWidth
              label="用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
            />
            <TextField
              margin="normal"
              required
              fullWidth
              label="密码"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
            >
              登录
            </Button>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Link href="/register" variant="body2">
                {"还没有账号？立即注册"}
              </Link>
              <Link 
                component="button"
                variant="body2"
                onClick={() => setOpenResetDialog(true)}
              >
                忘记密码？
              </Link>
            </Box>
          </Box>
        </Paper>
      </Box>

      <Dialog open={openResetDialog} onClose={() => setOpenResetDialog(false)}>
        <DialogTitle>找回密码</DialogTitle>
        <DialogContent>
          {resetStatus === 'success' && (
            <Alert severity="success" sx={{ mb: 2 }}>
              重置密码链接已发送到您的邮箱
            </Alert>
          )}
          {resetStatus === 'error' && (
            <Alert severity="error" sx={{ mb: 2 }}>
              发送失败，请稍后重试
            </Alert>
          )}
          <TextField
            autoFocus
            margin="dense"
            label="邮箱地址"
            type="email"
            fullWidth
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={resetStatus === 'loading'}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenResetDialog(false)}>取消</Button>
          <Button 
            onClick={handleResetPassword} 
            disabled={!email || resetStatus === 'loading'}
          >
            发送重置链接
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Login; 