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
  LinearProgress,
  Snackbar,
  Chip,
} from '@mui/material';
import {
  Upload as UploadIcon,
  Delete as DeleteIcon,
  Send as SendIcon,
  Refresh as RefreshIcon,
  Info as InfoIcon,
  Pending as PendingIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Retry as RetryIcon,
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
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

  // 新增状态：文件上传进度、格式验证、重试等
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isRetrying, setIsRetrying] = useState(false)
  const [fileFormatError, setFileFormatError] = useState<string | null>(null)
  
  // 支持的文件格式
  const SUPPORTED_FORMATS = ['.pdf', '.txt', '.docx', '.md']
  const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

  // Toast 通知函数
  const showToast = (message: string, severity: 'success' | 'error') => {
    setSnackbarMessage(message)
    setSnackbarSeverity(severity)
    setSnackbarOpen(true)
  }

  // 文件格式验证
  const validateFile = (file: File): string | null => {
    const fileName = file.name.toLowerCase()
    const isValidFormat = SUPPORTED_FORMATS.some(format => fileName.endsWith(format))
    
    if (!isValidFormat) {
      return `不支持的文件格式。支持的格式：${SUPPORTED_FORMATS.join(', ')}`
    }
    
    if (file.size > MAX_FILE_SIZE) {
      return `文件大小超过限制（最大 ${MAX_FILE_SIZE / 1024 / 1024}MB）`
    }
    
    return null
  }

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

    // 文件格式验证
    const formatError = validateFile(selectedFile)
    if (formatError) {
      setFileFormatError(formatError)
      showToast(formatError, 'error')
      return
    } else {
      setFileFormatError(null)
    }

    setUploading(true);
    setError(null);
    setSuccess(null);
    setUploadProgress(0)

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      // 模拟上传进度
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + 10
        })
      }, 200)

      const response = await fetch('/api/rag/documents/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      clearInterval(progressInterval)
      setUploadProgress(100)

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '文档上传失败');
      }

      const data: DocumentUploadResponse = await response.json();
      showToast('文档上传成功，正在处理中...', 'success')
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
      const errorMessage = err instanceof Error ? err.message : '文档上传失败'
      setError(errorMessage);
      showToast(errorMessage, 'error')
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 1000) // 延迟重置进度条
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
      // 清除之前的错误信息
      setFileFormatError(null)
      setError(null)
      
      // 验证文件格式
      const validationError = validateFile(file)
      if (validationError) {
        setFileFormatError(validationError)
        showToast(validationError, 'error')
        return
      }
      
      setSelectedFile(file)
      showToast(`已选择文件：${file.name}`, 'success')
    }
  };

  // 重试上传函数
  const handleRetry = async () => {
    if (!selectedFile) return
    
    setIsRetrying(true)
    try {
      await handleUpload()
      showToast('重试上传成功', 'success')
    } catch (error) {
      showToast('重试失败，请检查网络连接', 'error')
    } finally {
      setIsRetrying(false)
    }
  }

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
            </Typography>            <Box sx={{ mb: 3 }}>
              <input
                type="file"
                accept=".txt,.pdf,.docx,.md"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
                ref={fileInputRef}
              />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Button
                    variant="contained"
                    startIcon={<UploadIcon />}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
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
                  {error && selectedFile && (
                    <Button
                      variant="outlined"
                      color="warning"
                      startIcon={<RetryIcon />}
                      onClick={handleRetry}
                      disabled={isRetrying}
                      size="small"
                    >
                      {isRetrying ? '重试中...' : '重试'}
                    </Button>
                  )}
                </Box>
                
                {/* 文件格式错误提示 */}
                {fileFormatError && (
                  <Alert severity="error" sx={{ mt: 1 }}>
                    {fileFormatError}
                  </Alert>
                )}
                
                {/* 选中文件信息 */}
                {selectedFile && (
                  <Card variant="outlined" sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <CheckCircleIcon color="success" fontSize="small" />
                      <Typography variant="body2" fontWeight="medium">
                        {selectedFile.name}
                      </Typography>
                      <Chip 
                        size="small" 
                        label={`${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`}
                        color="primary"
                        variant="outlined"
                      />
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      支持格式：{SUPPORTED_FORMATS.join(', ')} (最大 {MAX_FILE_SIZE / 1024 / 1024}MB)
                    </Typography>
                  </Card>
                )}
                
                {/* 上传进度条 */}
                {uploading && uploadProgress > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <Typography variant="body2" sx={{ minWidth: 35 }}>
                        {uploadProgress}%
                      </Typography>
                      <LinearProgress 
                        variant="determinate" 
                        value={uploadProgress} 
                        sx={{ flex: 1, ml: 1 }}
                      />
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      正在上传文件，请稍候...
                    </Typography>
                  </Box>
                )}
              </Box>
              {fileFormatError && (
                <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                  {fileFormatError}
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

      {/* Snackbar 通知 */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Chip
          label={snackbarMessage}
          onDelete={() => setSnackbarOpen(false)}
          deleteIcon={<ErrorIcon />}
          color={snackbarSeverity === 'success' ? 'primary' : 'secondary'}
          variant="outlined"
          sx={{ width: '100%' }}
        />
      </Snackbar>
    </Container>
  );
};

export default KnowledgeBase;