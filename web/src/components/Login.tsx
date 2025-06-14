import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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

const Login = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [userType, setUserType] = useState<'user' | 'admin'>('user');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [openResetDialog, setOpenResetDialog] = useState(false);
  const [email, setEmail] = useState('');
  const [resetStatus, setResetStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [resetError, setResetError] = useState<string | null>(null);
  const [loginSuccess, setLoginSuccess] = useState<{type: 'user' | 'admin', isAdmin: boolean} | null>(null);

  useEffect(() => {
    if (loginSuccess) {
      if (loginSuccess.type === 'user') {
        navigate('/chat', { replace: true });
      } else if (loginSuccess.type === 'admin' && loginSuccess.isAdmin) {
        navigate('/admin', { replace: true });
      }
    }
  }, [loginSuccess, navigate]);

  const handleLogin = async () => {
    if (!username || !password) {
      setLoginError('请输入用户名和密码');
      return;
    }

    try {
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);

      console.log('发送登录请求...');
      const response = await fetch('/api/auth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      console.log('收到登录响应:', response.status);
      const data = await response.json();
      console.log('登录响应数据:', data);

      if (!response.ok) {
        throw new Error(data.detail || '登录失败');
      }

      if (!data.access_token) {
        throw new Error('未收到访问令牌');
      }

      localStorage.setItem('token', data.access_token);
      console.log('已保存token');
      
      // 获取用户信息
      console.log('获取用户信息...');
      const userResponse = await fetch('/api/auth/user', {
        headers: {
          'Authorization': `Bearer ${data.access_token}`,
        },
      });
      
      console.log('用户信息响应:', userResponse.status);
      if (!userResponse.ok) {
        throw new Error('获取用户信息失败');
      }
      
      const userData = await userResponse.json();
      console.log('用户信息:', userData);

      // 保存用户信息到 localStorage
      localStorage.setItem('user', JSON.stringify(userData));
      
      // 设置登录成功状态，让 useEffect 处理导航
      if (userType === 'user') {
        localStorage.setItem('loginMode', 'user');
        setLoginSuccess({ type: 'user', isAdmin: false });
      } else if (userType === 'admin') {
        if (!userData.is_admin) {
          setLoginError('您不是管理员，请使用普通用户登录');
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('loginMode');
          return;
        }
        localStorage.setItem('loginMode', 'admin');
        setLoginSuccess({ type: 'admin', isAdmin: true });
      }
    } catch (error) {
      console.error('登录错误:', error);
      setLoginError(error instanceof Error ? error.message : '登录失败');
      // 清除可能部分保存的数据
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('loginMode');
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setResetError('请输入邮箱地址');
      return;
    }

    setResetStatus('loading');
    setResetError(null);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || '重置密码请求失败');
      }

      setResetStatus('success');
    } catch (error) {
      setResetError(error instanceof Error ? error.message : '重置密码请求失败');
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
          <Box component="form" onSubmit={(e) => {
            e.preventDefault();
            handleLogin();
          }} sx={{ mt: 1 }}>
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
              <Link
                component="button"
                variant="body2"
                onClick={() => navigate('/register')}
              >
                注册账号
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
        <DialogTitle>重置密码</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="邮箱地址"
            type="email"
            fullWidth
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {resetError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {resetError}
            </Alert>
          )}
          {resetStatus === 'success' && (
            <Alert severity="success" sx={{ mt: 2 }}>
              重置密码链接已发送到您的邮箱
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenResetDialog(false)}>取消</Button>
          <Button
            onClick={handleResetPassword}
            disabled={resetStatus === 'loading'}
          >
            {resetStatus === 'loading' ? '发送中...' : '发送重置链接'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Login; 