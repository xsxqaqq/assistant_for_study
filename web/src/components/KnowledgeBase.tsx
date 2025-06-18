import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Button,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
} from '@mui/material';
import {
  Upload as UploadIcon,
  Delete as DeleteIcon,
  Send as SendIcon,
  Refresh as RefreshIcon,
  Info as InfoIcon,
  Pending as PendingIcon,
} from '@mui/icons-material';
import type { Document, DocumentUploadResponse, RAGQueryResponse, TaskStatusResponse } from '../types';

interface Metrics {
  total_queries: number;
  cache_hit_rate: number;
  error_rate: number;
  avg_response_time: number;
  vector_db_size: number;
  document_count: number;
}

const KnowledgeBase: React.FC = () => {
  // 状态管理
  const [documents, setDocuments] = useState<Document[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [relevantChunks, setRelevantChunks] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showMetrics, setShowMetrics] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [processingTasks, setProcessingTasks] = useState<Set<string>>(new Set());

  // 获取文档列表
  const fetchDocuments = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('请先登录');
      return;
    }

    try {
      console.log('开始获取文档列表');
      const response = await fetch('/api/rag/documents', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('获取文档列表失败');
      }

      const data = await response.json();
      console.log('获取到的文档列表:', data);
      setDocuments(data.documents);
    } catch (err) {
      console.error('获取文档列表失败:', err);
      setError(err instanceof Error ? err.message : '获取文档列表失败');
    }
  };

  // 获取系统指标
  const fetchMetrics = async () => {
    try {
      console.log('开始获取系统指标');
      const response = await fetch('/api/rag/metrics', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('获取指标失败');
      const data = await response.json();
      console.log('获取到的系统指标:', data);
      setMetrics(data);
    } catch (error) {
      console.error('获取指标失败:', error);
    }
  };

  // 轮询任务状态
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      if (processingTasks.size === 0) return;

      const token = localStorage.getItem('token');
      if (!token) return;

      for (const taskId of processingTasks) {
        try {
          const response = await fetch(`/api/rag/tasks/${taskId}/status`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (!response.ok) continue;

          const data: TaskStatusResponse = await response.json();
          if (data.status !== 'processing') {
            setProcessingTasks(prev => {
              const next = new Set(prev);
              next.delete(taskId);
              return next;
            });
            fetchDocuments(); // 刷新文档列表
          }
        } catch (error) {
          console.error('轮询任务状态失败:', error);
        }
      }
    }, 5000); // 每5秒轮询一次

    return () => clearInterval(pollInterval);
  }, [processingTasks]);

  // 上传文档
  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch('/api/rag/documents/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '文档上传失败');
      }

      const data: DocumentUploadResponse = await response.json();
      setSuccess('文档上传成功，正在处理中...');
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // 如果是后台处理，添加到轮询列表
      if (data.status === 'processing') {
        setProcessingTasks(prev => new Set(prev).add(data.document_id));
      } else {
        fetchDocuments();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '文档上传失败');
    } finally {
      setUploading(false);
    }
  };

  // 删除文档
  const handleDelete = async (documentId: string) => {
    if (!window.confirm('确定要删除这个文档吗？')) {
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      setError('请先登录');
      return;
    }

    try {
      const response = await fetch(`/api/rag/documents/${documentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('删除文档失败');
      }

      setSuccess('文档删除成功');
      fetchDocuments(); // 刷新文档列表
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除文档失败');
    }
  };

  // 查询知识库
  const handleQuery = async () => {
    if (!question.trim()) {
      setError('请输入问题');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      setError('请先登录');
      return;
    }

    setLoading(true);
    setError(null);
    setAnswer('');
    setRelevantChunks([]);

    try {
      const response = await fetch('/api/rag/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          question: question,
          top_k: 3,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '查询失败');
      }

      const data: RAGQueryResponse = await response.json();
      setAnswer(data.answer);
      setRelevantChunks(data.relevant_chunks);
    } catch (err) {
      setError(err instanceof Error ? err.message : '查询失败');
    } finally {
      setLoading(false);
    }
  };

  // 文件选择处理
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === 'text/plain' || 
          file.type === 'application/pdf' || 
          file.name.endsWith('.docx')) {
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
          setError('文件大小不能超过10MB');
          return;
        }
        setSelectedFile(file);
      } else {
        setError('请上传txt、pdf或docx文件');
      }
    }
  };

  // 渲染文档列表
  const renderDocumentList = () => (
    <List>
      {documents.map((doc) => (
        <ListItem key={doc.id}>
          <ListItemText
            primary={doc.filename}
            secondary={
              <>
                <Typography component="span" variant="body2" color="textPrimary">
                  上传时间: {new Date(doc.upload_time).toLocaleString()}
                </Typography>
                <br />
                <Typography component="span" variant="body2" color="textSecondary">
                  状态: {doc.status}
                </Typography>
                {doc.chunk_count > 0 && (
                  <>
                    <br />
                    <Typography component="span" variant="body2" color="textSecondary">
                      文本块数: {doc.chunk_count}
                    </Typography>
                  </>
                )}
              </>
            }
          />
          <ListItemSecondaryAction>
            <Tooltip title={doc.status === 'processing' ? '处理中' : '删除文档'}>
              <span>
                <IconButton
                  edge="end"
                  aria-label="delete"
                  onClick={() => handleDelete(doc.id)}
                  disabled={doc.status === 'processing'}
                >
                  {doc.status === 'processing' ? (
                    <PendingIcon color="primary" />
                  ) : (
                    <DeleteIcon />
                  )}
                </IconButton>
              </span>
            </Tooltip>
          </ListItemSecondaryAction>
        </ListItem>
      ))}
    </List>
  );

  // 初始化加载
  useEffect(() => {
    fetchDocuments();
    fetchMetrics();
  }, []);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* 标题和操作按钮 */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          知识库管理
        </Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<InfoIcon />}
            onClick={() => setShowMetrics(true)}
            sx={{ mr: 2 }}
          >
            系统指标
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => {
              fetchDocuments();
              fetchMetrics();
            }}
          >
            刷新
          </Button>
        </Box>
      </Box>

      {/* 错误和成功提示 */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
        {/* 左侧：文档管理 */}
        <Box>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              文档管理
            </Typography>
            <Box sx={{ mb: 3 }}>
              <input
                type="file"
                accept=".txt,.pdf,.docx"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
                ref={fileInputRef}
              />
              <Button
                variant="contained"
                startIcon={<UploadIcon />}
                onClick={() => fileInputRef.current?.click()}
                sx={{ mr: 2 }}
              >
                选择文件
              </Button>
              {selectedFile && (
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => handleUpload()}
                  disabled={uploading}
                >
                  {uploading ? <CircularProgress size={24} /> : '上传'}
                </Button>
              )}
              {selectedFile && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  已选择: {selectedFile.name}
                </Typography>
              )}
            </Box>
            {renderDocumentList()}
          </Paper>
        </Box>

        {/* 右侧：知识库问答 */}
        <Box>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              知识库问答
            </Typography>
            <Box sx={{ mb: 3 }}>
              <TextField
                fullWidth
                multiline
                rows={3}
                variant="outlined"
                label="输入您的问题"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                sx={{ mb: 2 }}
              />
              <Button
                variant="contained"
                endIcon={<SendIcon />}
                onClick={handleQuery}
                disabled={loading || !question.trim()}
                fullWidth
              >
                {loading ? <CircularProgress size={24} /> : '提问'}
              </Button>
            </Box>
            {answer && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle1" gutterBottom>
                  回答：
                </Typography>
                <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                  <Typography>{answer}</Typography>
                </Paper>
                {relevantChunks.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      相关文档片段：
                    </Typography>
                    {relevantChunks.map((chunk, index) => (
                      <Paper key={index} sx={{ p: 2, mb: 1, bgcolor: 'grey.50' }}>
                        <Typography variant="body2">{chunk}</Typography>
                      </Paper>
                    ))}
                  </Box>
                )}
              </Box>
            )}
          </Paper>
        </Box>
      </Box>

      {/* 系统指标对话框 */}
      <Dialog
        open={showMetrics}
        onClose={() => setShowMetrics(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>系统指标</DialogTitle>
        <DialogContent>
          {metrics ? (
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <Box>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      总查询次数
                    </Typography>
                    <Typography variant="h5">
                      {metrics.total_queries}
                    </Typography>
                  </CardContent>
                </Card>
              </Box>
              <Box>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      缓存命中率
                    </Typography>
                    <Typography variant="h5">
                      {(metrics.cache_hit_rate * 100).toFixed(1)}%
                    </Typography>
                  </CardContent>
                </Card>
              </Box>
              <Box>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      错误率
                    </Typography>
                    <Typography variant="h5">
                      {(metrics.error_rate * 100).toFixed(1)}%
                    </Typography>
                  </CardContent>
                </Card>
              </Box>
              <Box>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      平均响应时间
                    </Typography>
                    <Typography variant="h5">
                      {metrics.avg_response_time.toFixed(2)}s
                    </Typography>
                  </CardContent>
                </Card>
              </Box>
              <Box>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      向量数据库大小
                    </Typography>
                    <Typography variant="h5">
                      {metrics.vector_db_size}
                    </Typography>
                  </CardContent>
                </Card>
              </Box>
              <Box>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      文档数量
                    </Typography>
                    <Typography variant="h5">
                      {metrics.document_count}
                    </Typography>
                  </CardContent>
                </Card>
              </Box>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowMetrics(false)}>关闭</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default KnowledgeBase; 