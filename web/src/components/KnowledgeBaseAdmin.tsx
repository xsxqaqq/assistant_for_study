import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Alert,
  Chip,
  Tooltip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import BuildIcon from '@mui/icons-material/Build';
import type { AdminDocument } from '../types';

const KnowledgeBaseAdmin = () => {
  const [documents, setDocuments] = useState<AdminDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // 重命名相关状态
  const [editingDocumentId, setEditingDocumentId] = useState<string>('');
  const [editingDocumentName, setEditingDocumentName] = useState<string>('');
  const [showRenameDialog, setShowRenameDialog] = useState(false);

  const [repairing, setRepairing] = useState(false);

  const fetchDocuments = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('请先登录');
      }

      const response = await fetch('/api/rag/admin/documents', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('获取文档列表失败');
      }

      const data = await response.json();
      setDocuments(data.documents || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取文档列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleDeleteDocument = async (documentId: string) => {
    if (!window.confirm('确定要删除这个文档吗？此操作不可撤销。')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('请先登录');
      }

      const response = await fetch(`/api/rag/admin/documents/${documentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('删除文档失败');
      }

      setSuccess('文档删除成功');
      fetchDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除文档失败');
    }
  };

  const handleRenameDocument = (document: AdminDocument) => {
    setEditingDocumentId(document.id);
    setEditingDocumentName(document.custom_filename || document.original_filename);
    setShowRenameDialog(true);
  };

  const handleSaveDocumentName = async () => {
    if (!editingDocumentName.trim()) {
      setError('文件名不能为空');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('请先登录');
      }

      const response = await fetch(`/api/rag/documents/${editingDocumentId}/rename`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ custom_filename: editingDocumentName.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '重命名失败');
      }

      setSuccess('文档重命名成功');
      setShowRenameDialog(false);
      setEditingDocumentId('');
      setEditingDocumentName('');
      fetchDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : '重命名失败');
    }
  };

  const handleRepairVectorDB = async () => {
    setRepairing(true);
    setError(null);
    setSuccess(null);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('请先登录');
      }
      const response = await fetch('/api/rag/admin/repair_vector_db', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || '修复向量数据库失败');
      }
      setSuccess('向量数据库修复成功');
      fetchDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : '修复向量数据库失败');
    } finally {
      setRepairing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processed':
        return 'success';
      case 'processing':
        return 'warning';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'processed':
        return '已处理';
      case 'processing':
        return '处理中';
      case 'failed':
        return '处理失败';
      default:
        return status;
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h1">
          知识库管理
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchDocuments}
            disabled={loading || repairing}
          >
            刷新
          </Button>
          <Button
            variant="contained"
            color="secondary"
            startIcon={<BuildIcon />}
            onClick={handleRepairVectorDB}
            disabled={repairing || loading}
          >
            {repairing ? '修复中...' : '修复向量数据库映射'}
          </Button>
        </Box>
      </Box>

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

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>文档名称</TableCell>
              <TableCell>原始文件名</TableCell>
              <TableCell>用户</TableCell>
              <TableCell>状态</TableCell>
              <TableCell>文本块数</TableCell>
              <TableCell>上传时间</TableCell>
              <TableCell>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            ) : documents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  暂无文档
                </TableCell>
              </TableRow>
            ) : (
              documents.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell>
                    <Box>
                      <Typography variant="body2" fontWeight="medium">
                        {doc.custom_filename || doc.original_filename}
                      </Typography>
                      {doc.custom_filename && doc.custom_filename !== doc.original_filename && (
                        <Typography variant="caption" color="text.secondary">
                          自定义名称
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {doc.original_filename}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="body2" fontWeight="medium">
                        {doc.username}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {doc.email}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getStatusText(doc.status)}
                      color={getStatusColor(doc.status) as any}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {doc.chunk_count > 0 ? doc.chunk_count : '-'}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {new Date(doc.upload_time).toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Tooltip title="重命名">
                        <IconButton
                          size="small"
                          onClick={() => handleRenameDocument(doc)}
                          disabled={doc.status === 'processing'}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="删除">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteDocument(doc.id)}
                          disabled={doc.status === 'processing'}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* 重命名对话框 */}
      <Dialog
        open={showRenameDialog}
        onClose={() => setShowRenameDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>重命名文档</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="文档名称"
            type="text"
            fullWidth
            variant="outlined"
            value={editingDocumentName}
            onChange={(e) => setEditingDocumentName(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSaveDocumentName();
              }
            }}
            helperText="请输入新的文档名称（不超过100个字符）"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowRenameDialog(false)}>取消</Button>
          <Button 
            onClick={handleSaveDocumentName} 
            variant="contained"
            disabled={!editingDocumentName.trim()}
          >
            保存
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default KnowledgeBaseAdmin; 