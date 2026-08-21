import React from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import './EmployeeProfilePage.css';

type EmployeeState = {
  employee?: {
    id: string;
    name: string;
    position: string;
    department: string;
    email: string;
    scopusAuthorId?: string;
    researcherIdWos?: string;
    hIndex?: number;
    hIndexScopus?: number;
  };
};

const EmployeeProfilePage: React.FC = () => {
  const { employeeId } = useParams();
  const location = useLocation();
  const state = location.state as EmployeeState | null;
  const employee = state?.employee;

  return (
    <div className="employee-profile-page">
      <header className="employee-profile-header">
        <h1>Профиль сотрудника</h1>
        <Link to="/employees">Назад к списку</Link>
      </header>

      <section className="employee-profile-card">
        <h2>{employee?.name ?? 'Сотрудник'}</h2>
        <p><strong>ID:</strong> {employee?.id ?? employeeId ?? '—'}</p>
        <p><strong>Должность:</strong> {employee?.position ?? '—'}</p>
        <p><strong>Подразделение:</strong> {employee?.department ?? '—'}</p>
        <p><strong>Email:</strong> {employee?.email ?? '—'}</p>
        <p><strong>Author ID Scopus:</strong> {employee?.scopusAuthorId ?? '—'}</p>
        <p><strong>Researcher ID WoS:</strong> {employee?.researcherIdWos ?? '—'}</p>
        <p><strong>H-индекс Scopus:</strong> {employee?.hIndexScopus ?? employee?.hIndex ?? '—'}</p>
        <p><strong>H-индекс WoS:</strong> {employee?.hIndex ?? '—'}</p>
      </section>
    </div>
  );
};

export default EmployeeProfilePage;
