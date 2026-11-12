import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, SafeAreaView, StatusBar, Alert, Linking, ScrollView, Animated, TextInput, KeyboardAvoidingView, Platform, Image, Easing, Vibration, Modal, ActivityIndicator, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Location from 'expo-location';
import { useAudioRecorder, useAudioPlayer, useAudioPlayerStatus, AudioModule, RecordingPresets, setAudioModeAsync } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import { supabase } from './lib/supabase'; // Подключение к базе данных

const MASTER_ACCENT = '#FFFFFF';
const MASTER_ROLE_COLOR = '#e74c3c';
const WA_CHAT_BG = '#0b141a';
const WA_BUBBLE_MINE = '#005c4b';
const WA_BUBBLE_OTHER = '#202c33';
const WA_GREEN = '#00a884';
const WA_TICK = '#53bdeb';
const VISIT_PRICE = '3000 ₽';
const VISIT_ID = 's0';
const DEFAULT_LOCATION = { lat: 55.7558, lng: 37.6173, text: 'Москва (по умолчанию)' };
const TAKEN_JOBS_KEY = 'takenJobs';

const COMMISSION_THRESHOLD = 6000;
const getCommissionRate = (amount) => (amount <= COMMISSION_THRESHOLD ? 0.07 : 0.05);
const getCommissionAmount = (amount) => Math.round(amount * getCommissionRate(amount));
const formatCommissionPct = (amount) => `${Math.round(getCommissionRate(amount) * 100)}%`;

