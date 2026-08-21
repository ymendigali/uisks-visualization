import type { FC } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Header from './Header';
import './Layout.css';

const currentYear = new Date().getFullYear();

const Layout: FC = () => {
  const { t } = useTranslation();

  return (
    <div className="layout">
      <Header />
      <main className="main-content">
        <div className="container">
          <Outlet />
        </div>
      </main>
      <footer className="footer">
        <div className="container footer-content">
          <p>{t('footer_copyright', { year: currentYear })}</p>
          <Link to="/team" className="footer-link">
            <span>{t('footer_about_button')}</span>
            <span aria-hidden="true" className="footer-link-arrow">↗</span>
          </Link>
        </div>
      </footer>
    </div>
  );
};

export default Layout;