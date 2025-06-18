import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from './theme';
import Layout from './components/Layout';
import Login from './components/Login';
import Register from './components/Register';
import PrivateRoute from './components/PrivateRoute';
import Chat from './components/Chat';
import RequestPasswordReset from './components/RequestPasswordReset';
import ConfirmResetPassword from './components/ConfirmResetPassword';
import Admin from './components/Admin';
import Profile from './components/Profile';
import AdminRoute from './components/AdminRoute';
import Dashboard from './components/Dashboard';
import KnowledgeBaseAdmin from './components/KnowledgeBaseAdmin';
import './App.css';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/reset-password" element={<RequestPasswordReset />} />
          <Route path="/reset-password/confirm" element={<ConfirmResetPassword />} />
          
          {/* 需要认证的路由 */}
          <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route path="/dashboard" element={
              <AdminRoute>
                <Dashboard />
              </AdminRoute>
            } />
            <Route path="/admin" element={
              <AdminRoute>
                <Admin />
              </AdminRoute>
            } />
            <Route path="/knowledge-base" element={
              <AdminRoute>
                <KnowledgeBaseAdmin />
              </AdminRoute>
            } />
            
            <Route path="/chat" element={<Chat />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
          
          {/* 默认重定向 */}
          <Route path="/" element={<Navigate to="/chat" replace />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
