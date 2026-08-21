import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './AdminAuthPage.css';
import { ApiError } from '../api/client';
import { authApi } from '../api/services';

const AdminAuthPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    try {
      const response = await authApi.login(email, password);
      const userRole = response.role ?? response.user.role;
      if (userRole !== 'admin') {
        setFormError(t('admin_auth_access_denied', 'Доступ в админ-панель разрешён только пользователям с ролью admin.'));
        return;
      }
      authApi.persistAuth(response);
      navigate('/admin/console');
    } catch (error) {
      const message = error instanceof ApiError ? error.message : t('admin_auth_error', 'Ошибка входа в админ-панель.');
      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="admin-auth-page">
      <div className="admin-auth-panel" aria-live="polite">
        <header>
          <p>{t('admin_auth_subtitle')}</p>
          <h1>{t('admin_auth_title')}</h1>
        </header>

        <form className="admin-auth-form" onSubmit={handleSubmit}>
          {formError && <p className="form-error" role="alert">{formError}</p>}

          <label className="auth-field">
            <span>{t('admin_auth_email_label')}</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@uisks.kz"
              required
            />
          </label>

          <label className="auth-field">
            <span>{t('admin_auth_password_label')}</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={t('admin_auth_password_placeholder')}
              required
            />
          </label>

          <div className="auth-actions">
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('admin_auth_loading', 'Входим...') : t('admin_auth_login_button')}
            </button>
            <button type="button" className="ghost" onClick={() => navigate('/')}>{t('admin_auth_main_site')}</button>
          </div>
        </form>

        <div className="auth-support">
          <p>{t('admin_auth_support_title')}</p>
          <strong>{t('admin_auth_support_phone')}</strong>
          <a href="mailto:support@uisks.kz">support@uisks.kz</a>
        </div>
      </div>

      <aside className="admin-auth-hero" aria-hidden="true">
        <div className="hero-overlay" />
        <div className="hero-content">
          <div className="hero-badge">{t('admin_auth_secure_badge')}</div>
          <h2>{t('admin_auth_hero_title')}</h2>
          <p>{t('admin_auth_hero_copy')}</p>
          <ul>
            <li>{t('admin_auth_hero_point_one')}</li>
            <li>{t('admin_auth_hero_point_two')}</li>
            <li>{t('admin_auth_hero_point_three')}</li>
          </ul>
        </div>
      </aside>
    </div>
  );
};

export default AdminAuthPage;
