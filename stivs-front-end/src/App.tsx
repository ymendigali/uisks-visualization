import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import HomePage from './pages/HomePage';
import ProjectsPage from './pages/ProjectsPage';
import EmployeesPage from './pages/EmployeesPage';
import EmployeeProfilePage from './pages/EmployeeProfilePage';
import PublicationsPage from './pages/PublicationsPage';
import FinancesPage from './pages/FinancesPage';
import MetricsPage from './pages/MetricsPage';
import AdminPage from './pages/AdminPage';
import NotFoundPage from './pages/NotFoundPage';
import LoginPage from './pages/LoginPage';
import RegistrationPage from './pages/RegistrationPage';
import AdminAuthPage from './pages/AdminAuthPage';
import TeamPage from './pages/TeamPage';
import LLMChatPage from './pages/LLMChatPage';
import './App.css';

const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="employees/profile/:employeeId" element={<EmployeeProfilePage />} />
        <Route path="publications" element={<PublicationsPage />} />
        <Route path="finances" element={<FinancesPage />} />
        <Route path="metrics" element={<MetricsPage />} />
        <Route path="team" element={<TeamPage />} />
        <Route path="assistant" element={<LLMChatPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegistrationPage />} />
        <Route path="forgot-password" element={<div>Страница восстановления пароля</div>} />
        <Route path="privacy-policy" element={<div>Политика конфиденциальности</div>} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      <Route path="/admin" element={<Navigate to="/admin/login" replace />} />
      <Route path="/admin/login" element={<AdminAuthPage />} />
      <Route path="/admin/console" element={<AdminPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

export default App;
