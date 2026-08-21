import React from 'react';
import './PageLoader.css';

interface PageLoaderProps {
  message?: string;
  className?: string;
}

const PageLoader: React.FC<PageLoaderProps> = ({ message = 'Загрузка данных...', className }) => (
  <div className={`page-loader${className ? ` ${className}` : ''}`} role="status" aria-label={message}>
    <span className="page-loader-spinner" aria-hidden="true" />
    {message && <span className="page-loader-text">{message}</span>}
  </div>
);

export default PageLoader;