const RANKS = [
  { id: 'novice', title: 'Новичок', icon: 'leaf', color: '#95a5a6', minOrders: 0, maxOrders: 5 },
  { id: 'apprentice', title: 'Ученик', icon: 'school', color: '#3498db', minOrders: 5, maxOrders: 15 },
  { id: 'master', title: 'Мастер', icon: 'construct', color: '#9b59b6', minOrders: 15, maxOrders: 30 },
  { id: 'pro', title: 'Профи', icon: 'shield-checkmark', color: '#f39c12', minOrders: 30, maxOrders: 60 },
  { id: 'legend', title: 'Легенда', icon: 'trophy', color: '#e74c3c', minOrders: 60, maxOrders: Infinity },
];
const getRank = (orders) => RANKS.find(r => orders >= r.minOrders && orders < r.maxOrders) || RANKS[RANKS.length - 1];
const getMonthKey = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth()}`; };
const getDistanceMeters = (lat1, lon1, lat2, lon2) => { const R = 6371000; const toRad = (v) => (v * Math.PI) / 180; const dLat = toRad(lat2 - lat1); const dLon = toRad(lon2 - lon1); const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2; return Math.round(2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))); };
const formatDistance = (m) => (m < 1000 ? `${m} м` : `${(m / 1000).toFixed(1)} км`);

const parsePrice = (str) => {
  if (!str) return 0;
  if (typeof str === 'number') return str;
  const cleaned = String(str).replace(/\s/g, '');
  const match = cleaned.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
};

const reverseGeocodeToAddress = async (latitude, longitude) => {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (results && results.length > 0) {
      const a = results[0];
      const parts = [];
      const city = a.city || a.subregion || a.region;
      if (city) parts.push(city);
      const street = a.street || a.name;
      if (street && street !== city) parts.push(street);
      if (a.streetNumber) parts.push(a.streetNumber);
      if (parts.length > 0) return parts.join(', ');
      if (a.district) return a.district;
    }
  } catch (e) {}
  return null;
};

// Тестовые мастера для выбора клиентом
const MASTERS = [
  { id: 'm1', name: 'Сергей Иванов', phone: '+7 (900) 123-45-67', rating: 4.8, reviewsCount: 27, ordersDone: 18, rank: 'master', avatar: 'construct', about: 'Специалист по отоплению и котлам с 5-летним опытом', lat: 55.7620, lng: 37.6100 },
  { id: 'm2', name: 'Андрей Петров', phone: '+7 (900) 234-56-78', rating: 4.9, reviewsCount: 42, ordersDone: 35, rank: 'pro', avatar: 'shield-checkmark', about: 'Мастер по установке батарей и тёплых полов', lat: 55.7700, lng: 37.6300 },
];

const INITIAL_MASTER_REVIEWS = {};
const CLIENT_PROFILE = { name: 'Вы', surname: '', phone: '+7 (900) 000-00-00', rating: 4.9, reviewsCount: 8, ordersCount: 12, tips: 2500, avatar: null };
const CLIENT_REVIEWS = [];
const MASTER_PROFILE = { name: 'Сергей', surname: 'Иванов', phone: '+7 (900) 123-45-67', ordersDone: 18, rating: 4.8, totalRatings: 27, balance: 45000, avatar: null };
const INITIAL_REVIEWS = [];
const INITIAL_MASTER_ORDERS_HISTORY = [];

const CATEGORIES = [
  { id: 'service', title: 'Выезд мастера', icon: 'car-sport', color: '#27ae60' },
  { id: 'heating', title: 'Отопление', icon: 'flame', color: '#f39c12' },
  { id: 'boiler', title: 'Котельное', icon: 'settings', color: '#e74c3c' },
  { id: 'water', title: 'Водоснабжение', icon: 'water', color: '#3498db' },
  { id: 'repair', title: 'Ремонт', icon: 'construct', color: '#c0392b' },
  { id: 'sanitary', title: 'Сантехника', icon: 'home', color: '#2980b9' },
];

const S = (id, category, title, price, icon) => ({ id, category, title, price, icon });

const SERVICES = [
  S(VISIT_ID, 'service', 'Выезд мастера', VISIT_PRICE, 'car-outline'),
  S('h1', 'heating', 'Монтаж радиатора (без подводящих сетей)', '4500 ₽', 'thermometer-outline'),
  S('h2', 'heating', 'Монтаж дизайн-радиаторов', '9000 ₽', 'color-palette-outline'),
  S('b1', 'boiler', 'Монтаж настенного газового котла', '13000 ₽', 'flame-outline'),
  S('w1', 'water', 'Монтаж точки водоснабжения', '1300 ₽', 'water-outline'),
  S('r1', 'repair', 'Выезд мастера на диагностику, сервис, ремонт', '2000 ₽', 'car-outline'),
  S('san1', 'sanitary', 'Инсталляция рамы без подводки', '7000 ₽', 'home-outline'),
];

const INITIAL_JOBS = [];
const INITIAL_MESSAGES = [{ id: 'd1', type: 'date', text: 'Сегодня' }];
const STATUS_LABELS = { new: 'Новая', on_way: 'В пути', on_site: 'На объекте', done: 'Завершена' };
const pluralServices = (n) => { const m10 = n % 10, m100 = n % 100; if (m10 === 1 && m100 !== 11) return 'услуга'; if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return 'услуги'; return 'услуг'; };
const renderStars = (rating, size = 14) => { const arr = []; for (let i = 1; i <= 5; i++) { arr.push(<Ionicons key={i} name={i <= Math.round(rating) ? 'star' : 'star-outline'} size={size} color="#f39c12" style={{ marginRight: 2 }} />); } return arr; };
const formatSec = (sec) => { const s = Math.max(0, Math.floor(sec || 0)); const m = Math.floor(s / 60); const r = s % 60; return `${m}:${String(r).padStart(2, '0')}`; };
const cleanPhone = (p) => String(p).replace(/[^\d+]/g, '');

const softVibrate = (ms = 12) => { try { Vibration.vibrate(ms); } catch (e) {} };

function AnimatedCard({ children, index = 0, style }) { 
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 350, delay: index * 80, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 350, delay: index * 80, useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY, index]);
  return <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>{children}</Animated.View>;
}

function CategoryCard({ category, count, onPress, index }) {
  const anim = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 500, delay: index * 100, useNativeDriver: true }).start();
  }, [anim, index]);
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });
  return (
    <Animated.View style={[styles.categoryCard, { backgroundColor: category.color + '18', borderColor: category.color + '55', opacity: anim, transform: [{ translateY }, { scale: press }] }]}>
      <TouchableOpacity style={styles.categoryCardInner} activeOpacity={1}
        onPressIn={() => Animated.spring(press, { toValue: 0.95, useNativeDriver: true, speed: 40 }).start()}
        onPressOut={() => Animated.spring(press, { toValue: 1, useNativeDriver: true, speed: 40 }).start()}
        onPress={onPress}>
        <View style={[styles.categoryIconCircle, { backgroundColor: category.color }]}><Ionicons name={category.icon} size={30} color="#fff" /></View>
        <View style={{ flex: 1 }} />
        <Text style={styles.categoryCardTitle}>{category.title}</Text>
        <Text style={[styles.categoryCardCount, { color: category.color }]}>{count} {pluralServices(count)}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

function AttachPanel({ visible, onPhoto, onVideo, onClose }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(340)).current;
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, speed: 16, bounciness: 4 }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 340, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);
  return (
    <Animated.View pointerEvents={visible ? 'auto' : 'none'} style={[styles.attachOverlay, { opacity }]}>
      <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[styles.attachSheet, { transform: [{ translateY }] }]}>
        <View style={styles.attachGrabber} />
        <Text style={styles.attachSheetTitle}>Прикрепить</Text>
        <View style={styles.attachTilesRow}>
          <TouchableOpacity onPress={onPhoto} style={styles.attachTileWrap}>
            <View style={[styles.attachTile, { backgroundColor: '#0ea5e9' }]}><Ionicons name="images" size={22} color="#fff" /></View>
            <Text style={styles.attachTileLabel}>Фото</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onVideo} style={styles.attachTileWrap}>
            <View style={[styles.attachTile, { backgroundColor: '#e74c3c' }]}><Ionicons name="videocam" size={22} color="#fff" /></View>
            <Text style={styles.attachTileLabel}>Видео</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [role, setRole] = useState('client');
  const [loading, setLoading] = useState(false);

  const validate = () => {
    if (cleanPhone(phone).length < 10) { Alert.alert('Ошибка', 'Введите корректный номер телефона'); return false; }
    if (password.length < 6) { Alert.alert('Ошибка', 'Пароль минимум 6 символов'); return false; }
    if (mode === 'register' && !name.trim()) { Alert.alert('Ошибка', 'Введите имя'); return false; }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    const p = cleanPhone(phone);
    const fakeEmail = `${p}@heating.local`; 

    try {
      if (mode === 'register') {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: fakeEmail,
          password: password,
        });
        if (authError) throw authError;

        if (authData.user) {
          const { error: profileError } = await supabase.from('profiles').insert({
            id: authData.user.id,
            role: role,
            name: name.trim(),
            surname: surname.trim(),
            phone: p,
          });
          if (profileError) throw profileError;
          onAuth({ id: authData.user.id, role, name: name.trim(), surname: surname.trim(), phone: p });
        }
      } else {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: fakeEmail,
          password: password,
        });
        if (authError) throw authError;

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authData.user.id)
          .single();
        if (profileError) throw profileError;
        onAuth({ id: authData.user.id, ...profile });
      }
    } catch (e) { 
      Alert.alert('Ошибка', e.message || 'Что-то пошло не так'); 
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <SafeAreaView style={styles.authContainer}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.authScroll} keyboardShouldPersistTaps="handled">
          <View style={styles.authLogoWrap}><Ionicons name="flame" size={60} color="#ff8c42" /></View>
          <Text style={styles.authTitle}>Отопление и ремонт</Text>
          <Text style={styles.authSubtitle}>{mode === 'login' ? 'Войдите в аккаунт' : 'Создайте аккаунт'}</Text>
          <View style={styles.authTabsRow}>
            <TouchableOpacity style={[styles.authTab, mode === 'login' && styles.authTabActive]} onPress={() => setMode('login')}><Text style={[styles.authTabText, mode === 'login' && styles.authTabTextActive]}>Вход</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.authTab, mode === 'register' && styles.authTabActive]} onPress={() => setMode('register')}><Text style={[styles.authTabText, mode === 'register' && styles.authTabTextActive]}>Регистрация</Text></TouchableOpacity>
          </View>
          {mode === 'register' && (<>
            <View style={styles.authInputWrap}><Ionicons name="person-outline" size={20} color="#666" style={styles.authInputIcon} /><TextInput style={styles.authInput} placeholder="Имя" placeholderTextColor="#666" value={name} onChangeText={setName} autoCapitalize="words" /></View>
            <View style={styles.authInputWrap}><Ionicons name="id-card-outline" size={20} color="#666" style={styles.authInputIcon} /><TextInput style={styles.authInput} placeholder="Фамилия" placeholderTextColor="#666" value={surname} onChangeText={setSurname} autoCapitalize="words" /></View>
          </>)}
          <View style={styles.authInputWrap}><Ionicons name="call-outline" size={20} color="#666" style={styles.authInputIcon} /><TextInput style={styles.authInput} placeholder="+7 (900) 000-00-00" placeholderTextColor="#666" value={phone} onChangeText={setPhone} keyboardType="phone-pad" /></View>
          <View style={styles.authInputWrap}><Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.authInputIcon} /><TextInput style={styles.authInput} placeholder="Пароль (мин. 6 символов)" placeholderTextColor="#666" value={password} onChangeText={setPassword} secureTextEntry /></View>
          {mode === 'register' && (<>
            <Text style={styles.authRoleLabel}>Выберите роль</Text>
            <View style={styles.authRoleRow}>
              <TouchableOpacity style={[styles.authRoleBtn, role === 'client' && styles.authRoleBtnClient]} onPress={() => setRole('client')}><Ionicons name="person" size={20} color={role === 'client' ? '#fff' : '#3498db'} /><Text style={[styles.authRoleBtnText, role === 'client' && { color: '#fff' }]}>Клиент</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.authRoleBtn, role === 'master' && styles.authRoleBtnMaster]} onPress={() => setRole('master')}><Ionicons name="construct" size={20} color={role === 'master' ? '#fff' : '#e74c3c'} /><Text style={[styles.authRoleBtnText, role === 'master' && { color: '#fff' }]}>Мастер</Text></TouchableOpacity>
            </View>
          </>)}
          <TouchableOpacity style={styles.authSubmitBtn} onPress={handleSubmit} disabled={loading} activeOpacity={0.85}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.authSubmitBtnText}>{mode === 'login' ? 'Войти' : 'Зарегистрироваться'}</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          if (profile) {
            setUser({ id: session.user.id, ...profile });
          }
        }
      } catch (e) {
        console.log('Ошибка сессии:', e);
      } finally {
        setLoading(false);
      }
    };
    checkSession();
  }, []);

  const handleAuth = async (u) => { setUser(u); };
  const handleLogout = async () => { 
    await supabase.auth.signOut();
    setUser(null); 
  };

  if (loading) return (<SafeAreaView style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator color="#3498db" size="large" /></SafeAreaView>);
  if (!user) return <AuthScreen onAuth={handleAuth} />;
  if (user.role === 'client') return <ClientScreen user={user} onExit={handleLogout} />;
  return <MasterScreen user={user} onExit={handleLogout} />;
}

function ClientScreen({ onExit, user }) {
  const [view, setView] = useState('main');
  const [mainTab, setMainTab] = useState('services');
  const [activeCategory, setActiveCategory] = useState(null);
  const [cart, setCart] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedMasterId, setSelectedMasterId] = useState(null);
  const [profile, setProfile] = useState({ ...CLIENT_PROFILE, name: user.name, surname: user.surname, phone: user.phone });
  const [myLocation, setMyLocation] = useState(DEFAULT_LOCATION);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchOrders = async () => {
      const { data, error } = await supabase.from('orders').select('*').eq('client_id', user.id).order('created_at', { ascending: false });
      if (data) {
        setHistory(data.map(o => ({ ...o, date: new Date(o.created_at).toLocaleDateString('ru-RU'), time: new Date(o.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }), masterName: 'Назначенный мастер' })));
      }
    };
    fetchOrders();
  }, [user.id, view]);

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const cartTotal = cart.reduce((s, i) => s + parsePrice(i.price) * i.qty, 0);
  const selectedMaster = selectedMasterId ? MASTERS.find(m => m.id === selectedMasterId) : null;

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const searchResults = normalizedQuery ? SERVICES.filter(s => s.title.toLowerCase().includes(normalizedQuery)) : [];

  const addToCart = (service) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === service.id);
      if (existing) return prev.map(i => i.id === service.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { ...service, qty: 1 }];
    });
  };

  const checkout = async () => {
    if (cart.length === 0) return;
    const finalTotal = cartTotal;
    
    const { error } = await supabase.from('orders').insert({
      client_id: user.id,
      master_id: null, // Пока null, можно добавить логику выбора реального мастера
      total: finalTotal,
      items: cart,
      address: myLocation.text,
      status: 'new',
    });

    if (error) {
      Alert.alert('Ошибка', error.message);
      return;
    }

    setCart([]); setSelectedMasterId(null); setView('main'); setMainTab('history');
    Alert.alert('Заказ оформлен!', `Итого: ${finalTotal.toLocaleString('ru-RU')} ₽`);
  };

  if (view === 'cart') {
    return (
      <SafeAreaView style={styles.clientContainer}>
        <StatusBar barStyle="light-content" />
        <View style={styles.topBarDark}><TouchableOpacity onPress={() => setView('main')}><Ionicons name="arrow-back" size={26} color="#fff" /></TouchableOpacity><Text style={styles.titleLight}>Корзина</Text><View style={{ width: 26 }} /></View>
        {cart.length === 0 ? (<View style={styles.emptyCart}><Ionicons name="cart-outline" size={64} color="#333" /><Text style={styles.emptyCartText}>Корзина пуста</Text></View>) : (
          <>
            <FlatList data={cart} keyExtractor={i => i.id} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 260 }}
              renderItem={({ item }) => (
                <View style={styles.cartItem}>
                  <View style={{ flex: 1 }}><Text style={styles.cartItemTitle}>{item.title}</Text><Text style={styles.cartItemPrice}>{(parsePrice(item.price) * item.qty).toLocaleString('ru-RU')} ₽</Text></View>
                  <Text style={{ color: '#fff', marginRight: 10 }}>x{item.qty}</Text>
                </View>
              )}
            />
            <View style={styles.cartFooter}>
              <View style={styles.cartTotalRow}><Text style={styles.cartTotalLabel}>Итого</Text><Text style={styles.cartTotalValue}>{cartTotal.toLocaleString('ru-RU')} ₽</Text></View>
              <TouchableOpacity style={styles.checkoutBtn} onPress={checkout}><Text style={styles.checkoutBtnText}>Оформить заказ</Text></TouchableOpacity>
            </View>
          </>
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.clientContainer}>
      <StatusBar barStyle="light-content" />
      <View style={styles.clientHeader}>
        <View><Text style={styles.clientHeaderTitle}>Отопление и ремонт</Text><Text style={styles.clientHeaderSubtitle}>Привет, {user.name}!</Text></View>
        <TouchableOpacity onPress={onExit}><Text style={styles.clientExitText}>Выйти</Text></TouchableOpacity>
      </View>
      <View style={styles.segmentRow}>
        <TouchableOpacity style={[styles.segmentBtn, mainTab === 'services' && styles.segmentBtnActive]} onPress={() => setMainTab('services')}><Text style={[styles.segmentText, mainTab === 'services' && styles.segmentTextActive]}>Услуги</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.segmentBtn, mainTab === 'history' && styles.segmentBtnActive]} onPress={() => setMainTab('history')}><Text style={[styles.segmentText, mainTab === 'history' && styles.segmentTextActive]}>История</Text></TouchableOpacity>
      </View>
      
      {mainTab === 'services' && (
        <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((cat, i) => (
              <CategoryCard key={cat.id} category={cat} count={SERVICES.filter(s => s.category === cat.id).length} index={i} onPress={() => { setActiveCategory(cat.id); setView('category'); }} />
            ))}
          </View>
        </ScrollView>
      )}

      {mainTab === 'history' && (
        <FlatList data={history} keyExtractor={o => o.id} contentContainerStyle={{ paddingHorizontal: 16 }}
          ListEmptyComponent={<View style={styles.emptyCart}><Ionicons name="time-outline" size={64} color="#333" /><Text style={styles.emptyCartText}>Заказов пока нет</Text></View>}
          renderItem={({ item: order }) => (
            <View style={styles.historyCard}>
              <View style={styles.historyHeader}>
                <Text style={styles.historyDate}>{order.date} · {order.time}</Text>
                <Text style={styles.historyTotal}>{order.total.toLocaleString('ru-RU')} ₽</Text>
              </View>
              <View style={styles.historyDivider} />
              {order.items.map((it, i) => (<View key={i} style={styles.historyItemRow}><Text style={styles.historyItemName}>{it.title}</Text><Text style={styles.historyItemSum}>{(parsePrice(it.price) * it.qty).toLocaleString('ru-RU')} ₽</Text></View>))}
            </View>
          )} />
      )}
      {cartCount > 0 && mainTab === 'services' && (<TouchableOpacity style={styles.floatingCart} onPress={() => setView('cart')}><Ionicons name="cart" size={22} color="#fff" /><Text style={styles.floatingCartText}>Корзина · {cartTotal.toLocaleString('ru-RU')} ₽</Text></TouchableOpacity>)}
    </SafeAreaView>
  );
}

function MasterScreen({ onExit, user }) {
  const [tab, setTab] = useState('jobs');
  const [jobs, setJobs] = useState([]);
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    const fetchJobs = async () => {
      const { data, error } = await supabase.from('orders').select('*').eq('status', 'new');
      if (data) {
        setJobs(data.map(o => ({ ...o, client: 'Клиент', phone: '+7 (900) 000-00-00', time: 'Сейчас', address: o.address || 'Адрес не указан', items: o.items || [], total: o.total })));
      }
    };
    fetchJobs();
  }, []);

  const updateStatus = async (id, newStatus) => {
    const { error } = await supabase.from('orders').update({ status: newStatus, master_id: user.id }).eq('id', id);
    if (!error) {
      if (newStatus === 'done') {
        setJobs(prev => prev.filter(j => j.id !== id));
      } else {
        setJobs(prev => prev.map(j => j.id === id ? { ...j, status: newStatus } : j));
      }
    }
  };

  return (
    <SafeAreaView style={styles.masterContainer}>
      <StatusBar barStyle="light-content" />
      <View style={styles.topBarDark}>
        <Text style={styles.titleLight}>Мои заявки</Text>
        <TouchableOpacity onPress={onExit}><Ionicons name="exit-outline" size={24} color="#e74c3c" /></TouchableOpacity>
      </View>
      
      <FlatList 
        data={jobs} 
        keyExtractor={item => item.id} 
        contentContainerStyle={{ paddingBottom: 20, paddingHorizontal: 16 }}
        ListEmptyComponent={<View style={{ padding: 40, alignItems: 'center' }}><Ionicons name="checkmark-done-circle" size={64} color="#333" /><Text style={{ color: '#888', marginTop: 16 }}>Новых заявок пока нет</Text></View>}
        renderItem={({ item, index }) => (
          <AnimatedCard index={index} style={styles.jobCardDark}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Заказ на {item.total} ₽</Text>
            <Text style={{ color: '#aaa', marginTop: 6 }}>{item.address}</Text>
            <View style={{ flexDirection: 'row', marginTop: 12, gap: 10 }}>
              <TouchableOpacity style={[styles.statusBtn, { backgroundColor: '#f39c12' }]} onPress={() => updateStatus(item.id, 'on_way')}><Text style={styles.statusBtnText}>В пути</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.statusBtn, { backgroundColor: '#27ae60' }]} onPress={() => updateStatus(item.id, 'done')}><Text style={styles.statusBtnText}>Завершить</Text></TouchableOpacity>
            </View>
          </AnimatedCard>
        )} 
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  authContainer: { flex: 1, backgroundColor: '#000' },
  authScroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  authLogoWrap: { alignItems: 'center', marginBottom: 10 },
  authTitle: { color: '#fff', fontSize: 24, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  authSubtitle: { color: '#888', fontSize: 14, textAlign: 'center', marginBottom: 28 },
  authTabsRow: { flexDirection: 'row', backgroundColor: '#1a1a1a', borderRadius: 12, padding: 4, marginBottom: 20, borderWidth: 0.5, borderColor: '#2a2a2a' },
  authTab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  authTabActive: { backgroundColor: '#3498db' },
  authTabText: { color: '#888', fontSize: 14, fontWeight: '600' },
  authTabTextActive: { color: '#fff' },
  authInputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', borderRadius: 12, paddingHorizontal: 14, marginBottom: 12, borderWidth: 0.5, borderColor: '#2a2a2a' },
  authInputIcon: { marginRight: 10 },
  authInput: { flex: 1, color: '#fff', fontSize: 15, paddingVertical: 14 },
  authRoleLabel: { color: '#888', fontSize: 13, fontWeight: '600', marginTop: 4, marginBottom: 10 },
  authRoleRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  authRoleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, backgroundColor: '#1a1a1a', borderWidth: 1.5, borderColor: '#2a2a2a' },
  authRoleBtnClient: { backgroundColor: '#3498db', borderColor: '#3498db' },
  authRoleBtnMaster: { backgroundColor: '#e74c3c', borderColor: '#e74c3c' },
  authRoleBtnText: { color: '#aaa', fontSize: 15, fontWeight: '700' },
  authSubmitBtn: { backgroundColor: '#27ae60', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  authSubmitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  topBarDark: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 16, paddingHorizontal: 16 },
  titleLight: { fontSize: 24, fontWeight: '700', color: '#fff' },
  clientContainer: { flex: 1, backgroundColor: '#000' },
  clientHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  clientHeaderTitle: { fontSize: 24, fontWeight: '700', color: '#fff' },
  clientHeaderSubtitle: { fontSize: 13, color: '#888', marginTop: 2 },
  clientExitText: { fontSize: 14, color: '#e74c3c', fontWeight: '600', paddingTop: 6 },
  segmentRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 14 },
  segmentBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: '#1a1a1a', alignItems: 'center', borderWidth: 0.5, borderColor: '#2a2a2a' },
  segmentBtnActive: { backgroundColor: '#3498db', borderColor: '#3498db' },
  segmentText: { color: '#aaa', fontSize: 13, fontWeight: '600' },
  segmentTextActive: { color: '#fff' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, justifyContent: 'space-between' },
  categoryCard: { width: '48%', minHeight: 160, borderRadius: 20, marginBottom: 14, borderWidth: 1, overflow: 'hidden' },
  categoryCardInner: { flex: 1, padding: 16, justifyContent: 'space-between' },
  categoryIconCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  categoryCardTitle: { color: '#fff', fontSize: 17, fontWeight: '700', marginTop: 14 },
  categoryCardCount: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  floatingCart: { position: 'absolute', bottom: 20, left: 16, right: 16, backgroundColor: '#27ae60', borderRadius: 30, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  floatingCartText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cartItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', borderRadius: 12, padding: 12, marginBottom: 10 },
  cartItemTitle: { fontSize: 15, fontWeight: '600', color: '#fff' },
  cartItemPrice: { fontSize: 14, fontWeight: '700', color: '#27ae60', marginTop: 2 },
  cartFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#0d0d0d', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 28 },
  cartTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cartTotalLabel: { color: '#aaa', fontSize: 16, fontWeight: '600' },
  cartTotalValue: { color: '#27ae60', fontSize: 22, fontWeight: '700' },
  checkoutBtn: { backgroundColor: '#27ae60', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  checkoutBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  emptyCart: { alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyCartText: { color: '#888', fontSize: 16, marginTop: 16 },
  historyCard: { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 14, marginBottom: 12 },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyDate: { color: '#aaa', fontSize: 13 },
  historyTotal: { color: '#27ae60', fontSize: 16, fontWeight: '700' },
  historyDivider: { height: 0.5, backgroundColor: '#2a2a2a', marginVertical: 10 },
  historyItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  historyItemName: { color: '#fff', fontSize: 14, flex: 1 },
  historyItemSum: { color: '#ccc', fontSize: 14, fontWeight: '600' },
  masterContainer: { flex: 1, backgroundColor: '#000' },
  jobCardDark: { backgroundColor: '#1a1a1a', borderRadius: 14, padding: 16, marginBottom: 12 },
  statusBtn: { flex: 1, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  statusBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  attachOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 100, justifyContent: 'flex-end' },
  attachSheet: { backgroundColor: '#1f2c34', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8, paddingBottom: 22, paddingHorizontal: 22 },
  attachGrabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', marginBottom: 10 },
  attachSheetTitle: { color: '#e9edef', fontSize: 14, fontWeight: '700', marginBottom: 14 },
  attachTilesRow: { flexDirection: 'row', gap: 18, paddingBottom: 2 },
  attachTileWrap: { alignItems: 'center' },
  attachTile: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  attachTileLabel: { color: '#e9edef', fontSize: 11, fontWeight: '600', marginTop: 6 },
});