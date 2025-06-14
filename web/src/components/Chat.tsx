import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Box, 
  TextField, 
  Button, 
  Paper, 
  Typography,
  List,
  ListItem,
  ListItemText,
  Select,
  MenuItem,
  FormControl,
  IconButton,
  Divider,
  Avatar,
  Tooltip,
  Badge,
  Card,
  CardContent,
  CircularProgress,
  AppBar,
  Toolbar,
  Drawer,
  useTheme,
  useMediaQuery,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Switch,
} from '@mui/material'
import {
  Send as SendIcon,
  Menu as MenuIcon,
  Delete as DeleteIcon,
  History as HistoryIcon,
  Add as AddIcon,
  Upload as UploadIcon,
  Pending as PendingIcon,
} from '@mui/icons-material'
import SummarizeIcon from '@mui/icons-material/Summarize'
import CloseIcon from '@mui/icons-material/Close'
import type { Message, Document, DocumentUploadResponse, RAGQueryResponse } from '../types'

interface Agent {
  id: string
  name: string
  description: string
}

interface BackendChatMessage {
  role: string
  message: string
  agent_type?: string
  timestamp?: number
  created_at?: string
}

interface ConversationInfo {
  id: string
  title: string
  created_at?: string
}

const Chat = () => {
  const navigate = useNavigate()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [dynamicAgents, setDynamicAgents] = useState<Agent[]>([])
  const [selectedAgent, setSelectedAgent] = useState<string>('default')
  const [showHistory, setShowHistory] = useState(false)
  const [conversationList, setConversationList] = useState<ConversationInfo[]>([])
  const [currentUser, setCurrentUser] = useState<{ username: string; email: string } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const currentConversationId = useRef<string>('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [isRAGMode, setIsRAGMode] = useState(false)
  const [showKnowledgeBase, setShowKnowledgeBase] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [summary, setSummary] = useState<string[]>([])
  const [isSummarizing, setIsSummarizing] = useState(false)

  // 格式化文件大小显示
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) {
      return `${bytes} B`
    } else if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`
    } else {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
    }
  }

  useEffect(() => {
    const fetchAgentsAndConversations = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        // Optionally, redirect to login or show an error
        console.error("No token found, user might not be logged in.");
        // Fallback for agents if not logged in, or if API fails
        setDynamicAgents([{ id: 'default', name: '默认助手', description: '请先登录以获取完整功能' }]);
        setSelectedAgent('default');
        return;
      }

      setIsLoading(true);
      try {
        // Fetch Agents
        const agentsResponse = await fetch('/api/chat/agents', {
           headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!agentsResponse.ok) {
          throw new Error(`HTTP error! status: ${agentsResponse.status} for agents`);
        }
        const agentsData = await agentsResponse.json();
        if (agentsData && Array.isArray(agentsData.agents)) {
          setDynamicAgents(agentsData.agents);
          if (agentsData.agents.length > 0) {
            const defaultAgentInList = agentsData.agents.find((agent: Agent) => agent.id === 'default');
            if (defaultAgentInList) {
              setSelectedAgent('default');
            } else {
              setSelectedAgent(agentsData.agents[0].id);
            }
          } else {
            setDynamicAgents([{ id: 'default', name: '默认助手', description: '无可用助教' }]);
            setSelectedAgent('default');
          }
        } else {
          console.error("Fetched agents data is not in expected format:", agentsData);
          setDynamicAgents([{ id: 'default', name: '默认助手', description: '数据格式错误' }]);
          setSelectedAgent('default');
        }        // Fetch Conversations
        const convResponse = await fetch('/api/chat/conversations/', {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
        });
        if (!convResponse.ok) {
          throw new Error(`HTTP error! status: ${convResponse.status} for conversations`);
        }
        const convData = await convResponse.json();
        setConversationList(convData.conversations || []);

        // Fetch Current User Info
        const userResponse = await fetch('/api/auth/user', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (userResponse.ok) {
          const userData = await userResponse.json();
          setCurrentUser(userData);
        }

      } catch (error) {
        console.error("Failed to fetch initial data:", error);        // Provide fallback for agents if not already set due to auth error
        setDynamicAgents([{ id: 'default', name: '默认助手', description: '加载助教列表失败' }]);
        setSelectedAgent('default');        // Optionally set conversationList to empty or show error
        setConversationList([]);
        alert(error instanceof Error ? error.message : '加载初始数据失败');
      } finally {
        setIsLoading(false);
      }
    };    fetchAgentsAndConversations();
  }, []);  // Empty dependency array - only run once on mount

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading])

  const handleSend = async () => {
    if (!input.trim()) return

    const newMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
    }

    setMessages(prev => [...prev, newMessage])
    setInput('')
    setIsLoading(true)

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('未登录，请先登录');
      }

      console.log('发送消息:', input);
      let response;
      if (isRAGMode) {
        // RAG模式：使用知识库查询
        response = await fetch('/api/rag/query', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            question: input,
            top_k: 3,
          }),
        });

        if (!response.ok) {
          throw new Error('查询失败');
        }

        const data: RAGQueryResponse = await response.json();
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.answer,
          timestamp: new Date().toISOString(),
          relevant_chunks: data.relevant_chunks,
        }]);
      } else {
        // 普通模式：直接对话
        response = await fetch('/api/chat/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            message: input,
            agent_type: selectedAgent,
            conversation_id: currentConversationId.current || undefined
          }),
        });

        if (!response.ok) {
          throw new Error('发送消息失败');
        }

        const data = await response.json();
        console.log('收到回复:', data);
        
        // 如果是新对话，保存conversation_id
        if (!currentConversationId.current && data.conversation_id) {
          currentConversationId.current = data.conversation_id;
        }

        const assistantMessage: Message = {
          role: 'assistant',
          content: data.reply,
          timestamp: new Date().toISOString(),
        }

        setMessages(prev => [...prev, assistantMessage])
      }
    } catch (error) {
      console.error('发送消息错误:', error);
      alert(error instanceof Error ? error.message : '发送消息失败，请稍后重试');
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }
  const clearChat = () => {
    setMessages([])
    currentConversationId.current = ''
  }

  const createNewConversation = () => {
    setMessages([])
    currentConversationId.current = ''
    setShowHistory(false) // 关闭历史记录抽屉
  }

  const toggleHistory = () => {
    setShowHistory(!showHistory)
  }

  const handleLoadConversation = async (conversationId: string) => {
    const token = localStorage.getItem('token');
    if (!token) {
      alert('请登录后再试');
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch(`/api/chat/history/${conversationId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '加载聊天记录失败');
      }
      const data = await response.json(); // Expected: { history: BackendChatMessage[], conversation_id: string }
        // Backend ChatMessage: { role: string, message: string, agent_type?: string }
      // Frontend Message: { role: 'user' | 'assistant', content: string, timestamp: number, conversationId?: string }
      const loadedMessages: Message[] = data.history.map((msg: BackendChatMessage, index: number) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.message,
        // Backend's ChatHistory model has created_at, if schema.ChatMessage includes it, use msg.created_at
        // For now, using placeholder if actual timestamp isn't in msg object
        timestamp: msg.timestamp || (Date.now() - (data.history.length - index) * 10000), // Placeholder, prefer real timestamp
      }));

      setMessages(loadedMessages);
      currentConversationId.current = data.conversation_id;
      setShowHistory(false); // Close history drawer
    } catch (error) {
      console.error('加载会话错误:', error);
      alert(error instanceof Error ? error.message : '加载会话失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteConversation = async (conversationId: string) => {
    const token = localStorage.getItem('token');
    if (!token) {
      alert('请登录后再试');
      return;
    }

    // 找到要删除的对话信息以显示更友好的确认对话框
    const conversationToDelete = conversationList.find(conv => conv.id === conversationId);
    const displayTitle = conversationToDelete ? conversationToDelete.title : `会话 #${conversationId.substring(0, 8)}...`;
    
    if (window.confirm(`确定要删除对话 "${displayTitle}" 吗？此操作不可撤销。`)) {
      setIsLoading(true); 
      try {
        const response = await fetch(`/api/chat/conversations/${conversationId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          let errorDetail = '删除会话失败';
          try {
            const errorData = await response.json();
            errorDetail = errorData.detail || errorDetail;
          } catch {
            // Ignore if response is not JSON or empty
          }
          throw new Error(errorDetail);
        }

        setConversationList(prevList => prevList.filter(conv => conv.id !== conversationId));
        if (currentConversationId.current === conversationId) {
          clearChat(); 
        }
        // alert('会话已成功删除。'); // It's better to not show an alert if the UI updates clearly
      } catch (error) {
        console.error('删除会话错误:', error);
        alert(error instanceof Error ? error.message : '删除会话失败，请稍后重试');
      } finally {
        setIsLoading(false);
      }
    }
  };
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // 检查文件类型
      if (file.type === 'text/plain' || file.type === 'application/pdf' || file.name.endsWith('.md')) {
        // 检查文件大小 (限制为10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
          alert('文件大小不能超过10MB，请选择较小的文件')
          return
        }
        setSelectedFile(file)
      } else {
        alert('请上传txt、pdf或md文件')
      }
    }
  }
  const handleSummarize = async () => {
    if (!selectedFile) return

    setIsSummarizing(true)
    setSummary([]) // 清空之前的摘要
    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('请先登录后再试')
      }

      const response = await fetch('/api/summary/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `服务器错误 (${response.status})`)
      }

      const data = await response.json()
      if (data.summary) {
        setSummary(data.summary.split('\n').filter((line: string) => line.trim() !== ''))
      } else {
        throw new Error('服务器返回的摘要数据格式错误')
      }
    } catch (error) {
      console.error('摘要生成错误:', error)
      alert(error instanceof Error ? error.message : '摘要生成失败，请稍后重试')
    } finally {
      setIsSummarizing(false)
    }
  }

  // 获取文档列表
  const fetchDocuments = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('请先登录');
      return;
    }

    try {
      const response = await fetch('/api/rag/documents', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('获取文档列表失败');
      }

      const data = await response.json();
      setDocuments(data.documents);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取文档列表失败');
    }
  };

  // 上传文档
  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsLoading(true);
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
      setSuccess(data.message || '文档上传成功');
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      fetchDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : '文档上传失败');
    } finally {
      setIsLoading(false);
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
      fetchDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除文档失败');
    }
  };

  // 初始化加载
  useEffect(() => {
    fetchDocuments();
  }, []);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
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
      <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
        {/* 顶部导航栏 */}
        <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
          <Toolbar>
            {/* Left Section: Contains hamburger on xs, provides space on sm+ */}
            <Box sx={{ flex: 1, display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
              <IconButton
                color="inherit"
                edge="start"
                onClick={() => setDrawerOpen(!drawerOpen)}
                sx={{ 
                  display: { xs: 'inline-flex', sm: 'none' } // Original: mr: 2, display: { sm: 'none' }
                }}
              >
                <MenuIcon />
              </IconButton>
            </Box>

            {/* Center Section: Title */}
            <Typography 
              variant="h6" 
              noWrap 
              component="div" 
              sx={{ textAlign: 'center' }} // Ensures text is centered if Typography has width
            >
              虚拟助教系统
            </Typography>

            {/* Right Section: Controls */}
            <Box sx={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
              <FormControl 
                size="small" 
                sx={{ 
                  minWidth: { xs: 150, sm: 180 }, // Adjusted from original 200, responsive
                  mr: { xs: 1, sm: 2 }, // Original mr: 2
                  // display: { xs: 'none', sm: 'flex' } // Kept visible on sm+ as per original implicit behavior
                }}
              >
                <Select
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value)}
                  displayEmpty
                  sx={{ // Original sx for Select
                    bgcolor: 'background.paper',
                    '& .MuiSelect-select': {
                      py: 1
                    }
                  }}
                >
                  {dynamicAgents.length === 0 ? (
                    <MenuItem value="default" disabled>
                      <em>默认助手 (加载中...)</em>
                    </MenuItem>
                  ) : (
                    dynamicAgents.map((agent) => (
                      <MenuItem key={agent.id} value={agent.id}>
                        {agent.name}
                      </MenuItem>
                    ))
                  )}
                </Select>
              </FormControl>
              
              <Box sx={{ display: 'flex', gap: { xs: 0.5, sm: 1 } }}> {/* Original gap: 1 */}
                <Tooltip title="新对话">
                  <IconButton color="inherit" onClick={createNewConversation}>
                    <AddIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="历史记录">
                  <IconButton color="inherit" onClick={toggleHistory}>
                    <Badge badgeContent={conversationList.length} color="error">
                      <HistoryIcon />
                    </Badge>
                  </IconButton>
                </Tooltip>
                <Tooltip title="清空当前对话">
                  <IconButton color="inherit" onClick={clearChat}>
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
                {currentUser && (
                  <Tooltip title="个人资料">
                    <IconButton 
                      color="inherit" 
                      onClick={() => navigate('/profile')}
                      sx={{ p: 0.5 }}
                    >
                      <Avatar 
                        sx={{ 
                          width: 32, 
                          height: 32, 
                          bgcolor: 'secondary.main',
                          fontSize: '0.875rem'
                        }}
                      >
                        {currentUser.username.charAt(0).toUpperCase()}
                      </Avatar>
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            </Box>
          </Toolbar>
        </AppBar>

        {/* 侧边栏 */}
        <Drawer
          variant={isMobile ? 'temporary' : 'permanent'}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          sx={{
            width: drawerOpen ? 300 : 60, // Collapse to 60px when closed
            flexShrink: 0,
            transition: 'width 0.3s ease', // Smooth transition
            '& .MuiDrawer-paper': {
              width: drawerOpen ? 300 : 60,
              boxSizing: 'border-box',
              mt: '64px',
              height: 'calc(100% - 64px)',
              overflowX: 'hidden',
            },
          }}
        >
          <Box sx={{ p: 2, overflowY: 'auto', height: '100%' }}>
              {drawerOpen ? (
                  <>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                          <Typography variant="h6" gutterBottom>
                              文件处理
                          </Typography>
                          {!isMobile && (
                              <IconButton onClick={() => setDrawerOpen(!drawerOpen)}>
                                  {drawerOpen ? <CloseIcon /> : <MenuIcon />}
                              </IconButton>
                          )}
                      </Box>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <input
                          type="file"
                          accept=".txt,.pdf,.md"
                          onChange={handleFileSelect}
                          style={{ display: 'none' }}
                          ref={fileInputRef}
                          />
                          <Button
                          variant="outlined"
                          startIcon={<UploadIcon />}
                          onClick={() => fileInputRef.current?.click()}
                          fullWidth
                          >
                          {selectedFile ? selectedFile.name : '上传讲义文件'}
                          </Button>                          {selectedFile && (
                              <>
                                  <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                                      已选择: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                                  </Typography>
                                  <Button
                                      variant="outlined"
                                      size="small"
                                      onClick={() => {
                                          setSelectedFile(null)
                                          setSummary([])
                                          if (fileInputRef.current) {
                                              fileInputRef.current.value = ''
                                          }
                                      }}
                                      sx={{ mt: 1 }}
                                  >
                                      清除文件
                                  </Button>
                              </>
                          )}
                          <Button
                          variant="contained"
                          startIcon={<SummarizeIcon />}
                          onClick={handleSummarize}
                          disabled={!selectedFile || isSummarizing}
                          fullWidth
                          >
                          {isSummarizing ? <CircularProgress size={24} /> : '生成摘要'}
                          </Button>
                      </Box>
                      {summary.length > 0 && (
                          <Box sx={{ mt: 3 }}>
                          <Typography variant="h6" gutterBottom>
                              摘要要点
                          </Typography>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>                              {summary.map((point, index) => (
                              <Card key={index} variant="outlined">
                                  <CardContent>
                                  <Typography variant="body2">
                                      {point.replace(/^\d+\.\s*/, `${index + 1}. `)}
                                  </Typography>
                                  </CardContent>
                              </Card>
                              ))}
                          </Box>
                          </Box>
                      )}
                  </>
              ) : (
                  <IconButton
                      onClick={() => setDrawerOpen(true)}
                      sx={{ mt: 1 }}
                      aria-label="打开侧边栏"
                  >
                      <MenuIcon />
                  </IconButton>
              )}
          </Box>
        </Drawer>

        {/* 主聊天区域 - 占据剩余空间 */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            mt: '64px',
            height: 'calc(100vh - 64px)',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: 'background.default',
            boxSizing: 'border-box',
            overflowY: 'auto',
            p: { xs: 1, sm: 2, md: 3 },
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              flexGrow: 1,
              width: '100%',
              maxWidth: {xs: '100%', md: '90vw' , lg: '95vw'},
              // mx: 'auto',
              bgcolor: 'background.paper',
              borderRadius: 2,
              boxShadow: 2,
              overflow: 'hidden',
              p:{xs:1, sm:2, md:3},
            }}
          >
            <List
              sx={{
                flex: 1,
                overflowY: 'auto',
                p: {xs:1, sm:2},
                display: 'flex',
                flexDirection: 'column',
                gap: {xs:0.5, sm:1},
              }}
            >
              {messages.map((message, index) => (
                <ListItem
                  key={index}
                  sx={{
                    justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                    px: 0,
                    py: 0.5,
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: message.role === 'user' ? 'row-reverse' : 'row',
                      alignItems: 'flex-start',
                      gap: 1.5,
                      maxWidth: 'min(90%, 800px)',
                      width: 'fit-content',
                    }}
                  >
                    <Avatar
                      sx={{
                        bgcolor: message.role === 'user' ? 'primary.main' : 'secondary.main',
                        width: 32,
                        height: 32,
                        fontSize: '0.875rem',
                      }}
                    >
                      {message.role === 'user' ? '👤' : '🤖'} {/* Fixed assistant avatar */}
                    </Avatar>
                    <Paper
                      elevation={0}
                      sx={{
                        p: {xs:1, sm:1.5},
                        bgcolor: message.role === 'user' ? 'primary.main' : 'grey.200',
                        color: message.role === 'user' ? 'primary.contrastText' : 'text.primary',
                        borderRadius: 2,
                        maxWidth: '100%',
                        wordBreak: 'break-word',
                        lineHeight: 1.5,
                        boxShadow: message.role === 'user' ? theme.shadows[1] : theme.shadows[0],
                      }}
                    >                      <ListItemText
                        primary={message.content}
                      />
                    </Paper>
                  </Box>
                </ListItem>
              ))}
              {/* {isLoading && (
                <ListItem sx={{ justifyContent: 'flex-start', px: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pl: 1 }}>
                    <Avatar sx={{ bgcolor: 'secondary.main', width: 32, height: 32 }}>
                      {currentAgent?.avatar}
                    </Avatar>
                    <CircularProgress size={24} />
                  </Box>
                </ListItem> */}
              {isLoading && (
                  <Box sx={{display: 'flex', justifyContent: 'center', p: 2}}>
                      <CircularProgress />
                  </Box>
              )}
              <div ref={messagesEndRef} />
            </List>

            <Box
              sx={{
                display: 'flex',
                gap: 1,
                borderTop: '1px solid rgba(0, 0, 0, 0.12)',
                p: 2,
                bgcolor: 'background.paper',
              }}
            >
              <TextField
                fullWidth
                multiline
                maxRows={6}
                minRows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isLoading}
                variant="outlined"
                placeholder="输入您的问题..."
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    pr: '8px',
                    alignItems: 'flex-start',
                  },
                }}
              />
              <IconButton
                onClick={handleSend}
                color="primary"
                disabled={isLoading || !input.trim()}
                sx={{
                  borderRadius: '50%',
                  width: 56,
                  height: 56,
                }}
                aria-label="发送消息"
              >
                <SendIcon />
              </IconButton>
            </Box>
          </Box>
        </Box>

        {/* 历史记录抽屉 */}
        <Drawer
          anchor="right"
          open={showHistory}
          onClose={() => setShowHistory(false)}
          sx={{
            '& .MuiDrawer-paper': {
              width: {xs: '80vw', sm: 400},
              mt: '64px',
              height: 'calc(100% - 64px)',
            },
          }}
        >          <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">历史记录</Typography>
            <IconButton onClick={() => setShowHistory(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
          <Divider />
          {/* 新对话按钮 */}
          <Box sx={{ p: 2 }}>
            <Button
              variant="contained"
              fullWidth
              startIcon={<AddIcon />}
              onClick={createNewConversation}
              sx={{ mb: 1 }}
            >
              创建新对话
            </Button>
          </Box>
          <Divider />
          <List>
            {isLoading && conversationList.length === 0 && (
              <ListItem>
                <CircularProgress size={24} sx={{mx: 'auto'}} />
              </ListItem>
            )}          {!isLoading && conversationList.length === 0 && (
              <ListItem>
                <ListItemText primary="没有历史会话记录。" />
              </ListItem>
            )}
            {conversationList.map((conversation) => (            <ListItem
                key={conversation.id}
                disablePadding // Remove default padding to make custom layout easier
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  '&:hover': {
                    bgcolor: 'action.hover',
                  },
                  // pr: 1, // Padding right for the icon button container
                }}
              >
                <Box 
                  onClick={() => handleLoadConversation(conversation.id)} 
                  sx={{ 
                    flexGrow: 1, 
                    cursor: 'pointer', 
                    p: 2, // Standard padding for list item text area
                    minWidth: 0, // Allow text to shrink and truncate
                  }}
                >                <ListItemText 
                    primary={conversation.title} 
                    secondary={conversation.created_at ? new Date(conversation.created_at).toLocaleDateString() : "点击加载此会话"} 
                    primaryTypographyProps={{ noWrap: true }} // Prevent primary text from wrapping
                    secondaryTypographyProps={{ noWrap: true }}
                  />
                </Box>
                <Tooltip title="删除此会话">
                  <IconButton 
                    edge="end" 
                    aria-label="delete conversation"
                    onClick={() => handleDeleteConversation(conversation.id)}
                    size="small"
                    sx={{ mr: 1.5 }} // Margin for spacing
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </ListItem>
            ))}
          </List>
        </Drawer>

        {/* 知识库管理对话框 */}
        <Dialog
          open={showKnowledgeBase}
          onClose={() => setShowKnowledgeBase(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>知识库管理</DialogTitle>
          <DialogContent>
            <Box sx={{ mb: 3 }}>
              <input
                type="file"
                accept=".txt,.pdf,.md"
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
                  onClick={handleUpload}
                  disabled={isLoading}
                >
                  {isLoading ? <CircularProgress size={24} /> : '上传'}
                </Button>
              )}
              {selectedFile && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  已选择: {selectedFile.name}
                </Typography>
              )}
            </Box>
            <List>
              {documents.map((doc) => (
                <ListItem
                  key={doc.id}
                  secondaryAction={
                    <IconButton
                      edge="end"
                      onClick={() => handleDelete(doc.id)}
                      disabled={doc.status === 'processing'}
                    >
                      {doc.status === 'processing' ? <PendingIcon /> : <DeleteIcon />}
                    </IconButton>
                  }
                >
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
                </ListItem>
              ))}
            </List>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowKnowledgeBase(false)}>关闭</Button>
          </DialogActions>
        </Dialog>

        {/* 底部工具栏 */}
        <Box sx={{ 
          position: 'fixed', 
          bottom: 0, 
          left: 0, 
          right: 0, 
          bgcolor: 'background.paper',
          borderTop: '1px solid rgba(0, 0, 0, 0.12)',
          p: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 2,
          zIndex: 1000
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              知识库
            </Typography>
            <Switch
              checked={isRAGMode}
              onChange={(e) => setIsRAGMode(e.target.checked)}
              color="primary"
            />
          </Box>
          {isRAGMode && (
            <Button
              variant="outlined"
              size="small"
              onClick={() => setShowKnowledgeBase(true)}
              startIcon={<UploadIcon />}
            >
              管理知识库
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  )
}

export default Chat