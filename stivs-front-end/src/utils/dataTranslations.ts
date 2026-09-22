export interface Translation {
  kk: string;
  en: string;
}

export const PRIORITY_TRANSLATIONS: Record<string, Translation> = {
  'Энергия, передовые материалы и транспорт': { kk: 'Энергия, озық материалдар және көлік', en: 'Energy, advanced materials and transportation' },
  '"Интеллектуальный потенциал страны" по направлению науки "Естественные науки"': { kk: '"Жаратылыстану ғылымдары" ғылым бағыты бойынша "Елдің зияткерлік әлеуеті"', en: '"Intellectual potential of the country" in the field of science "Natural Sciences"' },
  'Передовое производство, цифровые и космические технологии': { kk: 'Озық өндіріс, цифрлық және ғарыштық технологиялар', en: 'Advanced manufacturing, digital and space technologies' },
  'Экология, окружающая среда и рациональное природопользование': { kk: 'Экология, қоршаған орта және табиғатты ұтымды пайдалану', en: 'Ecology, environment and environmental management' },
  '"Интеллектуальный потенциал страны" по направлению науки "Социальные, гуманитарные науки и искусство"': { kk: '"Әлеуметтік, гуманитарлық ғылымдар және өнер" ғылым бағыты бойынша "Елдің зияткерлік әлеуеті"', en: '"Intellectual potential of the country" in the field of science "Social sciences, humanities and art"' },
  'Устойчивое развитие агропромышленного комплекса': { kk: 'Ауыл шаруашылығы және ветеринария ғылымдары', en: 'Sustainable development of the agro-industrial complex' },
  'Наука о жизни и здоровье': { kk: 'Өмір және денсаулық туралы ғылым', en: 'The science of life and health' },
  'Национальная безопасность и оборона, биологическая безопасность': { kk: 'Ұлттық қауіпсіздік және қорғаныс, биологиялық қауіпсіздік', en: 'National security and defense, biological security' },
  'Интеллектуальный потенциал страны': { kk: 'Елдің зияткерлік әлеуеті', en: 'Intellectual potential of the country' },
  'Рациональное использование водных ресурсов, животного и растительного мира, экология': { kk: 'Су ресурстарын, жануарлар мен өсімдіктер әлемін ұтымды пайдалану, экология', en: 'Rational Use of Natural Resources: Including water resources, geology, processing, new materials and technologies, safe products, and structures' },
  'Исследования в области социальных и гуманитарных наук': { kk: 'Әлеуметтік және гуманитарлық ғылымдар саласындағы зерттеулер', en: 'Research in Social and Humanities Sciences' },
};

export const GENDER_TRANSLATIONS: Record<string, Translation> = {
  'Мужчина': { kk: 'Ер', en: 'Man' },
  'Женщина': { kk: 'Әйел', en: 'Woman' },
};

export const DEGREE_TRANSLATIONS: Record<string, Translation> = {
  'Кандидат наук': { kk: 'ғылым кандидаты', en: 'PhD' },
  'Доктор наук': { kk: 'ғылым докторы', en: 'Doctor of Sciences' },
  'Доктор PhD': { kk: 'PhD докторы', en: 'Doctor of Philosophy' },
  'Бакалавр': { kk: 'Бакалавр', en: 'Bachelor' },
  'Магистр': { kk: 'Магистр', en: "master's degree" },
};

// DB values for academic degree are free-form ("Кандидат химических наук", "Доктор биологических
// наук", "Phd", ...) rather than the exact dictionary keys above, so translation falls back to
// keyword matching. "PhD" must be checked before "кандидат"/"доктор" since Kazakhstan's PhD degree
// ("Доктор PhD") is distinct from the Soviet-system "Кандидат наук" (whose closest English label in
// the source dictionary is, confusingly, also "PhD") and "Доктор наук".
const DEGREE_BUCKET_RULES: Array<{ test: RegExp; key: string }> = [
  { test: /phd/i, key: 'Доктор PhD' },
  { test: /кандидат/i, key: 'Кандидат наук' },
  { test: /доктор/i, key: 'Доктор наук' },
  { test: /магистр/i, key: 'Магистр' },
  { test: /бакалавр/i, key: 'Бакалавр' },
];

type Locale = string | undefined | null;

// i18n.language can carry a region suffix (e.g. "en-US") depending on browser detection,
// even though the app's own language switcher only ever sets the bare "kk"/"ru"/"en" codes.
const resolveTranslatableLocale = (lang: Locale): 'kk' | 'en' | null => {
  const normalized = (lang ?? '').toLowerCase();
  if (normalized.startsWith('kk')) return 'kk';
  if (normalized.startsWith('en')) return 'en';
  return null;
};

const pick = (translation: Translation, lang: 'kk' | 'en'): string => (lang === 'kk' ? translation.kk : translation.en);

const translateByDict = (value: string | undefined | null, lang: Locale, dict: Record<string, Translation>): string => {
  const text = (value ?? '').trim();
  const resolved = resolveTranslatableLocale(lang);
  if (!text || !resolved) {
    return value ?? '';
  }
  const exact = dict[text];
  return exact ? pick(exact, resolved) : (value ?? '');
};

export const translatePriority = (value: string | undefined | null, lang: Locale): string =>
  translateByDict(value, lang, PRIORITY_TRANSLATIONS);

export const translateGender = (value: string | undefined | null, lang: Locale): string =>
  translateByDict(value, lang, GENDER_TRANSLATIONS);

export const translateDegree = (value: string | undefined | null, lang: Locale): string => {
  const text = (value ?? '').trim();
  const resolved = resolveTranslatableLocale(lang);
  if (!text || !resolved) {
    return value ?? '';
  }

  const exact = DEGREE_TRANSLATIONS[text];
  if (exact) {
    return pick(exact, resolved);
  }

  const rule = DEGREE_BUCKET_RULES.find(({ test }) => test.test(text));
  const bucketed = rule ? DEGREE_TRANSLATIONS[rule.key] : undefined;
  return bucketed ? pick(bucketed, resolved) : (value ?? '');
};

const TITLE_EXCEL_KEYS: Record<'kk' | 'en', string> = {
  kk: 'Наименование на казахском языке',
  en: 'Наименование на английском языке',
};

export const translateProjectTitle = (
  title: string | undefined | null,
  excelData: Record<string, unknown> | undefined | null,
  lang: Locale,
): string => {
  const fallback = title ?? '';
  const resolved = resolveTranslatableLocale(lang);
  if (!resolved || !excelData) {
    return fallback;
  }

  const translated = excelData[TITLE_EXCEL_KEYS[resolved]];
  return typeof translated === 'string' && translated.trim() ? translated : fallback;
};
