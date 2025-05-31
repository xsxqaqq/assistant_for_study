import React, { useState, useEffect } from 'react';
import { 
    TextField, 
    Button, 
    Container, 
    Typography, 
    Avatar, 
    Box, 
    CircularProgress, 
    Alert,
    Card,
    CardContent,
    Divider,
    IconButton,
    Stack
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PersonIcon from '@mui/icons-material/Person';
import EmailIcon from '@mui/icons-material/Email';
import LockIcon from '@mui/icons-material/Lock';

interface ApiError extends Error {
    detail?: string;
}

// API调用函数
const fetchApi = async (url: string, options: RequestInit = {}) => {
    const response = await fetch(url, options);
    if (!response.ok) {
        // 尝试解析JSON错误体，如果失败，则使用通用的错误消息
        const errorData = await response.json().catch(() => ({ detail: `Request failed with status ${response.status}` }));
        const error = new Error(errorData.detail || `Request failed with status ${response.status}`) as ApiError;
        error.detail = errorData.detail;
        throw error;
    }
    // 如果响应状态码是 204 No Content 或者其他表示没有内容的成功状态码，则不尝试解析json
    if (response.status === 204 || response.headers.get("Content-Length") === "0") { 
        return null; 
    }
    return response.json();
};

const getCurrentUser = async (token: string) => {
    // 确保使用完整的URL或已配置的代理路径
    return fetchApi('/api/auth/users/me/', { 
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });
};

const updateUserEmail = async (email: string, token: string) => {
    return fetchApi('/api/auth/users/me/info', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ email }),
    });
};

const updateUserPassword = async (new_password: string, token: string) => {
    return fetchApi('/api/auth/users/me/password', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ new_password }),
    });
};


