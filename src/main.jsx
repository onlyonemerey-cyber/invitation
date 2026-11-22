import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import Admin from './admin/Admin.jsx';
import './styles.css';

const isAdmin = () => window.location.hash.startsWith('#/admin');

function Root() {
  const [admin, setAdmin] = useState(isAdmin);
  useEffect(() => {
    const onHash = () => setAdmin(isAdmin());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (admin) return <Admin />;
  const inviteId = new URLSearchParams(window.location.search).get('i');
  return <App inviteId={inviteId} />;
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
