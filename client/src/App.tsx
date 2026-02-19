import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from '@/pages/login';
import DashboardPage from '@/pages/dashboard';
import AdminPage from '@/pages/admin';
import AgentsPage from '@/pages/agents';
import AdminsPage from '@/pages/admins';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/agents" element={<AgentsPage />} />
        <Route path="/admins" element={<AdminsPage />} />
        <Route path="/" element={<DashboardPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
