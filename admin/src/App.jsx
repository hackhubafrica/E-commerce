import { useEffect, useState } from 'react';
import Navbar from './Components/Navbar/Navbar'
import Admin from './Pages/Admin/Admin'
import AdminLogin from './Components/AdminLogin/AdminLogin';
import { adminRequest } from './api';

const App = () => {
  const [token, setToken] = useState(() => localStorage.getItem('admin-token'));
  const [sessionState, setSessionState] = useState(token ? 'checking' : 'signed-out');

  useEffect(() => {
    if (!token) {
      setSessionState('signed-out');
      return;
    }
    let active = true;
    adminRequest('/admin/session', token)
      .then(() => { if (active) setSessionState('signed-in'); })
      .catch(() => {
        localStorage.removeItem('admin-token');
        if (active) {
          setToken(null);
          setSessionState('signed-out');
        }
      });
    return () => { active = false; };
  }, [token]);

  const login = (adminToken) => {
    localStorage.setItem('admin-token', adminToken);
    setToken(adminToken);
    setSessionState('checking');
  };

  const logout = () => {
    localStorage.removeItem('admin-token');
    setToken(null);
    setSessionState('signed-out');
  };

  if (sessionState === 'checking') {
    return <main className="admin-login-page" role="status">Checking admin session...</main>;
  }

  if (sessionState === 'signed-out') {
    return <AdminLogin onLogin={login} />;
  }

  return (
    <div>
      <Navbar onLogout={logout} />
      <Admin token={token} />
    </div>
  );
};

export default App;
