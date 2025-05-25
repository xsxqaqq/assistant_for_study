import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { CircularProgress, Container } from '@mui/material';

interface AdminRouteProps {
  children: React.ReactNode;
}

const AdminRoute = ({ children }: AdminRouteProps) => {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setIsAdmin(false);
          return;
        }

        const response = await fetch('/api/auth/users/me/', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          setIsAdmin(false);
          return;
        }

        const user = await response.json();
        setIsAdmin(user.is_admin);
      } catch (error) {
        setIsAdmin(false);
      }
    };

    checkAdminStatus();
  }, []);

  if (isAdmin === null) {
    return (
      <Container sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Container>
    );
  }

  return isAdmin ? <>{children}</> : <Navigate to="/login" />;
};

export default AdminRoute; 