const Profile: React.FC = () => {
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [loading, setLoading] = useState(true); // 初始数据加载
    const [actionLoading, setActionLoading] = useState(false); // 表单提交加载
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/login');
            return;
        }
        setLoading(true);
        getCurrentUser(token)
            .then(data => {
                if (data) {
                    setEmail(data.email);
                    setUsername(data.username);
                }
                setLoading(false);
            })
            .catch((err: ApiError) => {
                const message = err.detail || err.message || '获取用户信息失败';
                setError(message);
                setLoading(false);
                if (message.toLowerCase().includes('unauthorized') || 
                    message.toLowerCase().includes('invalid token') || 
                    message.includes('无效的认证凭据')) {
                    localStorage.removeItem('token');
                    navigate('/login');
                }
            });
    }, [navigate]);

    const handleEmailUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccessMessage(null);
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/login');
            return;
        }
        setActionLoading(true);
        try {
            await updateUserEmail(email, token);
            setSuccessMessage('邮箱更新成功！');
        } catch (err) {
            const apiError = err as ApiError;
            setError(apiError.detail || apiError.message || '邮箱更新失败');
        } finally {
            setActionLoading(false);
        }
    };

    const handlePasswordUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccessMessage(null);
        if (newPassword !== confirmNewPassword) {
            setError('新密码两次输入不一致');
            return;
        }
        if (!newPassword) {
            setError('新密码不能为空');
            return;
        }
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/login');
            return;
        }        setActionLoading(true);
        try {
            await updateUserPassword(newPassword, token);
            setSuccessMessage('密码修改成功！请重新登录。');
            setNewPassword('');
            setConfirmNewPassword('');
            localStorage.removeItem('token');
            setTimeout(() => navigate('/login'), 2000);
        } catch (err) {
            const apiError = err as ApiError;
            setError(apiError.detail || apiError.message || '密码修改失败');
        } finally {
            setActionLoading(false);
        }
    };    if (loading) { 
        return (
            <Container sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <CircularProgress />
            </Container>
        );
    }

    return (
        <Box sx={{ 
            minHeight: '100vh', 
            bgcolor: 'grey.50', 
            py: 4 
        }}>
            <Container maxWidth="lg">
                {/* 头部导航 */}
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
                    <IconButton 
                        onClick={() => navigate('/chat')} 
                        sx={{ mr: 2 }}
                        color="primary"
                    >
                        <ArrowBackIcon />
                    </IconButton>
                    <Typography variant="h4" color="primary" fontWeight="bold">
                        个人资料设置
                    </Typography>
                </Box>

                {/* 错误和成功消息 */}
                {error && (
                    <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
                        {error}
                    </Alert>
                )}
                {successMessage && (
                    <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccessMessage(null)}>
                        {successMessage}
                    </Alert>
                )}                <Box sx={{ 
                    display: 'flex', 
                    flexDirection: { xs: 'column', md: 'row' }, 
                    gap: 4 
                }}>
                    {/* 左侧用户信息展示 */}
                    <Box sx={{ flex: { xs: 'none', md: '0 0 33%' } }}>
                        <Card sx={{ textAlign: 'center', p: 3 }}>
                            <Avatar 
                                sx={{ 
                                    width: 120, 
                                    height: 120, 
                                    fontSize: '3rem',
                                    bgcolor: 'primary.main',
                                    mx: 'auto',
                                    mb: 2
                                }}
                            >
                                {username ? username.charAt(0).toUpperCase() : 'U'}
                            </Avatar>
                            <Typography variant="h5" gutterBottom fontWeight="bold">
                                {username || '用户'}
                            </Typography>
                            <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                                {email || '未设置邮箱'}
                            </Typography>
                            <Divider sx={{ my: 2 }} />
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                                <PersonIcon sx={{ mr: 1, color: 'text.secondary' }} />
                                <Typography variant="body2" color="text.secondary">
                                    用户名: {username}
                                </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <EmailIcon sx={{ mr: 1, color: 'text.secondary' }} />
                                <Typography variant="body2" color="text.secondary">
                                    当前邮箱: {email}
                                </Typography>
                            </Box>
                        </Card>
                    </Box>

                    {/* 右侧设置表单 */}
                    <Box sx={{ flex: 1 }}>
                        <Stack spacing={3}>
                            {/* 邮箱更新卡片 */}
                            <Card>
                                <CardContent>
                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                        <EmailIcon sx={{ mr: 1, color: 'primary.main' }} />
                                        <Typography variant="h6" color="primary">
                                            更新邮箱地址
                                        </Typography>
                                    </Box>
                                    <Box component="form" onSubmit={handleEmailUpdate}>
                                        <TextField
                                            margin="normal"
                                            required
                                            fullWidth
                                            id="email"
                                            label="新邮箱地址"
                                            name="email"
                                            autoComplete="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            disabled={actionLoading}
                                            variant="outlined"
                                        />
                                        <Button
                                            type="submit"
                                            variant="contained"
                                            sx={{ mt: 2 }}
                                            disabled={actionLoading}
                                            startIcon={actionLoading ? <CircularProgress size={20} /> : <EmailIcon />}
                                        >
                                            更新邮箱
                                        </Button>
                                    </Box>
                                </CardContent>
                            </Card>

                            {/* 密码修改卡片 */}
                            <Card>
                                <CardContent>
                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                        <LockIcon sx={{ mr: 1, color: 'primary.main' }} />
                                        <Typography variant="h6" color="primary">
                                            修改密码
                                        </Typography>
                                    </Box>
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                        设置新密码，修改后需要重新登录
                                    </Typography>
                                    <Box component="form" onSubmit={handlePasswordUpdate}>
                                        <Box sx={{ 
                                            display: 'flex', 
                                            flexDirection: { xs: 'column', sm: 'row' }, 
                                            gap: 2 
                                        }}>
                                            <TextField
                                                margin="normal"
                                                required
                                                fullWidth
                                                name="newPassword"
                                                label="新密码"
                                                type="password"
                                                id="newPassword"
                                                autoComplete="new-password"
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                disabled={actionLoading}
                                                variant="outlined"
                                            />
                                            <TextField
                                                margin="normal"
                                                required
                                                fullWidth
                                                name="confirmNewPassword"
                                                label="确认新密码"
                                                type="password"
                                                id="confirmNewPassword"
                                                autoComplete="new-password"
                                                value={confirmNewPassword}
                                                onChange={(e) => setConfirmNewPassword(e.target.value)}
                                                disabled={actionLoading}
                                                variant="outlined"
                                            />
                                        </Box>
                                        <Button
                                            type="submit"
                                            variant="contained"
                                            sx={{ mt: 2 }}
                                            disabled={actionLoading}
                                            startIcon={actionLoading ? <CircularProgress size={20} /> : <LockIcon />}
                                        >
                                            修改密码
                                        </Button>
                                    </Box>
                                </CardContent>
                            </Card>
                        </Stack>
                    </Box>
                </Box>
            </Container>
        </Box>
    );
};

export default Profile;
