export const MASTER_PROFILE = {
  name: 'Иван',
  surname: 'Петров',
  phone: '+7 (999) 123-45-67',
  email: '',
  avatar: 'construct',
  about: 'Опытный мастер по отоплению и сантехнике.',
  rating: 4.8,
  reviewsCount: 24,
  ordersDone: 156,
  balance: 45000,
  tips: 3200,
  lat: 55.7558,
  lng: 37.6173,
  rank_id: 'master',
};

export const CLIENT_PROFILE = {
  name: 'Алексей',
  surname: '',
  phone: '+7 (999) 987-65-43',
  email: '',
  avatar: 'person',
  ordersCount: 12,
  tips: 1500,
  lat: 55.7558,
  lng: 37.6173,
};

export const CATEGORIES = [
  { id: 'heating', title: 'Отопление', icon: 'flame', color: '#e74c3c' },
  { id: 'plumbing', title: 'Сантехника', icon: 'water', color: '#3498db' },
  { id: 'electric', title: 'Электрика', icon: 'flash', color: '#f39c12' },
  { id: 'repair', title: 'Ремонт', icon: 'hammer', color: '#27ae60' },
];

export const SERVICES = [
  { id: 's1', category: 'heating', title: 'Установка радиатора', price: '3500 ₽', icon: 'flame' },
  { id: 's2', category: 'heating', title: 'Замена котла', price: '8000 ₽', icon: 'flame' },
  { id: 's3', category: 'plumbing', title: 'Устранение протечки', price: '2000 ₽', icon: 'water' },
  { id: 's4', category: 'plumbing', title: 'Установка смесителя', price: '2500 ₽', icon: 'water' },
  { id: 's5', category: 'electric', title: 'Замена розетки', price: '1500 ₽', icon: 'flash' },
  { id: 's6', category: 'electric', title: 'Проводка', price: '5000 ₽', icon: 'flash' },
  { id: 's7', category: 'repair', title: 'Штукатурка стен', price: '4000 ₽', icon: 'hammer' },
  { id: 's8', category: 'repair', title: 'Покраска', price: '3000 ₽', icon: 'hammer' },
];

export const RANKS = [
  { id: 'junior', title: 'Начинающий', icon: 'star-outline', color: '#95a5a6' },
  { id: 'master', title: 'Мастер', icon: 'star', color: '#3498db' },
  { id: 'senior', title: 'Старший мастер', icon: 'star-half', color: '#f39c12' },
  { id: 'expert', title: 'Эксперт', icon: 'trophy', color: '#27ae60' },
];

export const INITIAL_REVIEWS = [];
export const INITIAL_MESSAGES = [];

export const DEFAULT_LOCATION = {
  lat: 55.7558,
  lng: 37.6173,
  text: 'Москва, Россия',
};

export const WA_GREEN = '#25D366';
export const WA_TICK = '#34B7F1';