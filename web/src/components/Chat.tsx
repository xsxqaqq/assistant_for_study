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
  Chip,
  Fade,
  Skeleton,
} from '@mui/material'
import {
  Send as SendIcon,
  Menu as MenuIcon,
  Delete as DeleteIcon,
  History as HistoryIcon,
  Add as AddIcon,
  Upload as UploadIcon,
  Pending as PendingIcon,
  Edit as EditIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material'
import SummarizeIcon from '@mui/icons-material/Summarize'
import CloseIcon from '@mui/icons-material/Close'
import type { Message, Document, DocumentUploadResponse } from '../types'

// 消息状态枚举
enum MessageStatus {
  SENDING = 'sending',
  SENT = 'sent', 
  FAILED = 'failed'
}

// 扩展Message类型以包含状态
interface ExtendedMessage extends Message {
  status?: MessageStatus
  id?: string
}

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
  const [messages, setMessages] = useState<ExtendedMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [currentTypingMessage, setCurrentTypingMessage] = useState<string>('')
  const [typingMessageId, setTypingMessageId] = useState<string>('')
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
  
  // 新增：编辑标题相关状态
  const [editingTitle, setEditingTitle] = useState<string>('')
  const [editingConversationId, setEditingConversationId] = useState<string>('')
  const [showEditDialog, setShowEditDialog] = useState(false)
  
  // 新增：文档重命名相关状态
  const [editingDocumentId, setEditingDocumentId] = useState<string>('')
  const [editingDocumentName, setEditingDocumentName] = useState<string>('')
  const [showRenameDialog, setShowRenameDialog] = useState(false)

  // 打字机效果Hook
  const useTypewriter = (text: string, speed: number = 50) => {
    const [displayText, setDisplayText] = useState('')
    const [currentIndex, setCurrentIndex] = useState(0)

    useEffect(() => {
      if (currentIndex < text.length) {
        const timer = setTimeout(() => {
          setDisplayText(prev => prev + text[currentIndex])
          setCurrentIndex(prev => prev + 1)
        }, speed)
        return () => clearTimeout(timer)
      }
    }, [currentIndex, text, speed])

    const resetTypewriter = () => {
      setDisplayText('')
      setCurrentIndex(0)
    }

    return { displayText, isComplete: currentIndex === text.length, resetTypewriter }
  }

  // AI思考组件
  const AIThinkingIndicator = () => (
    <Box sx={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: 1, 
      p: 2,
      backgroundColor: '#f5f5f5',
      borderRadius: 2,
      mb: 1
    }}>
      <CircularProgress size={16} />
      <Typography variant="body2" color="text.secondary">
        AI正在思考...
      </Typography>
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        {[0, 1, 2].map((i) => (
          <Box
            key={i}
            sx={{
              width: 4,
              height: 4,
              borderRadius: '50%',
              backgroundColor: 'primary.main',
              animation: `blink 1.4s infinite ${i * 0.2}s`,
              '@keyframes blink': {
                '0%, 80%, 100%': { opacity: 0 },
                '40%': { opacity: 1 }
              }
            }}
          />
        ))}
    </Box>
    </Box>
  )

  // 消息状态图标组件
  const MessageStatusIcon = ({ status }: { status?: MessageStatus }) => {
    switch (status) {
      case MessageStatus.SENDING:
        return <ScheduleIcon sx={{ fontSize: 14, color: 'warning.main' }} />
      case MessageStatus.SENT:
        return <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main' }} />
      case MessageStatus.FAILED:
        return <ErrorIcon sx={{ fontSize: 14, color: 'error.main' }} />
      default:
        return null
    }
  }

  // 格式化时间戳
  const formatTimestamp = (timestamp: string | number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
    
    return date.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // 格式化文件大小显示
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) {
      return `${bytes} B`
    } else if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`
    } else {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
    }  }

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

    const messageId = Date.now().toString()
    const newMessage: ExtendedMessage = {
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
      status: MessageStatus.SENDING,
      id: messageId
    }

    setMessages(prev => [...prev, newMessage])
    setInput('')
    setIsLoading(true)
    setIsThinking(true)

    try {
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('未登录')
      }

      let response
      if (isRAGMode) {
        // RAG 模式
        response = await fetch('/api/rag/query', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            question: input,
            top_k: 3,
            conversation_id: currentConversationId.current || undefined,
            agent_type: "rag"
          })
        })

        if (!response.ok) {
          throw new Error('查询失败')
        }

        const ragResponse = await response.json()
        
        // 如果是新对话，保存conversation_id
        if (!currentConversationId.current && ragResponse.conversation_id) {
          currentConversationId.current = ragResponse.conversation_id
        }
          // 更新用户消息状态为已发送
        setMessages(prev => prev.map(msg => 
          msg.id === messageId ? { ...msg, status: MessageStatus.SENT } : msg
        ))

        const assistantMessage: ExtendedMessage = {
          role: 'assistant',
          content: ragResponse.answer,
          timestamp: new Date().toISOString(),
          rag_response: ragResponse,
          id: Date.now().toString()
        }
          // 开始打字机效果
        setMessages(prev => [...prev, assistantMessage])
      } else {
        // 普通对话模式
        response = await fetch('/api/chat/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            message: input,
            agent_type: selectedAgent,
            conversation_id: currentConversationId.current || undefined
          })
        })

        if (!response.ok) {
          throw new Error('发送消息失败')
        }

        const data = await response.json()
        console.log('收到回复:', data)
        
        // 如果是新对话，保存conversation_id
        if (!currentConversationId.current && data.conversation_id) {
          currentConversationId.current = data.conversation_id
        }

        // 更新用户消息状态为已发送
        setMessages(prev => prev.map(msg => 
          msg.id === messageId ? { ...msg, status: MessageStatus.SENT } : msg
        ))

        const assistantMessage: ExtendedMessage = {
          role: 'assistant',
          content: data.reply,
          timestamp: new Date().toISOString(),
          id: Date.now().toString()
        }
          // 开始打字机效果
        setMessages(prev => [...prev, assistantMessage])
      }
    } catch (error) {
      console.error('发送消息失败:', error)
      
      // 更新用户消息状态为失败
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, status: MessageStatus.FAILED } : msg
      ))
      
      setError(error instanceof Error ? error.message : '发送消息失败')
    } finally {
      setIsLoading(false)
      setIsThinking(false)
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

  // 新增：编辑标题相关函数
  const handleEditTitle = (conversation: ConversationInfo) => {
    setEditingTitle(conversation.title);
    setEditingConversationId(conversation.id);
    setShowEditDialog(true);
  };

  const handleSaveTitle = async () => {
    if (!editingTitle.trim()) {
      alert('标题不能为空');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      alert('请登录后再试');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/chat/conversations/${editingConversationId}/title`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ title: editingTitle.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '更新标题失败');
      }

      // 更新本地会话列表
      setConversationList(prevList => 
        prevList.map(conv => 
          conv.id === editingConversationId 
            ? { ...conv, title: editingTitle.trim() }
            : conv
        )
      );

      setShowEditDialog(false);
      setEditingTitle('');
      setEditingConversationId('');
    } catch (error) {
      console.error('更新标题错误:', error);
      alert(error instanceof Error ? error.message : '更新标题失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // 检查文件类型
      if (file.type === 'text/plain' || file.type === 'application/pdf' || file.name.endsWith('.docx') || file.name.endsWith('.md')) {
        // 检查文件大小 (限制为10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
          alert('文件大小不能超过10MB，请选择较小的文件')
          return
        }
        setSelectedFile(file)
      } else {
        alert('请上传txt、pdf文件')
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
        },        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        let errorMessage = errorData.detail || `服务器错误 (${response.status})`
        
        // 针对文件类型错误提供更友好的提示
        if (errorMessage.includes('仅支持txt和pdf文件') || errorMessage.includes('文件格式')) {
          errorMessage = '不支持的文件格式！请上传 TXT 或 PDF 文件'
        }
        
        throw new Error(errorMessage)
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
        // 检查是否有重复的文档
        const uniqueDocs = data.documents.reduce((acc: Document[], doc: Document) => {
            if (!acc.find(d => d.id === doc.id)) {
                acc.push(doc);
            }
            return acc;
        }, []);
        setDocuments(uniqueDocs);
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
        
        // 立即获取最新文档列表
        await fetchDocuments();
        
        // 如果文档正在处理中，启动轮询
        if (data.status === 'processing') {
            const pollInterval = setInterval(async () => {
                await fetchDocuments();
                const docs = await fetch('/api/rag/documents', {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                }).then(res => res.json());
                
                const doc = docs.documents.find((d: Document) => d.id === data.document_id);
                if (doc && doc.status === 'processed') {
                    clearInterval(pollInterval);
                    setSuccess('文档处理完成');
                }
            }, 2000); // 每2秒检查一次
            
            // 30秒后停止轮询
            setTimeout(() => clearInterval(pollInterval), 30000);
        }
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

  // 新增：文档重命名相关函数
  const handleRenameDocument = (document: Document) => {
    setEditingDocumentId(document.id);
    setEditingDocumentName(document.custom_filename || document.original_filename);
    setShowRenameDialog(true);
  };

  const handleSaveDocumentName = async () => {
    if (!editingDocumentName.trim()) {
      alert('文件名不能为空');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      alert('请登录后再试');
      return;
    }

    setIsLoading(true);
    try {
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

      // 更新本地文档列表
      setDocuments(prevList => 
        prevList.map(doc => 
          doc.id === editingDocumentId 
            ? { ...doc, custom_filename: editingDocumentName.trim() }
            : doc
        )
      );

      setShowRenameDialog(false);
      setEditingDocumentId('');
      setEditingDocumentName('');
      setSuccess('文档重命名成功');
    } catch (error) {
      console.error('重命名文档错误:', error);
      setError(error instanceof Error ? error.message : '重命名失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };  const renderMessage = (message: ExtendedMessage) => {
    const isUser = message.role === 'user'
    const ragResponse = message.rag_response
    const hasRelevantChunks = ragResponse?.relevant_chunks && ragResponse.relevant_chunks.length > 0
    const isGenericResponse = message.content.toLowerCase().includes('你好') || 
      message.content.toLowerCase().includes('hello') ||
      message.content.toLowerCase().includes('hi') ||
      message.content.toLowerCase().includes('有什么可以帮助你') ||
      message.content.toLowerCase().includes('有什么我可以帮助你的')

    return (
      <Box
        key={message.id || message.timestamp}
        sx={{
          display: 'flex',
          justifyContent: isUser ? 'flex-end' : 'flex-start',
          mb: 2,
        }}
      >
        <Box
          sx={{
            maxWidth: '70%',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              mb: 1,
              justifyContent: isUser ? 'flex-end' : 'flex-start',
            }}
          >
            {!isUser && (
              <Avatar
                sx={{
                  bgcolor: 'secondary.main',
                  width: 32,
                  height: 32,
                  mr: 1,
                }}
              >
                A
              </Avatar>
            )}            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
              <Typography variant="subtitle2" color="text.secondary">
                {isUser ? '你' : '助手'}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                {formatTimestamp(message.timestamp)}
              </Typography>
            </Box>
            {isUser && (
              <>
                <MessageStatusIcon status={message.status} />
                <Avatar
                  sx={{
                    bgcolor: 'primary.main',
                    width: 32,
                    height: 32,
                    ml: 1,
                  }}
                >
                  U
                </Avatar>
              </>
            )}
          </Box>
          
          <Paper
            elevation={1}
            sx={{
              p: 2,
              bgcolor: isUser ? 'primary.light' : 'background.paper',
              color: isUser ? 'primary.contrastText' : 'text.primary',
              borderRadius: 2,
              textAlign: 'left',
              position: 'relative',
            }}
          >
            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', textAlign: 'left' }}>
              {message.content}
            </Typography>
            
            {/* 只在有相关文档块且不是通用回复时显示引用来源 */}
            {hasRelevantChunks && ragResponse && !isGenericResponse && (
              <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  引用来源：
                </Typography>
                <List dense>
                  {ragResponse.relevant_chunks.map((chunk, index) => (
                    <ListItem key={index} sx={{ py: 0.5 }}>
                      <ListItemText
                        primary={
                          <Typography variant="body2" color="text.secondary">
                            {chunk}
                          </Typography>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </Paper>
        </Box>
      </Box>
    )
  }

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
                      </Box>                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <input
                          type="file"
                          accept=".txt,.pdf"
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
                          </Button>
                          <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                              支持文件格式：TXT、PDF
                          </Typography>{selectedFile && (
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

        {/* 主聊天区域 - 占据剩余空间 */}        <Box
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
            p: 0,
          }}
        >          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              flexGrow: 1,
              width: '100%',
              height: '100%',
              bgcolor: 'background.paper',
              overflow: 'hidden',
              p: { xs: 1, sm: 1.5, md: 2 },
            }}
          ><List
              sx={{
                flex: 1,
                overflowY: 'auto',
                p: {xs:1, sm:2},
                display: 'flex',
                flexDirection: 'column',
                gap: {xs:0.5, sm:1},
              }}
            >
              {messages.map((message) => renderMessage(message))}
              {isThinking && (
                <AIThinkingIndicator />
              )}
              {isLoading && !isThinking && (
                <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
                  <CircularProgress size={24} />
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
            {conversationList.map((conversation) => (
              <ListItem
                key={conversation.id}
                disablePadding
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  '&:hover': {
                    bgcolor: 'action.hover',
                  },
                }}
              >
                <Box 
                  onClick={() => handleLoadConversation(conversation.id)} 
                  sx={{ 
                    flexGrow: 1, 
                    cursor: 'pointer', 
                    p: 2,
                    minWidth: 0,
                  }}
                >
                  <ListItemText 
                    primary={conversation.title} 
                    secondary={conversation.created_at ? new Date(conversation.created_at).toLocaleDateString() : "点击加载此会话"} 
                    primaryTypographyProps={{ noWrap: true }}
                    secondaryTypographyProps={{ noWrap: true }}
                  />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Tooltip title="编辑标题">
                    <IconButton 
                      edge="end" 
                      aria-label="edit title"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditTitle(conversation);
                      }}
                      size="small"
                      sx={{ mr: 0.5 }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="删除此会话">
                    <IconButton 
                      edge="end" 
                      aria-label="delete conversation"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteConversation(conversation.id);
                      }}
                      size="small"
                      sx={{ mr: 1.5 }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
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
                accept=".txt,.pdf,.docx,.md"
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
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <IconButton
                        edge="end"
                        onClick={() => handleRenameDocument(doc)}
                        disabled={doc.status === 'processing'}
                        size="small"
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        edge="end"
                        onClick={() => handleDelete(doc.id)}
                        disabled={doc.status === 'processing'}
                        size="small"
                      >
                        {doc.status === 'processing' ? <PendingIcon /> : <DeleteIcon />}
                      </IconButton>
                    </Box>
                  }
                >
                  <ListItemText
                    primary={
                      <Box>
                        <Typography variant="body1" component="span">
                          {doc.custom_filename || doc.original_filename}
                        </Typography>
                        {doc.custom_filename && doc.custom_filename !== doc.original_filename && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            原名: {doc.original_filename}
                          </Typography>
                        )}
                      </Box>
                    }
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

        {/* 编辑标题对话框 */}
        <Dialog
          open={showEditDialog}
          onClose={() => setShowEditDialog(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>编辑会话标题</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="会话标题"
              type="text"
              fullWidth
              variant="outlined"
              value={editingTitle}
              onChange={(e) => setEditingTitle(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSaveTitle();
                }
              }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowEditDialog(false)}>取消</Button>
            <Button 
              onClick={handleSaveTitle} 
              variant="contained"
              disabled={isLoading || !editingTitle.trim()}
            >
              {isLoading ? <CircularProgress size={20} /> : '保存'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* 文档重命名对话框 */}
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
              disabled={isLoading || !editingDocumentName.trim()}
            >
              {isLoading ? <CircularProgress size={20} /> : '保存'}
            </Button>
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