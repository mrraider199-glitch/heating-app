import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, SafeAreaView, StatusBar, Alert, Linking, ScrollView, Animated, TextInput, KeyboardAvoidingView, Platform, Image, Easing, Vibration, Modal, ActivityIndicator, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { supabase } from './lib/supabase'; // Убедитесь, что файл lib/supabase.js существует и там ваши ключи

const WA_CHAT_BG = '#0b141a';
const WA_BUBBLE_MINE = '#005c4b';
const WA_BUBBLE_OTHER = '#202c33';
const WA_GREEN = '#00a884';
const DEFAULT_LOCATION = { lat: 55.7558, lng: 37.6173, text: 'Москва (по умолчанию)' };

const parsePrice = (str) => {
  if (!str) return 0;
  if (typeof str === 'number') return str;
  const cleaned = String(str).replace(/\s/g, '');
  const match = cleaned.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
};

const cleanPhone = (p) => String(p).replace(/[^\d+]/g, '');

// Категории и услуги
const CATEGORIES = [
  { id: 'service', title: 'Выезд мастера', icon: 'car-sport', color: '#27ae60' },
  { id: 'heating', title: 'Отопление', icon: 'flame', color: '#f39c12' },
  { id: 'boiler', title: 'Котельное', icon: 'settings', color: '#e74c3c' },
  { id: 'water', title: 'Водоснабжение', icon: 'water', color: '#3498db' },
];

const S = (id, category, title, price, icon) => ({ id, category, title, price, icon });
const SERVICES = [
  S('s0', 'service', 'Выезд мастера', '3000 ₽', 'car-outline'),
  S('h1', 'heating', 'Монтаж радиатора (без подводящих сетей)', '4500 ₽', 'thermometer-outline'),
  S('h2', 'heating', 'Монтаж дизайн-радиаторов', '9000 ₽', 'color-palette-outline'),
  S('b1', 'boiler', 'Монтаж настенного газового котла', '13000 ₽', 'flame-outline'),
  S('w1', 'water', 'Монтаж точки водоснабжения', '1300 ₽', 'water-outline'),
];

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
        const { data: authData, error: authError } = await supabase.auth.signUp({ email: fakeEmail, password: password });
        if (authError) throw authError;

        if (authData.user) {
          const { error: profileError } = await supabase.from('profiles').insert({
            id: authData.user.id, role: role, name: name.trim(), surname: surname.trim(), phone: p,
          });
          if (profileError) throw profileError;
          onAuth({ id: authData.user.id, role, name: name.trim(), surname: surname.trim(), phone: p });
        }
      } else {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email: fakeEmail, password: password });
        if (authError) throw authError;

        const { data: profile, error: profileError } = await supabase.from('profiles').select('*').eq('id', authData.user.id).single();
        if (profileError) throw profileError;
        onAuth({ id: authData.user.id, ...profile });
      }
    } catch (e) { 
      Alert.alert('Ошибка', e.message || 'Что-то пошло не так'); 
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.containerBlack}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.authScroll} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'center', marginBottom: 20 }}><Ionicons name="flame" size={60} color="#ff8c42" /></View>
          <Text style={styles.authTitle}>Отопление и ремонт</Text>
          
          <View style={styles.authTabsRow}>
            <TouchableOpacity style={[styles.authTab, mode === 'login' && styles.authTabActive]} onPress={() => setMode('login')}><Text style={[styles.authTabText, mode === 'login' && styles.authTabTextActive]}>Вход</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.authTab, mode === 'register' && styles.authTabActive]} onPress={() => setMode('register')}><Text style={[styles.authTabText, mode === 'register' && styles.authTabTextActive]}>Регистрация</Text></TouchableOpacity>
          </View>

          {mode === 'register' && (
            <>
              <TextInput style={styles.input} placeholder="Имя" placeholderTextColor="#666" value={name} onChangeText={setName} />
              <TextInput style={styles.input} placeholder="Фамилия" placeholderTextColor="#666" value={surname} onChangeText={setSurname} />
            </>
          )}
          <TextInput style={styles.input} placeholder="+7 (900) 000-00-00" placeholderTextColor="#666" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <TextInput style={styles.input} placeholder="Пароль (мин. 6 символов)" placeholderTextColor="#666" value={password} onChangeText={setPassword} secureTextEntry />

          {mode === 'register' && (
            <View style={styles.authRoleRow}>
              <TouchableOpacity style={[styles.authRoleBtn, role === 'client' && styles.authRoleBtnClient]} onPress={() => setRole('client')}><Text style={[styles.authRoleBtnText, role === 'client' && { color: '#fff' }]}>Клиент</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.authRoleBtn, role === 'master' && styles.authRoleBtnMaster]} onPress={() => setRole('master')}><Text style={[styles.authRoleBtnText, role === 'master' && { color: '#fff' }]}>Мастер</Text></TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={styles.btnGreen} onPress={handleSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{mode === 'login' ? 'Войти' : 'Зарегистрироваться'}</Text>}
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
          const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
          if (profile) setUser({ id: session.user.id, ...profile });
        }
      } catch (e) { console.log(e); } finally { setLoading(false); }
    };
    checkSession();
  }, []);

  const handleLogout = async () => { await supabase.auth.signOut(); setUser(null); };

  if (loading) return <View style={[styles.containerBlack, { justifyContent: 'center' }]}><ActivityIndicator color="#3498db" size="large" /></View>;
  if (!user) return <AuthScreen onAuth={setUser} />;
  
  if (user.role === 'client') return <ClientScreen user={user} onExit={handleLogout} />;
  return <MasterScreen user={user} onExit={handleLogout} />;
}

