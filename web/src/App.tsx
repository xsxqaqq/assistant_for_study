import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import Login from './components/Login';
import Register from './components/Register';
import Chat from './components/Chat';
import RequestPasswordReset from './components/RequestPasswordReset';
import ConfirmResetPassword from './components/ConfirmResetPassword';
import Admin from './components/Admin';
import Profile from './components/Profile';
import './App.css';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
  },
});

const App = () => {
  return (
    <ThemeProvider theme={theme}>
      <Router>        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/reset-password" element={<RequestPasswordReset />} />
          <Route path="/reset-password/confirm" element={<ConfirmResetPassword />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/" element={<Navigate to="/login" />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
};

export default App;
