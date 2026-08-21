import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import './Header.css';

const Header: React.FC = () => {
  const location = useLocation();
  const { t, i18n } = useTranslation();

  const navigationItems = useMemo(() => [
    { path: '/', label: t('home_page_title') },
    { path: '/projects', label: t('projects_page_title') },
    { path: '/employees', label: t('employees_page_title') },
    { path: '/finances', label: t('finances_page_title') },
    { path: '/publications', label: t('publications_page_title') },
    { path: '/metrics', label: t('metrics_page_title') },
    { path: '/assistant', label: t('llm_chat_nav_label') },
  ], [t]);

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <header className="header">
      <div className="header-content">
        <div className="header-top-row">
          <div className="header-left">
            <div className="logo">
              <Link to="/" className="app-logo-link"> 
                <h1>{t('app_name')}</h1>
              </Link>
              <span className="logo-subtitle">{t('app_title_full')}</span>
            </div>
          </div>

          <div className="header-right">
            <div className="language-selector">
              <button
                type="button"
                className={`lang-option ${i18n.language === 'kk' ? 'active' : ''}`}
                onClick={() => changeLanguage('kk')}
              >
                {t('kaz_label')}
              </button>
              <button
                type="button"
                className={`lang-option ${i18n.language === 'ru' ? 'active' : ''}`}
                onClick={() => changeLanguage('ru')}
              >
                {t('rus_label')}
              </button>
              <button
                type="button"
                className={`lang-option ${i18n.language === 'en' ? 'active' : ''}`}
                onClick={() => changeLanguage('en')}
              >
                EN
              </button>
            </div>
            
            <div className="user-menu">
              <div className="user-avatar">
                <Link to="/login" className="user-avatar-link">
                <User size={20} />
                </Link>
              </div>

            </div>
          </div>
        </div>

        <nav className="navigation">
          {navigationItems.map((item) => {
            const isActive = item.path === '/'
              ? location.pathname === '/'
              : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-link ${isActive ? 'active' : ''}`}
              >
              {item.label}
            </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
};

export default Header;