// ================= КЛИЕНТ =================
function ClientScreen({ onExit, user }) {
  const [view, setView] = useState('main'); // main, category, cart, masterSelect, history
  const [activeCategory, setActiveCategory] = useState(null);
  const [cart, setCart] = useState([]);
  const [history, setHistory] = useState([]);
  const [masters, setMasters] = useState([]);
  const [selectedMasterId, setSelectedMasterId] = useState(null);

  const fetchData = async () => {
    // 1. Заказы клиента
    const { data: ordersData } = await supabase.from('orders').select('*, master:profiles!master_id(name, surname)').eq('client_id', user.id).order('created_at', { ascending: false });
    if (ordersData) setHistory(ordersData);
    
    // 2. Реальные мастера из базы
    const { data: mastersData } = await supabase.from('profiles').select('*').eq('role', 'master');
    if (mastersData) setMasters(mastersData);
  };

  useEffect(() => { fetchData(); }, [view]);

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const cartTotal = cart.reduce((s, i) => s + parsePrice(i.price) * i.qty, 0);
  const selectedMaster = masters.find(m => m.id === selectedMasterId);

  const addToCart = (service) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === service.id);
      if (existing) return prev.map(i => i.id === service.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { ...service, qty: 1 }];
    });
  };

  const checkout = async () => {
    if (cart.length === 0) return;
    const { error } = await supabase.from('orders').insert({
      client_id: user.id, master_id: selectedMasterId, total: cartTotal, items: cart, address: 'Москва', status: 'new',
    });
    if (error) { Alert.alert('Ошибка', error.message); return; }
    setCart([]); setSelectedMasterId(null); setView('main'); 
    Alert.alert('Успех', 'Заказ оформлен!');
  };

  const completeOrder = async (orderId) => {
    const { error } = await supabase.from('orders').update({ status: 'done' }).eq('id', orderId);
    if (!error) fetchData(); // Обновляем список
  };

  if (view === 'masterSelect') {
    return (
      <SafeAreaView style={styles.containerBlack}>
        <View style={styles.header}><TouchableOpacity onPress={() => setView('cart')}><Ionicons name="arrow-back" size={26} color="#fff" /></TouchableOpacity><Text style={styles.title}>Выбор мастера</Text><View style={{ width: 26 }} /></View>
        <FlatList data={masters} keyExtractor={m => m.id} contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={<Text style={{ color: '#888', textAlign: 'center', marginTop: 20 }}>Нет доступных мастеров</Text>}
          renderItem={({ item: m }) => (
            <TouchableOpacity style={[styles.cardDark, selectedMasterId === m.id && { borderColor: '#27ae60', borderWidth: 2 }]} onPress={() => { setSelectedMasterId(m.id); setView('cart'); }}>
              <View style={{ flex: 1 }}><Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>{m.name} {m.surname}</Text><Text style={{ color: '#888', marginTop: 4 }}>{m.phone}</Text></View>
              <Ionicons name={selectedMasterId === m.id ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={selectedMasterId === m.id ? '#27ae60' : '#555'} />
            </TouchableOpacity>
          )} />
      </SafeAreaView>
    );
  }

  if (view === 'cart') {
    return (
      <SafeAreaView style={styles.containerBlack}>
        <View style={styles.header}><TouchableOpacity onPress={() => setView('main')}><Ionicons name="arrow-back" size={26} color="#fff" /></TouchableOpacity><Text style={styles.title}>Корзина</Text><View style={{ width: 26 }} /></View>
        {cart.length === 0 ? (<View style={{ padding: 40, alignItems: 'center' }}><Text style={{ color: '#888' }}>Пусто</Text></View>) : (
          <>
            <FlatList data={cart} keyExtractor={i => i.id} contentContainerStyle={{ padding: 16 }}
              ListFooterComponent={
                <View style={styles.cardDark}>
                  <Text style={{ color: '#fff', fontSize: 16, marginBottom: 10 }}>Мастер:</Text>
                  {selectedMaster ? (
                    <TouchableOpacity onPress={() => setView('masterSelect')} style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: '#3498db' }}>{selectedMaster.name}</Text><Text style={{ color: '#aaa' }}>Изменить</Text></TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={styles.btnBlue} onPress={() => setView('masterSelect')}><Text style={styles.btnText}>Выбрать мастера</Text></TouchableOpacity>
                  )}
                </View>
              }
              renderItem={({ item }) => (
                <View style={styles.cardDark}><Text style={{ color: '#fff' }}>{item.title}</Text><Text style={{ color: '#27ae60', fontWeight: 'bold' }}>{item.price} x{item.qty}</Text></View>
              )}
            />
            <View style={styles.footer}>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>Итого: {cartTotal} ₽</Text>
              <TouchableOpacity style={styles.btnGreen} onPress={checkout}><Text style={styles.btnText}>Оформить заказ</Text></TouchableOpacity>
            </View>
          </>
        )}
      </SafeAreaView>
    );
  }

  if (view === 'category') {
    const services = SERVICES.filter(s => s.category === activeCategory);
    return (
      <SafeAreaView style={styles.containerBlack}>
        <View style={styles.header}><TouchableOpacity onPress={() => setView('main')}><Ionicons name="arrow-back" size={26} color="#fff" /></TouchableOpacity><Text style={styles.title}>Услуги</Text><View style={{ width: 26 }} /></View>
        <FlatList data={services} keyExtractor={item => item.id} contentContainerStyle={{ padding: 16 }} renderItem={({ item }) => (
          <View style={styles.cardDark}>
            <View style={{ flex: 1 }}><Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>{item.title}</Text><Text style={{ color: '#27ae60', fontWeight: 'bold', marginTop: 4 }}>{item.price}</Text></View>
            <TouchableOpacity style={styles.btnBlue} onPress={() => addToCart(item)}><Ionicons name="add" size={20} color="#fff" /></TouchableOpacity>
          </View>
        )} />
        {cartCount > 0 && (<TouchableOpacity style={styles.floatingCart} onPress={() => setView('cart')}><Text style={styles.btnText}>Корзина ({cartCount})</Text></TouchableOpacity>)}
      </SafeAreaView>
    );
  }

  // Главный экран (вкладки Услуги / История)
  return (
    <SafeAreaView style={styles.containerBlack}>
      <View style={styles.header}>
        <Text style={styles.title}>Привет, {user.name}</Text>
        <TouchableOpacity onPress={onExit}><Ionicons name="exit-outline" size={24} color="#e74c3c" /></TouchableOpacity>
      </View>
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 10 }}>
        <TouchableOpacity style={styles.tabBtn} onPress={() => setView('main')}><Text style={{ color: '#fff' }}>Услуги</Text></TouchableOpacity>
        <TouchableOpacity style={styles.tabBtn} onPress={() => setView('history')}><Text style={{ color: '#fff' }}>История</Text></TouchableOpacity>
      </View>

      {view === 'history' ? (
         <FlatList data={history} keyExtractor={o => o.id} contentContainerStyle={{ padding: 16 }}
            ListEmptyComponent={<Text style={{ color: '#888', textAlign: 'center' }}>Нет заказов</Text>}
            renderItem={({ item }) => (
              <View style={styles.cardDark}>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Заказ на {item.total} ₽</Text>
                <Text style={{ color: '#aaa', fontSize: 12, marginTop: 4 }}>Мастер: {item.master ? item.master.name : 'Не выбран'}</Text>
                <Text style={{ color: '#3498db', marginTop: 4 }}>Статус: {item.status}</Text>
                
                {item.status !== 'done' && (
                   <TouchableOpacity style={[styles.btnGreen, { marginTop: 10 }]} onPress={() => completeOrder(item.id)}><Text style={styles.btnText}>Завершить заказ</Text></TouchableOpacity>
                )}
              </View>
            )}
         />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          {CATEGORIES.map(cat => (
             <TouchableOpacity key={cat.id} style={[styles.catCard, { backgroundColor: cat.color + '22', borderColor: cat.color }]} onPress={() => { setActiveCategory(cat.id); setView('category'); }}>
               <Ionicons name={cat.icon} size={30} color={cat.color} />
               <Text style={{ color: '#fff', marginTop: 10, fontWeight: 'bold' }}>{cat.title}</Text>
             </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ================= МАСТЕР =================
function MasterScreen({ onExit, user }) {
  const [jobs, setJobs] = useState([]);
  const [tab, setTab] = useState('jobs'); // jobs, profile

  const fetchJobs = async () => {
    const { data } = await supabase.from('orders').select('*, client:profiles!client_id(name, phone)').eq('master_id', user.id).neq('status', 'done');
    if (data) setJobs(data);
  };

  useEffect(() => { fetchJobs(); }, [tab]);

  const updateStatus = async (id, newStatus) => {
    await supabase.from('orders').update({ status: newStatus }).eq('id', id);
    fetchJobs();
  };

  return (
    <SafeAreaView style={styles.containerBlack}>
      <View style={styles.header}>
        <Text style={styles.title}>Кабинет мастера</Text>
        <TouchableOpacity onPress={onExit}><Ionicons name="exit-outline" size={24} color="#e74c3c" /></TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 10 }}>
        <TouchableOpacity style={styles.tabBtn} onPress={() => setTab('jobs')}><Text style={{ color: '#fff' }}>Заявки</Text></TouchableOpacity>
        <TouchableOpacity style={styles.tabBtn} onPress={() => setTab('profile')}><Text style={{ color: '#fff' }}>Профиль</Text></TouchableOpacity>
      </View>

      {tab === 'profile' ? (
        <View style={styles.cardDark}>
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold' }}>{user.name} {user.surname}</Text>
          <Text style={{ color: '#aaa', marginTop: 5 }}>{user.phone}</Text>
        </View>
      ) : (
        <FlatList data={jobs} keyExtractor={i => i.id} contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={<Text style={{ color: '#888', textAlign: 'center', marginTop: 20 }}>Нет активных заявок</Text>}
          renderItem={({ item }) => (
            <View style={styles.cardDark}>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Клиент: {item.client?.name || 'Без имени'}</Text>
              <Text style={{ color: '#3498db', marginTop: 4 }}>Тел: {item.client?.phone}</Text>
              <Text style={{ color: '#27ae60', fontWeight: 'bold', marginTop: 8 }}>Сумма: {item.total} ₽</Text>
              
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 15 }}>
                <TouchableOpacity style={[styles.btnOrange, { flex: 1 }]} onPress={() => updateStatus(item.id, 'on_way')}><Text style={styles.btnText}>В пути</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.btnBlue, { flex: 1 }]} onPress={() => updateStatus(item.id, 'on_site')}><Text style={styles.btnText}>На объекте</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.btnGreen, { flex: 1 }]} onPress={() => updateStatus(item.id, 'done')}><Text style={styles.btnText}>Сделано</Text></TouchableOpacity>
              </View>
            </View>
          )} />
      )}
    </SafeAreaView>
  );
}

