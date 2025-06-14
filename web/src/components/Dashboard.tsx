import React, { useState, useEffect } from 'react';
import { Container, Typography, Box, Card, CardContent, CircularProgress, Alert } from '@mui/material';
import { useNavigate } from 'react-router-dom';

interface DashboardStats {
  total_users: number;
  total_messages: number;
  total_conversations: number;
  agent_usage: Array<{
    agent_type: string;
    count: number;
  }>;
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setError('请先登录');
          return;
        }

        const response = await fetch('/api/dashboard/stats', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.status === 403) {
          setError('需要管理员权限');
          navigate('/login');
          return;
        }

        if (!response.ok) {
          throw new Error('获取统计数据失败');
        }

        const data = await response.json();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '获取统计数据失败');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [navigate]);

  if (loading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg">
        <Alert severity="error" sx={{ mt: 4 }}>
          {error}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          系统概览
        </Typography>
        
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 3 }}>
          <Box>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  总用户数
                </Typography>
                <Typography variant="h4">
                  {stats?.total_users || 0}
                </Typography>
              </CardContent>
            </Card>
          </Box>
          
          <Box>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  总消息数
                </Typography>
                <Typography variant="h4">
                  {stats?.total_messages || 0}
                </Typography>
              </CardContent>
            </Card>
          </Box>
          
          <Box>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  总会话数
                </Typography>
                <Typography variant="h4">
                  {stats?.total_conversations || 0}
                </Typography>
              </CardContent>
            </Card>
          </Box>
        </Box>

        <Typography variant="h5" sx={{ mt: 4, mb: 2 }}>
          助教使用分布
        </Typography>
        
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 3 }}>
          {stats?.agent_usage.map((agent) => (
            <Box key={agent.agent_type}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    {agent.agent_type}
                  </Typography>
                  <Typography variant="h4">
                    {agent.count}
                  </Typography>
                </CardContent>
              </Card>
            </Box>
          ))}
        </Box>
      </Box>
    </Container>
  );
};

export default Dashboard;