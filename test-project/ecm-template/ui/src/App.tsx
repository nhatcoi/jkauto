import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import DocumentsPage from './pages/DocumentsPage';
import FoldersPage from './pages/FoldersPage';
import TagsPage from './pages/TagsPage';
import UsersPage from './pages/UsersPage';
import RolesPage from './pages/RolesPage';
import SearchPage from './pages/SearchPage';
import RegisterPage from './pages/RegisterPage';

function isLoggedIn() {
  return !!localStorage.getItem('ecm_token');
}

function Protected({ children }: { children: React.ReactNode }) {
  return isLoggedIn() ? <Layout>{children}</Layout> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/" element={<Protected><DashboardPage /></Protected>} />
        <Route path="/documents" element={<Protected><DocumentsPage /></Protected>} />
        <Route path="/folders" element={<Protected><FoldersPage /></Protected>} />
        <Route path="/tags" element={<Protected><TagsPage /></Protected>} />
        <Route path="/users" element={<Protected><UsersPage /></Protected>} />
        <Route path="/roles" element={<Protected><RolesPage /></Protected>} />
        <Route path="/search" element={<Protected><SearchPage /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
