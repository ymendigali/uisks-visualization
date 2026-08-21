import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './RegistrationPage.css';
import { ApiError } from '../api/client';
import { authApi } from '../api/services';


// { [Регион/Область]: [Районы/Крупные города/НП] }
const REGION_DATA: { [key: string]: string[] } = {
  'г. Астана': [
    'Район Алматы',
    'Район Есиль',
    'Район Сарыарка',
    'Район Байконур',
  ],
  'г. Алматы': [
    'Алмалинский район',
    'Бостандыкский район',
    'Медеуский район',
    'Наурызбайский район',
  ],
  'г. Шымкент': [
    'Абайский район',
    'Енбекшинский район',
    'Каратауский район',
    'Аль-Фарабийский район',
  ],
  'Акмолинская область': [
    'г. Кокшетау',
    'г. Степногорск',
    'Атбасарский район',
    'Бурабайский район',
  ],
  'Карагандинская область': [
    'г. Караганда',
    'г. Темиртау',
    'г. Сарань',
    'Бухар-Жырауский район',
  ],
  // ... Добавьте остальные регионы и их основные районы/города
  'Абайская область': ['г. Семей', 'Район Абай'],
  'Актюбинская область': ['г. Актобе', 'Айтекебийский район'],
  'Алматинская область': ['г. Конаев', 'Енбекшиказахский район'],
  'Атырауская область': ['г. Атырау', 'Жылыойский район'],
  'Восточно-Казахстанская область': ['г. Усть-Каменогорск', 'Глубоковский район'],
  'Жамбылская область': ['г. Тараз', 'Байзакский район'],
  'Жетысуская область': ['г. Талдыкорган', 'Аксуский район'],
  'Западно-Казахстанская область': ['г. Уральск', 'Бурлинский район'],
  'Костанайская область': ['г. Костанай', 'Аулиекольский район'],
  'Кызылординская область': ['г. Кызылорда', 'Аральский район'],
  'Мангистауская область': ['г. Актау', 'Бейнеуский район'],
  'Павлодарская область': ['г. Павлодар', 'Актогайский район'],
  'Северо-Казахстанская область': ['г. Петропавловск', 'Мамлютский район'],
  'Туркестанская область': ['г. Туркестан', 'Сарыагашский район'],
  'Улытауская область': ['г. Жезказган', 'Жанааркинский район'],
};

// Список всех топ-уровневых регионов (Область/Город)
const ALL_REGIONS = Object.keys(REGION_DATA).sort();

// --- Интерфейс и остальная часть компонента ---
interface RegistrationFormData {
  organizationName: string;
  // Поле 'region' теперь содержит Область/Город республиканского значения
  region: string; 
  // Поле 'oblast' удаляем из формы (или переименовываем в 'district'/'city')
  // Если вы хотите использовать существующее имя 'oblast' для района/города,
  // просто переименуем его в JSX. Для чистоты оставим только 'region' и 'city'
  

  // мы оставим имена полей region, oblast, city. Но будем использовать только region и city.
  
  oblast: string; // Имя оставлено для совместимости с интерфейсом, но не используется как отдельный уровень
  city: string;   // Теперь это зависимый Город/НП/Район
  
  district: string; // Это поле из группы Адрес. Можем его убрать, если оно лишнее.
  street: string;
  streetNumber: string;
  postalCode: string;

  orgPhone: string;
  orgEmail: string;
  orgFax: string;
  lastName: string;
  firstName: string;
  middleName: string;
  iin: string;
  position: string;
  headOfficePhone: string;
  headMobilePhone: string;
  headCityPhone: string;
  loginEmail: string;
  password: string;
  passwordConfirm: string;
  consent: boolean;
}