// ================= СТИЛИ =================
const styles = StyleSheet.create({
  containerBlack: { flex: 1, backgroundColor: '#000' },
  authScroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  authTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 30 },
  authTabsRow: { flexDirection: 'row', backgroundColor: '#1a1a1a', borderRadius: 10, marginBottom: 20 },
  authTab: { flex: 1, padding: 12, alignItems: 'center' },
  authTabActive: { backgroundColor: '#3498db', borderRadius: 10 },
  authTabText: { color: '#888', fontWeight: 'bold' },
  authTabTextActive: { color: '#fff' },
  input: { backgroundColor: '#1a1a1a', borderRadius: 10, padding: 15, color: '#fff', marginBottom: 12 },
  authRoleRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  authRoleBtn: { flex: 1, padding: 15, borderRadius: 10, backgroundColor: '#1a1a1a', alignItems: 'center' },
  authRoleBtnClient: { backgroundColor: '#3498db' },
  authRoleBtnMaster: { backgroundColor: '#e74c3c' },
  authRoleBtnText: { color: '#888', fontWeight: 'bold' },
  btnGreen: { backgroundColor: '#27ae60', padding: 15, borderRadius: 10, alignItems: 'center' },
  btnBlue: { backgroundColor: '#3498db', padding: 15, borderRadius: 10, alignItems: 'center' },
  btnOrange: { backgroundColor: '#f39c12', padding: 15, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  title: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  cardDark: { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16, marginBottom: 12 },
  tabBtn: { flex: 1, padding: 10, backgroundColor: '#1a1a1a', alignItems: 'center', borderRadius: 8 },
  catCard: { width: '48%', padding: 20, borderRadius: 15, borderWidth: 1, marginBottom: 15, alignItems: 'center' },
  floatingCart: { position: 'absolute', bottom: 20, left: 16, right: 16, backgroundColor: '#27ae60', padding: 15, borderRadius: 30, alignItems: 'center' },
  footer: { padding: 16, backgroundColor: '#1a1a1a', borderTopWidth: 1, borderColor: '#333' }
});