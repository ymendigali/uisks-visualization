import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const NotFoundPage = () => {
  const { t } = useTranslation();

  return (
    <div>
      <h2>{t('not_found_title', 'Страница не найдена')}</h2>
      <p>{t('not_found_description', 'Похоже, такого раздела еще нет. Вернитесь на главную страницу.')}</p>
      <Link to="/">{t('not_found_back', 'Вернуться на главную')}</Link>
    </div>
  );
};

export default NotFoundPage;