const RegistrationPage: React.FC = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Инициализация состояния
  const [formData, setFormData] = useState<RegistrationFormData>({
    organizationName: '',
    region: '',
    oblast: '', // Будет проигнорировано
    city: '',
    district: '',
    street: '',
    streetNumber: '',
    postalCode: '',
    orgPhone: '',
    orgEmail: '',
    orgFax: '',
    lastName: '',
    firstName: '',
    middleName: '',
    iin: '',
    position: '',
    headOfficePhone: '',
    headMobilePhone: '',
    headCityPhone: '',
    loginEmail: '',
    password: '',
    passwordConfirm: '',
    consent: false,
  });

  // --- Универсальный обработчик изменений с логикой сброса ---
  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox';

    setFormData((prev) => {
      const newState = {
        ...prev,
        [name]: isCheckbox ? (e.target as HTMLInputElement).checked : value,
      };

      // Логика каскадного сброса при изменении Региона
      if (name === 'region') {
        // Сбрасываем Город/Район (city) при смене Региона
        newState.city = '';
      }
      // Примечание: 'oblast' не используется в форме, поэтому логика сброса для него не нужна.

      return newState;
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    if (formData.password !== formData.passwordConfirm) {
      setFormError('Пароли не совпадают. Пожалуйста, проверьте ввод.');
      return;
    }
    if (!formData.consent) {
      setFormError('Необходимо согласиться с политикой конфиденциальности.');
      return;
    }
    setIsSubmitting(true);
    try {
      const fullName = [formData.lastName, formData.firstName, formData.middleName].filter(Boolean).join(' ');
      await authApi.register({
        email: formData.loginEmail,
        password: formData.password,
        name: fullName || formData.organizationName,
        role: 'staff',
      });
      setFormSuccess('Регистрация прошла успешно. Теперь войдите в систему.');
      setTimeout(() => navigate('/login'), 1500);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Не удалось завершить регистрацию.';
      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
  };
  

  const dependentCitiesList = useMemo(() => {
    if (!formData.region) return [];
    // Получаем список городов/районов в зависимости от выбранного региона
    const cities = REGION_DATA[formData.region];
    return cities ? cities.sort() : [];
  }, [formData.region]);
  // --- 4. JSX разметка формы ---
  return (
    <div className="pageContainer">
      
      <div className="registrationFormBox">
        <h2 className="formHeader">Регистрация</h2>
        <form className="form" onSubmit={handleSubmit}>
            {formError && <p className="form-error" role="alert">{formError}</p>}
            {formSuccess && <p className="form-success" role="status">{formSuccess}</p>}
            
            {/* Группа 1: Организация, Регион, Адрес */}
            <div className="section">
                <h3 className="sectionTitle">Организация</h3>
                <div className="inputGroupFull">
                    <input 
                      type="text" 
                      placeholder="Введите название организации" 
                      className="inputFull"
                      name="organizationName"
                      value={formData.organizationName}
                      onChange={handleChange}
                      required
                    />
                </div>
                
                {/* Регион (2 выпадашки) */}
                <h3 className="sectionTitle">Регион</h3>
                <div className="rowTwo"> 
                    
                    {/* 1. Регион/Область (Топ-уровень) */}
                    <div className="inputGroup">
                        <select 
                          className="select"
                          name="region" // Используем 'region' для Области/Города
                          value={formData.region}
                          onChange={handleChange}
                          required
                        >
                            <option value="" disabled>Выберите регион</option>
                            {ALL_REGIONS.map((regionName) => (
                                <option key={regionName} value={regionName}>
                                    {regionName}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* 2. Город/Населенный пункт/Район (Зависит от Региона) */}
                    <div className="inputGroup">
                        <select 
                          className="select"
                          name="city" // Используем 'city' для зависимого города/района
                          value={formData.city}
                          onChange={handleChange}
                          required
                          disabled={!formData.region} // Деактивировано, пока не выбран Регион
                        >
                            <option value="" disabled>Выберите город/район</option>
                            {dependentCitiesList.map((cityName) => (
                                <option key={cityName} value={cityName}>
                                    {cityName}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Адрес (4 поля) */}
                <h3 className="sectionTitle">Адрес</h3>
                <div className="rowFour">
                    <div className="inputGroup">
                        <input 
                          type="text" 
                          placeholder="Район" 
                          className="input"
                          name="district"
                          value={formData.district}
                          onChange={handleChange}
                        />
                    </div>
                    <div className="inputGroup">
                        <input 
                          type="text" 
                          placeholder="Улица" 
                          className="input"
                          name="street"
                          value={formData.street}
                          onChange={handleChange}
                          required
                        />
                    </div>
                    <div className="inputGroup">
                        <input 
                          type="text" 
                          placeholder="№ Улица" 
                          className="input"
                          name="streetNumber"
                          value={formData.streetNumber}
                          onChange={handleChange}
                          required
                        />
                    </div>
                    <div className="inputGroup">
                        <input 
                          type="text" 
                          placeholder="Почтовый Индекс" 
                          className="input"
                          name="postalCode"
                          value={formData.postalCode}
                          onChange={handleChange}
                        />
                    </div>
                </div>
            </div>

            {/* Группа 2: Контактная информация (телефон, email, факс) */}
            <div className="section">
                <h3 className="sectionTitle">Контактная информация</h3>
                <div className="rowThree">
                    <div className="inputGroup">
                        <input 
                          type="tel" 
                          placeholder="Телефон" 
                          className="input"
                          name="orgPhone"
                          value={formData.orgPhone}
                          onChange={handleChange}
                          required
                        />
                    </div>
                    <div className="inputGroup">
                        <input 
                          type="email" 
                          placeholder="Email" 
                          className="input"
                          name="orgEmail"
                          value={formData.orgEmail}
                          onChange={handleChange}
                          required
                        />
                    </div>
                    <div className="inputGroup">
                        <input 
                          type="tel" 
                          placeholder="Факс" 
                          className="input"
                          name="orgFax"
                          value={formData.orgFax}
                          onChange={handleChange}
                        />
                    </div>
                </div>
            </div>
            
            {/* Группа 3: Информация о первом руководителе */}
            <div className="section">
                <h3 className="sectionTitle">Информация о первом руководителе</h3>
                
                {/* Фамилия, Имя, Отчество (3 колонки) */}
                <div className="rowThree">
                    <div className="inputGroup">
                        <label className="label">Фамилия</label>
                        <input 
                          type="text" 
                          className="input"
                          name="lastName"
                          value={formData.lastName}
                          onChange={handleChange}
                          required
                        />
                    </div>
                    <div className="inputGroup">
                        <label className="label">Имя</label>
                        <input 
                          type="text" 
                          className="input"
                          name="firstName"
                          value={formData.firstName}
                          onChange={handleChange}
                          required
                        />
                    </div>
                    <div className="inputGroup">
                        <label className="label">Отчество</label>
                        <input 
                          type="text" 
                          className="input"
                          name="middleName"
                          value={formData.middleName}
                          onChange={handleChange}
                        />
                    </div>
                </div>
                
                {/* ИИН, Должность (2 колонки) */}
                <div className="rowTwo">
                    <div className="inputGroup">
                        <label className="label">ИИН</label>
                        <input 
                          type="text" 
                          className="input"
                          name="iin"
                          value={formData.iin}
                          onChange={handleChange}
                          required
                          maxLength={12}
                        />
                    </div>
                    <div className="inputGroup">
                        <label className="label">Должность</label>
                        <input 
                          type="text" 
                          className="input"
                          name="position"
                          value={formData.position}
                          onChange={handleChange}
                          required
                        />
                    </div>
                </div>
                
                {/* Контактная информация (3 телефона) */}
                <h3 className="sectionTitle">Контактная информация</h3>
                <div className="rowThree">
                    <div className="inputGroup">
                        <input 
                          type="tel" 
                          placeholder="Основной телефон" 
                          className="input"
                          name="headOfficePhone"
                          value={formData.headOfficePhone}
                          onChange={handleChange}
                        />
                    </div>
                    <div className="inputGroup">
                        <input 
                          type="tel"  
                          placeholder="Сотовый телефон" 
                          className="input"
                          name="headMobilePhone"
                          value={formData.headMobilePhone}
                          onChange={handleChange}
                        />
                    </div>
                    <div className="inputGroup">
                        <input 
                          type="tel" 
                          placeholder="Городской телефон" 
                          className="input"
                          name="headCityPhone"
                          value={formData.headCityPhone}
                          onChange={handleChange}
                        />
                    </div>
                </div>
            </div>

            {/* Группа 4: Email / Пароль (Авторизация) */}
            <div className="section">
                <h3 className="sectionTitle">Email / Логин</h3>
                
                <div className="inputGroupFull">
                    <input 
                      type="email" 
                      placeholder="Введите ваш e-mail" 
                      className="inputFull"
                      name="loginEmail"
                      value={formData.loginEmail}
                      onChange={handleChange}
                      required
                    />
                </div>
                
                <h3 className="sectionTitle">Пароль</h3>
                <div className="inputGroupFull">
                    <input 
                      type="password" 
                      placeholder="Задайте пароль" 
                      className="inputFull"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      required
                      minLength={8}
                    />
                </div>
                
                <h3 className="sectionTitle">Подтверждение пароля</h3>
                <div className="inputGroupFull">
                    <input 
                      type="password" 
                      placeholder="Повторите пароль" 
                      className="inputFull"
                      name="passwordConfirm"
                      value={formData.passwordConfirm}
                      onChange={handleChange}
                      required
                      minLength={8}
                    />
                </div>
            </div>

            {/* Соглашение и Кнопки */}
            <div className="footerActions">
                <div className="agreementCheckbox">
                    <input 
                      type="checkbox" 
                      id="consent"
                      name="consent"
                      checked={formData.consent}
                      onChange={handleChange}
                    />
                    <label htmlFor="consent">Я соглашаюсь с политикой конфиденциальности и обработки персональных данных.</label>
                </div>
                
                <button type="submit" className="primaryButton" disabled={isSubmitting}>
                  {isSubmitting ? 'Регистрируем...' : 'Зарегистрироваться'}
                </button>
                <Link to="/login" className="secondaryLink">
                    Войти
                </Link>
            </div>

        </form>
      </div>
      
    </div>
  );
}

export default RegistrationPage;