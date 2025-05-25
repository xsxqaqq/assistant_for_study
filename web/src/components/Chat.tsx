import { useState, useRef, useEffect } from 'react'
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
  InputLabel,
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
  Container,
} from '@mui/material'
import SendIcon from '@mui/icons-material/Send'
import DeleteIcon from '@mui/icons-material/Delete'
import HistoryIcon from '@mui/icons-material/History'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import SummarizeIcon from '@mui/icons-material/Summarize'
import MenuIcon from '@mui/icons-material/Menu'
import CloseIcon from '@mui/icons-material/Close'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  conversationId?: string
}

interface Agent {
  id: string
  name: string
  description: string
  avatar: string
}

const agents: Agent[] = [
  {
    id: 'default',
    name: '默认助教',
    description: '友好、专业的教学助手',
    avatar: '👨‍🏫'
  },
  {
    id: 'strict',
    name: '严格助教',
    description: '严谨、要求严格的导师',
    avatar: '👨‍⚖️'
  },
  {
    id: 'friendly',
    name: '友好助教',
    description: '轻松、幽默的学习伙伴',
    avatar: '😊'
  }
]

const MAX_HISTORY_LENGTH = 10 // 最多显示最近10轮对话

const Chat = () => {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<string>('default')
  const [showHistory, setShowHistory] = useState(false)
  const [historyMessages, setHistoryMessages] = useState<Message[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const currentConversationId = useRef<string>('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [summary, setSummary] = useState<string[]>([])
  const [isSummarizing, setIsSummarizing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading])

  const handleSend = async () => {
    if (!input.trim()) return

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: Date.now(),
      conversationId: currentConversationId.current
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('未登录，请先登录');
      }

      console.log('发送消息:', input);
      const response = await fetch('/api/chat/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          message: input,
          conversation_id: currentConversationId.current || undefined,
          agent_type: selectedAgent
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '聊天请求失败');
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
        timestamp: Date.now(),
        conversationId: currentConversationId.current
      }

      setMessages(prev => [...prev, assistantMessage])
      
      // 更新历史记录
      setHistoryMessages(prev => {
        const newHistory = [...prev, userMessage, assistantMessage];
        if (newHistory.length > MAX_HISTORY_LENGTH * 2) { // 每轮对话包含用户和助手两条消息
          return newHistory.slice(-MAX_HISTORY_LENGTH * 2);
        }
        return newHistory;
      });
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

  const toggleHistory = () => {
    setShowHistory(!showHistory)
  }

  const loadHistoryMessage = (message: Message) => {
    setInput(message.content)
  }

  const currentAgent = agents.find(agent => agent.id === selectedAgent)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && (file.type === 'text/plain' || file.type === 'application/pdf')) {
      setSelectedFile(file)
    } else {
      alert('请上传txt或pdf文件')
    }
  }

  const handleSummarize = async () => {
    if (!selectedFile) return

    setIsSummarizing(true)
    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const token = localStorage.getItem('token')
      const response = await fetch('/api/summary/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })

      if (!response.ok) {
        throw new Error('摘要生成失败')
      }

      const data = await response.json()
      setSummary(data.summary.split('\n').filter(Boolean))
    } catch (error) {
      console.error('摘要生成错误:', error)
      alert('摘要生成失败，请稍后重试')
    } finally {
      setIsSummarizing(false)
    }
  }

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* 顶部导航栏 */}
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setDrawerOpen(!drawerOpen)}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            虚拟助教系统
          </Typography>
          <FormControl size="small" sx={{ minWidth: 200, mr: 2 }}>
            <InputLabel>选择助教角色</InputLabel>
            <Select
              value={selectedAgent}
              label="选择助教角色"
              onChange={(e) => setSelectedAgent(e.target.value)}
              sx={{ bgcolor: 'background.paper' }}
            >
              {agents.map((agent) => (
                <MenuItem key={agent.id} value={agent.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <span>{agent.avatar}</span>
                    <span>{agent.name}</span>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="历史记录">
              <IconButton color="inherit" onClick={toggleHistory}>
                <Badge badgeContent={historyMessages.length / 2} color="error">
                  <HistoryIcon />
                </Badge>
              </IconButton>
            </Tooltip>
            <Tooltip title="清空对话">
              <IconButton color="inherit" onClick={clearChat}>
                <DeleteIcon />
              </IconButton>
            </Tooltip>
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
                        accept=".txt,.pdf"
                        onChange={handleFileSelect}
                        style={{ display: 'none' }}
                        ref={fileInputRef}
                        />
                        <Button
                        variant="outlined"
                        startIcon={<UploadFileIcon />}
                        onClick={() => fileInputRef.current?.click()}
                        fullWidth
                        >
                        {selectedFile ? selectedFile.name : '上传讲义文件'}
                        </Button>
                        {selectedFile && (
                            <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                                已选择: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
                                </Typography>
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
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            {summary.map((point, index) => (
                            <Card key={index} variant="outlined">
                                <CardContent>
                                <Typography variant="body2">
                                    {index + 1}. {point}
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
                    {message.role === 'user' ? '👤' : currentAgent?.avatar}
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
                  >
                    <ListItemText
                      primary={message.content}
                      secondary={new Date(message.timestamp).toLocaleTimeString()}
                      secondaryTypographyProps={{
                        color: message.role === 'user' ? 'rgba(255,255,255,0.7)' : 'text.secondary',
                        fontSize: '0.75rem',
                        mt: 0.5,
                      }}
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
      >
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">历史记录</Typography>
          <IconButton onClick={() => setShowHistory(false)}>
            <CloseIcon />
          </IconButton>
        </Box>
        <Divider />
        <List>
          {historyMessages.map((message, index) => (
            <ListItem
              key={index}
              sx={{
                bgcolor: message.role === 'user' ? 'grey.100' : 'white',
                cursor: 'pointer',
                '&:hover': {
                  bgcolor: 'grey.200',
                },
              }}
              role="button"
              tabIndex={0}
              onKeyPress={(e) => e.key === 'Enter' && loadHistoryMessage(message)}
            >
              <ListItemText
                primary={message.content}
                secondary={new Date(message.timestamp).toLocaleTimeString()}
              />
              {message.role === 'user' && (
                <IconButton size="small">
                  <ArrowUpwardIcon />
                </IconButton>
              )}
            </ListItem>
          ))}
        </List>
      </Drawer>
    </Box>
  )
}

export default Chat 