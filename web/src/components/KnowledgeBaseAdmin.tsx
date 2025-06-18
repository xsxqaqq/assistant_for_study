import { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  Box,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import RefreshIcon from '@mui/icons-material/Refresh';
import BuildIcon from '@mui/icons-material/Build';

interface Document {
  id: string;
  filename: string;
  original_filename: string;
  upload_time: string;
  status: string;
  chunk_count: number;
}

const KnowledgeBaseAdmin = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [openClearDialog, setOpenClearDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [repairing, setRepairing] = useState(false);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) {
        setError('请先登录');
        return;
      }

      const response = await fetch('/api/rag/admin/documents', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.status === 403) {
        setError('需要管理员权限');
        return;
      }
      
      if (!response.ok) {
        throw new Error('获取知识库文档列表失败');
      }
      
      const data = await response.json();
      setDocuments(data.documents);
    } catch (error) {
      console.error('获取知识库文档列表错误:', error);
      setError('获取知识库文档列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleClearAll = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/rag/admin/documents/all', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 403) {
        setError('需要管理员权限');
        return;
      }

      if (!response.ok) {
        throw new Error('清空知识库失败');
      }

      setOpenClearDialog(false);
      fetchDocuments();
    } catch (error) {
      console.error('清空知识库错误:', error);
      setError('清空知识库失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDocument = async () => {
    if (!selectedDocument) return;

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) {
        setError('请先登录');
        return;
      }

      const response = await fetch(`/api/rag/admin/documents/${selectedDocument.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 403) {
        setError('需要管理员权限');
        return;
      }

      if (response.status === 404) {
        setError('文档不存在');
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '删除文档失败');
      }

      setOpenDeleteDialog(false);
      setSelectedDocument(null);
      await fetchDocuments();
    } catch (error) {
      console.error('删除文档错误:', error);
      setError(error instanceof Error ? error.message : '删除文档失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRepairVectorDB = async () => {
    if (!window.confirm('确定要修复向量数据库吗？此操作将重新处理所有文档，可能需要一些时间。')) {
      return;
    }

    setRepairing(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/rag/admin/repair_vector_db', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '修复失败');
      }

      const result = await response.json();
      setSuccess(`修复成功！处理了 ${result.documents_processed} 个文档，向量数据库大小: ${result.vector_db_size}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '修复失败');
    } finally {
      setRepairing(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Paper elevation={3} sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5" component="h1">
            知识库管理
          </Typography>
          <Box>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={fetchDocuments}
              sx={{ mr: 2 }}
            >
              刷新
            </Button>
            <Button
              variant="contained"
              color="error"
              startIcon={<DeleteSweepIcon />}
              onClick={() => setOpenClearDialog(true)}
            >
              清空知识库
            </Button>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>文件名</TableCell>
                  <TableCell>上传时间</TableCell>
                  <TableCell>状态</TableCell>
                  <TableCell>分块数量</TableCell>
                  <TableCell>操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell>{doc.filename}</TableCell>
                    <TableCell>{formatDate(doc.upload_time)}</TableCell>
                    <TableCell>{doc.status}</TableCell>
                    <TableCell>{doc.chunk_count}</TableCell>
                    <TableCell>
                      <IconButton
                        color="error"
                        onClick={() => {
                          setSelectedDocument(doc);
                          setOpenDeleteDialog(true);
                        }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* 清空知识库确认对话框 */}
      <Dialog
        open={openClearDialog}
        onClose={() => setOpenClearDialog(false)}
      >
        <DialogTitle>确认清空知识库</DialogTitle>
        <DialogContent>
          <Typography>
            此操作将删除所有知识库文档，且无法恢复。确定要继续吗？
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenClearDialog(false)}>取消</Button>
          <Button onClick={handleClearAll} color="error" variant="contained">
            确认清空
          </Button>
        </DialogActions>
      </Dialog>

      {/* 删除文档确认对话框 */}
      <Dialog
        open={openDeleteDialog}
        onClose={() => setOpenDeleteDialog(false)}
      >
        <DialogTitle>确认删除文档</DialogTitle>
        <DialogContent>
          <Typography>
            确定要删除文档 "{selectedDocument?.filename}" 吗？此操作无法恢复。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeleteDialog(false)}>取消</Button>
          <Button onClick={handleDeleteDocument} color="error" variant="contained">
            确认删除
          </Button>
        </DialogActions>
      </Dialog>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 3 }}>
        <Typography variant="h6" component="h2">
          高级操作
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<BuildIcon />}
            onClick={handleRepairVectorDB}
            disabled={repairing}
            color="warning"
          >
            {repairing ? <CircularProgress size={20} /> : '修复向量数据库'}
          </Button>
        </Box>
      </Box>
    </Container>
  );
};

export default KnowledgeBaseAdmin; 