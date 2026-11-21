import React, { useState, useRef, useEffect } from 'react';
import { SafeAreaView, StatusBar, View, Text, FlatList, TouchableOpacity, ScrollView, TextInput, Alert, Linking, Animated, KeyboardAvoidingView, Platform, Keyboard, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioRecorder, AudioModule, RecordingPresets, setAudioModeAsync } from 'expo-audio';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { supabase } from '../config/supabase';
import { MASTER_PROFILE, INITIAL_REVIEWS, INITIAL_MESSAGES, RANKS, DEFAULT_LOCATION, WA_TICK, WA_GREEN } from '../constants';
import { getRank, getMonthKey, getDistanceMeters, reverseGeocodeToAddress, parsePrice, getCommissionAmount, formatCommissionPct, formatSec, renderStars } from '../utils';
import { AnimatedCard } from '../components/AnimatedUI';
import { ChatWallpaper, AttachPanel, VoiceMessage, VideoMessage } from '../components/ChatUI';
import ProfileCard from '../components/ProfileCard';
import styles from '../styles';

const statusColor = (status) => {
  switch (status) {
    case 'new': return { backgroundColor: '#e74c3c' };
    case 'on_way': return { backgroundColor: '#f39c12' };
    case 'on_site': return { backgroundColor: '#3498db' };
    case 'done': return { backgroundColor: '#27ae60' };
    default: return { backgroundColor: '#95a5a6' };
  }
};

const STATUS_LABELS = { new: 'Новая', on_way: 'В пути', on_site: 'На объекте', done: 'Завершена' };

export default function MasterScreen({ onExit, user }) {
  const [tab, setTab] = useState('jobs');
  const [isAvailable, setIsAvailable] = useState(true);
  const isAvailableRef = useRef(true);
  const [jobs, setJobs] = useState([]);
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [draft, setDraft] = useState('');
  const [showAttach, setShowAttach] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [profile, setProfile] = useState(user ? { ...MASTER_PROFILE, name: user.name || MASTER_PROFILE.name, surname: user.surname || MASTER_PROFILE.surname, phone: user.phone || MASTER_PROFILE.phone } : MASTER_PROFILE);
  const [reviews] = useState(INITIAL_REVIEWS);
  const [notification, setNotification] = useState(null);
  const [unseenCount, setUnseenCount] = useState(0);
  const [earningsToday, setEarningsToday] = useState(0);
  const [earningsMonth, setEarningsMonth] = useState(0);
  const [ordersHistory, setOrdersHistory] = useState([]);
  const [monthKey, setMonthKey] = useState(getMonthKey());
  const [myLocation, setMyLocation] = useState(DEFAULT_LOCATION);

  const chatListRef = useRef(null);
  const timerRef = useRef(null);
  const notifOpacity = useRef(new Animated.Value(0)).current;
  const notifTranslate = useRef(new Animated.Value(-120)).current;
  const notifHideRef = useRef(null);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  useEffect(() => { setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true }).catch(() => {}); }, []);
  useEffect(() => { isAvailableRef.current = isAvailable; }, [isAvailable]);
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); if (notifHideRef.current) clearTimeout(notifHideRef.current); }, []);

  useEffect(() => {
    (async () => {
      try {
        const Location = await import('expo-location');
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const addr = await reverseGeocodeToAddress(loc.coords.latitude, loc.coords.longitude);
        setMyLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude, text: addr || `${loc.coords.latitude.toFixed(4)}, ${loc.coords.longitude.toFixed(4)}` });
      } catch (e) {}
    })();
  }, []);

  // Загружаем ОТКРЫТЫЕ заказы + СВОИ активные
  const loadJobs = async () => {
    try {
      const { data: openJobs, error: e1 } = await supabase
        .from('orders')
        .select('*, client:profiles!client_id(name, phone, surname)')
        .is('master_id', null)
        .eq('status', 'new')
        .order('created_at', { ascending: false });

      if (e1) console.log('open jobs error:', e1.message);

      const { data: myJobs, error: e2 } = await supabase
        .from('orders')
        .select('*, client:profiles!client_id(name, phone, surname)')
        .eq('master_id', user.id)
        .neq('status', 'done')
        .order('created_at', { ascending: false });

      if (e2) console.log('my jobs error:', e2.message);

      const all = [...(openJobs || []), ...(myJobs || [])];

      setJobs(all.map(o => ({
        id: o.id,
        client: o.client ? `${o.client.name || ''} ${o.client.surname || ''}`.trim() || 'Клиент' : 'Клиент',
        phone: o.client?.phone || '',
        address: o.address || '',
        lat: Number(o.lat) || 55.7558,
        lng: Number(o.lng) || 37.6173,
        time: new Date(o.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        status: o.status,
        items: o.items || [],
        total: o.total || 0,
        tip: o.tip || 0,
        masterId: o.master_id,
      })));
    } catch (e) {
      console.log('loadJobs error:', e.message);
    }
  };

  // Взять заказ (с защитой от гонки)
  const acceptOrder = async (id) => {
    const { data, error } = await supabase
      .from('orders')
      .update({ master_id: user.id, status: 'on_way' })
      .eq('id', id)
      .is('master_id', null)
      .eq('status', 'new')
      .select();

    if (error) {
      Alert.alert('Ошибка', error.message);
      return;
    }
    if (!data || data.length === 0) {
      Alert.alert('Уже занят', 'Этот заказ уже взял другой мастер.');
      loadJobs();
      return;
    }
    setJobs(prev => prev.map(j => j.id === id ? { ...j, status: 'on_way', masterId: user.id } : j));
    Alert.alert('Заказ взят!', 'Статус: В пути. Свяжитесь с клиентом.');
  };

  const loadHistory = async () => {
    const { data } = await supabase.from('orders').select('*, client:profiles!client_id(name, surname)').eq('master_id', user.id).eq('status', 'done').order('created_at', { ascending: false });
    if (data) setOrdersHistory(data.map(o => ({
      id: o.id,
      client: o.client ? `${o.client.name || ''} ${o.client.surname || ''}`.trim() || 'Клиент' : 'Клиент',
      date: new Date(o.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }),
      amount: o.total || 0,
      tip: o.tip || 0,
      items: (o.items || []).map(it => ({ title: it.title, qty: it.qty, price: parsePrice(it.price) })),
    })));
  };

  useEffect(() => {
    loadJobs(); loadHistory();
    const ch = supabase.channel('master-jobs-' + user.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        loadJobs(); loadHistory();
        if (payload.eventType === 'INSERT' && payload.new?.status === 'new' && !payload.new?.master_id) {
          showNotification({
            client: payload.new?.address || 'Новый клиент',
            total: payload.new?.total || 0,
            tip: payload.new?.tip || 0,
          });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user.id]);

  useEffect(() => {
    const checkReset = () => { const current = getMonthKey(); if (monthKey !== current) { setEarningsToday(0); setEarningsMonth(0); setMonthKey(current); } };
    checkReset();
    const interval = setInterval(checkReset, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [monthKey]);

  useEffect(() => { if (tab === 'jobs') setUnseenCount(0); }, [tab]);
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setShowAttach(false));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {});
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const showNotification = (job) => {
    if (notifHideRef.current) clearTimeout(notifHideRef.current);
    setNotification(job);
    Animated.parallel([Animated.timing(notifOpacity, { toValue: 1, duration: 300, useNativeDriver: true }), Animated.spring(notifTranslate, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 8 })]).start();
    notifHideRef.current = setTimeout(() => { Animated.parallel([Animated.timing(notifOpacity, { toValue: 0, duration: 300, useNativeDriver: true }), Animated.timing(notifTranslate, { toValue: -120, duration: 300, useNativeDriver: true })]).start(() => setNotification(null)); }, 5000);
  };

  const hideNotification = () => {
    if (notifHideRef.current) clearTimeout(notifHideRef.current);
    Animated.parallel([Animated.timing(notifOpacity, { toValue: 0, duration: 200, useNativeDriver: true }), Animated.timing(notifTranslate, { toValue: -120, duration: 200, useNativeDriver: true })]).start(() => setNotification(null));
  };

  const updateStatus = async (id, newStatus) => {
    const job = jobs.find(j => j.id === id); if (!job) return;
    const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', id);
    if (error) { Alert.alert('Ошибка', error.message); return; }
    if (newStatus === 'done') {
      const earned = job.total + (job.tip || 0);
      try {
        const { data: prof } = await supabase.from('profiles').select('orders_done, balance').eq('id', user.id).single();
        await supabase.from('profiles').update({
          orders_done: (prof?.orders_done || 0) + 1,
          balance: (prof?.balance || 0) + earned,
        }).eq('id', user.id);
      } catch (e) { console.log('profile update err:', e.message); }
      setProfile(p => ({ ...p, ordersDone: (p.ordersDone || 0) + 1, balance: (p.balance || 0) + earned }));
      setEarningsToday(p => p + earned); setEarningsMonth(p => p + earned);
      setJobs(prev => prev.filter(j => j.id !== id)); loadHistory(); return;
    }
    setJobs(prev => prev.map(j => (j.id === id ? { ...j, status: newStatus } : j)));
  };

  const callClient = (phone) => Linking.openURL(`tel:${phone}`).catch(() => Alert.alert('Ошибка', 'Не удалось открыть звонилку'));
  const openMap = (address) => Linking.openURL(`https://yandex.ru/maps/?text=${encodeURIComponent(address)}`).catch(() => Alert.alert('Ошибка', 'Не удалось открыть карты'));

  const addMessage = (payload) => { const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }); setMessages(prev => [...prev, { id: `m${Date.now()}-${Math.random()}`, author: 'Вы', time, mine: true, read: false, ...payload }]); };
  const sendMessage = () => { const text = draft.trim(); if (!text) return; addMessage({ type: 'text', text }); setDraft(''); };

  const pickPhoto = async () => {
    setShowAttach(false);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Нужно разрешение', 'Разрешите доступ к галерее');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled) addMessage({ type: 'image', uri: result.assets[0].uri });
  };

  const pickVideo = async () => {
    setShowAttach(false);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Нужно разрешение', 'Разрешите доступ к галерее');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'] });
    if (!result.canceled) addMessage({ type: 'video', uri: result.assets[0].uri });
  };

  const startRecording = async () => {
    setShowAttach(false);
    const perm = await AudioModule.requestRecordingPermissionsAsync();
    if (!perm.granted) return Alert.alert('Нужно разрешение', 'Разрешите доступ к микрофону');
    try {
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setIsRecording(true); setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch (e) { Alert.alert('Ошибка записи', String(e.message || e)); }
  };

  const stopRecordingAndSend = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      await audioRecorder.stop();
      const rawUri = audioRecorder.uri;
      const dur = recordingTime;
      setIsRecording(false); setRecordingTime(0);
      if (!rawUri || dur <= 0) return Alert.alert('Ошибка', 'Запись слишком короткая.');
      try { const info = await FileSystem.getInfoAsync(rawUri); if (!info.exists || info.size === 0) return Alert.alert('Ошибка', 'Аудиофайл пустой.'); } catch (e) {}
      addMessage({ type: 'voice', uri: rawUri, duration: dur });
    } catch (e) { Alert.alert('Ошибка', String(e.message || e)); }
  };

  const cancelRecording = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    try { await audioRecorder.stop(); } catch {}
    setIsRecording(false); setRecordingTime(0);
  };

  const renderJob = ({ item, index }) => {
    const services = item.total; const tip = item.tip || 0; const grandTotal = services + tip;
    const distance = (item.lat && item.lng) ? getDistanceMeters(myLocation.lat, myLocation.lng, item.lat, item.lng) : null;
    const isOpen = item.status === 'new' && !item.masterId;

    return (
      <AnimatedCard index={index} style={styles.jobCardDark}>
        {isOpen && (
          <View style={{ backgroundColor: 'rgba(231,76,60,0.15)', borderRadius: 8, padding: 8, marginBottom: 10, flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="flame" size={16} color="#e74c3c" />
            <Text style={{ color: '#e74c3c', fontSize: 12, fontWeight: '700', marginLeft: 6 }}>НОВЫЙ ЗАКАЗ — возьмите первым!</Text>
          </View>
        )}
        <View style={styles.jobHeaderRow}>
          <View style={styles.clientBlock}>
            <View style={styles.clientAvatarSmall}><Text style={styles.clientAvatarText}>{(item.client || 'К').charAt(0)}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.jobClientLabel}>КЛИЕНТ</Text>
              <Text style={styles.jobClient}>{item.client}</Text>
              <View style={styles.clientPhoneRow}><Ionicons name="call" size={11} color="#3498db" /><Text style={styles.clientPhone}> {item.phone}</Text></View>
            </View>
          </View>
          <View style={[styles.badge, statusColor(item.status)]}><Text style={styles.badgeText}>{STATUS_LABELS[item.status]}</Text></View>
        </View>
        <View style={styles.metaRow}>
          <View style={styles.metaItem}><Ionicons name="time-outline" size={14} color="#888" /><Text style={styles.metaText}> {item.time}</Text></View>
          <View style={[styles.metaItem, { flex: 1 }]}><Ionicons name="location-outline" size={14} color="#888" /><Text style={styles.metaText} numberOfLines={1}> {item.address || 'Адрес не указан'}</Text></View>
        </View>
        {distance !== null && (<View style={styles.distanceRow}><Ionicons name="navigate" size={14} color="#3498db" /><Text style={styles.distanceText}> До клиента: <Text style={styles.distanceValue}>{(distance < 1000 ? `${distance} м` : `${(distance / 1000).toFixed(1)} км`)}</Text> от вас</Text></View>)}
        <View style={styles.itemsBlock}>
          <Text style={styles.itemsBlockTitle}>Что заказано:</Text>
          {item.items && item.items.map((it, i) => {
            const unit = parsePrice(it.price); const lineSum = unit * it.qty;
            return (
              <View key={i} style={styles.itemLine}>
                <View style={{ flex: 1 }}><Text style={styles.itemLineName}>{it.title}{it.qty > 1 ? `×${it.qty}` : ''}</Text><Text style={styles.itemLineUnit}>{unit.toLocaleString('ru-RU')} ₽ за шт{it.qty > 1 ? `× ${it.qty}` : ''}</Text></View>
                <Text style={styles.itemLineSum}>{lineSum.toLocaleString('ru-RU')} ₽</Text>
              </View>
            );
          })}
        </View>
        <View style={styles.priceBlock}>
          <View style={styles.priceRow}><Text style={styles.priceRowLabel}>Услуги</Text><Text style={styles.priceRowValue}>{services.toLocaleString('ru-RU')} ₽</Text></View>
          {tip > 0 && (<View style={styles.priceRow}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Ionicons name="heart" size={12} color="#e74c3c" /><Text style={styles.priceRowLabel}> Чаевые</Text></View><Text style={[styles.priceRowValue, { color: '#e74c3c' }]}>+{tip.toLocaleString('ru-RU')} ₽</Text></View>)}
          <View style={styles.priceDivider} />
          <View style={styles.priceTotalRow}><Text style={styles.priceTotalLabel}>К оплате</Text><Text style={styles.priceTotalValue}>{grandTotal.toLocaleString('ru-RU')} ₽</Text></View>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.btnDark} onPress={() => callClient(item.phone)} disabled={!item.phone}><Ionicons name="call-outline" size={16} color="#fff" style={{ marginRight: 6 }} /><Text style={styles.btnDarkText}>Позвонить</Text></TouchableOpacity>
          <TouchableOpacity style={styles.btnDark} onPress={() => openMap(item.address)} disabled={!item.address}><Ionicons name="navigate-outline" size={16} color="#fff" style={{ marginRight: 6 }} /><Text style={styles.btnDarkText}>Маршрут</Text></TouchableOpacity>
        </View>
        <View style={styles.statusRow}>
          {isOpen && (
            <TouchableOpacity
              style={[styles.statusBtn, { backgroundColor: '#27ae60' }]}
              onPress={() => acceptOrder(item.id)}
            >
              <Text style={styles.statusBtnText}>🤝 Взять заказ</Text>
            </TouchableOpacity>
          )}
          {item.masterId === user.id && item.status === 'on_way' && (<TouchableOpacity style={[styles.statusBtn, { backgroundColor: '#3498db' }]} onPress={() => updateStatus(item.id, 'on_site')}><Text style={styles.statusBtnText}>На объекте</Text></TouchableOpacity>)}
          {item.masterId === user.id && item.status === 'on_site' && (<TouchableOpacity style={[styles.statusBtn, { backgroundColor: '#27ae60' }]} onPress={() => updateStatus(item.id, 'done')}><Text style={styles.statusBtnText}>Завершить</Text></TouchableOpacity>)}
        </View>
      </AnimatedCard>
    );
  };

  const renderMessage = ({ item }) => {
    if (item.type === 'date') return (<View style={styles.dateSeparatorWrap}><View style={styles.dateSeparator}><Text style={styles.dateSeparatorText}>{item.text}</Text></View></View>);
    const isMine = item.mine;
    const rowStyle = [styles.waMessageRow, isMine ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }];
    if (item.type === 'image' || item.type === 'video') {
      return (<View style={rowStyle}><View style={[styles.waMediaBubble, isMine ? styles.waMediaBubbleMine : styles.waMediaBubbleOther]}>{!isMine && <Text style={styles.waAuthor}>{item.author}</Text>}{item.type === 'image' ? <Image source={{ uri: item.uri }} style={styles.waMediaImage} /> : <VideoMessage uri={item.uri} />}<View style={styles.waMediaFooter}><Text style={styles.waTime}>{item.time}</Text>{isMine && (<Ionicons name={item.read ? 'checkmark-done' : 'checkmark'} size={14} color={item.read ? WA_TICK : 'rgba(255,255,255,0.6)'} style={{ marginLeft: 4 }} />)}</View></View></View>);
    }
    if (item.type === 'voice') {
      return (<View style={rowStyle}><View style={[styles.waBubble, isMine ? styles.waBubbleMine : styles.waBubbleOther]}>{!isMine && <Text style={styles.waAuthor}>{item.author}</Text>}<VoiceMessage uri={item.uri} duration={item.duration} /><View style={styles.waBubbleFooterInline}><Text style={styles.waTime}>{item.time}</Text>{isMine && (<Ionicons name={item.read ? 'checkmark-done' : 'checkmark'} size={14} color={item.read ? WA_TICK : 'rgba(255,255,255,0.6)'} style={{ marginLeft: 4 }} />)}</View></View></View>);
    }
    return (<View style={rowStyle}><View style={[styles.waBubble, isMine ? styles.waBubbleMine : styles.waBubbleOther]}>{!isMine && <Text style={styles.waAuthor}>{item.author}</Text>}<Text style={styles.waText}>{item.text}</Text><View style={styles.waBubbleFooterInline}><Text style={styles.waTime}>{item.time}</Text>{isMine && (<Ionicons name={item.read ? 'checkmark-done' : 'checkmark'} size={14} color={item.read ? WA_TICK : 'rgba(255,255,255,0.6)'} style={{ marginLeft: 4 }} />)}</View></View></View>);
  };

  const rank = getRank(profile.ordersDone);
  const monthCommission = ordersHistory.reduce((s, o) => s + getCommissionAmount(o.amount), 0);
  const monthNet = earningsMonth - monthCommission;

  return (
    <SafeAreaView style={styles.masterContainer}>
      <StatusBar barStyle="light-content" />
      {notification && (
        <Animated.View style={[styles.notificationBanner, { opacity: notifOpacity, transform: [{ translateY: notifTranslate }] }]}>
          <View style={styles.notificationIcon}><Ionicons name="notifications" size={22} color="#fff" /></View>
          <View style={{ flex: 1 }}><Text style={styles.notificationTitle}>Новый заказ!</Text><Text style={styles.notificationText} numberOfLines={2}>{notification.client} · {(notification.total + (notification.tip || 0)).toLocaleString('ru-RU')} ₽</Text></View>
          <TouchableOpacity onPress={() => { setTab('jobs'); hideNotification(); }} hitSlop={8}><Ionicons name="chevron-forward" size={22} color="#fff" /></TouchableOpacity>
          <TouchableOpacity onPress={hideNotification} hitSlop={8} style={{ marginLeft: 10 }}><Ionicons name="close" size={20} color="rgba(255,255,255,0.7)" /></TouchableOpacity>
        </Animated.View>
      )}
      <View style={styles.topBarDark}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.titleLight}>{tab === 'jobs' ? 'Мои заявки' : tab === 'chat' ? 'Чат мастеров' : 'Мой профиль'}</Text>
          {tab === 'profile' && (<View style={[styles.headerRankBadge, { backgroundColor: rank.color }]}><Ionicons name={rank.icon} size={12} color="#fff" /></View>)}
        </View>
        <TouchableOpacity onPress={onExit}><Ionicons name="exit-outline" size={24} color="#e74c3c" /></TouchableOpacity>
      </View>
      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tabBtn, tab === 'jobs' && styles.tabBtnActive]} onPress={() => setTab('jobs')}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}><Text style={[styles.tabText, tab === 'jobs' && styles.tabTextActive]}>Заявки</Text>{unseenCount > 0 && tab !== 'jobs' && (<View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{unseenCount}</Text></View>)}</View>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, tab === 'chat' && styles.tabBtnActive]} onPress={() => setTab('chat')}><Text style={[styles.tabText, tab === 'chat' && styles.tabTextActive]}>Чат</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, tab === 'profile' && styles.tabBtnActive]} onPress={() => setTab('profile')}><Text style={[styles.tabText, tab === 'profile' && styles.tabTextActive]}>Профиль</Text></TouchableOpacity>
      </View>

      {tab === 'jobs' ? (
        <FlatList data={jobs} keyExtractor={item => item.id} renderItem={renderJob} contentContainerStyle={{ paddingBottom: 20, paddingHorizontal: 16 }} ListEmptyComponent={<View style={styles.emptyCart}><Ionicons name="briefcase-outline" size={64} color="#333" /><Text style={styles.emptyCartText}>Нет активных заявок</Text><Text style={{ color: '#666', fontSize: 12, marginTop: 8, textAlign: 'center' }}>Новые заказы клиентов появятся здесь автоматически</Text></View>} />
      ) : tab === 'profile' ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          <View style={{ paddingHorizontal: 16 }}>
            <ProfileCard profile={profile} onSave={setProfile} isMaster={true} commissionAmount={monthCommission} />
            <TouchableOpacity activeOpacity={0.85} style={[styles.availabilityCard, isAvailable ? styles.availabilityActive : styles.availabilityBusy]} onPress={() => setIsAvailable(!isAvailable)}>
              <View style={[styles.availabilityIconWrap, { backgroundColor: isAvailable ? 'rgba(39,174,96,0.15)' : 'rgba(243,156,18,0.15)' }]}><Ionicons name={isAvailable ? 'checkmark-circle' : 'pause-circle'} size={26} color={isAvailable ? '#27ae60' : '#f39c12'} /></View>
              <View style={{ flex: 1 }}><Text style={styles.availabilityTitle}>{isAvailable ? 'Принимаю заказы' : 'На работе'}</Text><Text style={styles.availabilitySub}>{isAvailable ? 'Вы свободны — заказы приходят' : 'Заказы не приходят'}</Text></View>
              <View style={[styles.availabilityToggle, isAvailable && styles.availabilityToggleOn]}><View style={[styles.availabilityKnob, isAvailable && styles.availabilityKnobOn]} /></View>
            </TouchableOpacity>
          </View>
          <View style={{ paddingHorizontal: 16 }}>
            <View style={styles.locationCard}><Ionicons name="location" size={18} color="#3498db" /><View style={{ flex: 1 }}><Text style={styles.locationLabel}>Текущая геолокация</Text><Text style={styles.locationValue}>{myLocation.text}</Text></View></View>
            <View style={styles.earningsCard}>
              <Text style={styles.earningsTitle}>Заработок</Text>
              <View style={styles.earningsRow}>
                <View style={styles.earningsBlock}><Text style={styles.earningsLabel}>Сегодня</Text><Text style={styles.earningsValue}>{earningsToday.toLocaleString('ru-RU')} ₽</Text></View>
                <View style={styles.earningsDivider} />
                <View style={styles.earningsBlock}><Text style={styles.earningsLabel}>За месяц</Text><Text style={[styles.earningsValue, { color: '#27ae60' }]}>{earningsMonth.toLocaleString('ru-RU')} ₽</Text></View>
              </View>
              <View style={styles.commissionBox}>
                <View style={styles.commissionRow}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}><Ionicons name="wallet-outline" size={15} color="#f39c12" /><Text style={styles.commissionLabel}>Комиссия сервиса</Text></View><Text style={styles.commissionValue}>−{monthCommission.toLocaleString('ru-RU')} ₽</Text></View>
                <View style={styles.commissionDivider} />
                <View style={styles.commissionRow}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}><Ionicons name="checkmark-circle" size={15} color="#27ae60" /><Text style={[styles.commissionLabel, { color: '#fff', fontWeight: '700' }]}>К выплате вам</Text></View><Text style={[styles.commissionValue, { color: '#27ae60', fontSize: 17 }]}>{monthNet.toLocaleString('ru-RU')} ₽</Text></View>
              </View>
              <View style={styles.earningsHintRow}><Ionicons name="information-circle-outline" size={12} color="#f39c12" /><Text style={[styles.earningsHint, { color: '#f39c12' }]}> До 6000 ₽ — 7% • свыше 6000 ₽ — 5%</Text></View>
              <View style={styles.earningsHintRow}><Ionicons name="calendar-outline" size={12} color="#888" /><Text style={styles.earningsHint}> Месячная статистика обнуляется 1-го числа</Text></View>
            </View>
            <Text style={styles.sectionTitle}>История заказов ({ordersHistory.length})</Text>
            {ordersHistory.length === 0 ? (<Text style={styles.emptyReviews}>Пока нет завершённых заказов</Text>) : ordersHistory.map((order, i) => {
              const orderCommission = getCommissionAmount(order.amount);
              const orderNet = order.amount - orderCommission + (order.tip || 0);
              return (
                <AnimatedCard key={order.id} index={i} style={styles.masterHistoryCard}>
                  <View style={styles.masterHistoryHeader}><Text style={styles.masterHistoryClient}>{order.client}</Text><Text style={styles.masterHistoryAmount}>{order.amount.toLocaleString('ru-RU')} ₽</Text></View>
                  <Text style={styles.masterHistoryDate}>{order.date}</Text>
                  {order.items && order.items.length > 0 && (<View style={styles.masterHistoryItems}><Text style={styles.masterHistoryItemsTitle}>Что сделано:</Text>{order.items.map((it, idx) => (<View key={idx} style={styles.masterHistoryItemRow}><Ionicons name="checkmark-circle" size={12} color="#27ae60" /><Text style={styles.masterHistoryItemName}> {it.title}{it.qty > 1 ? `×${it.qty}` : ''}</Text><Text style={styles.masterHistoryItemPrice}>{(it.price * it.qty).toLocaleString('ru-RU')} ₽</Text></View>))}</View>)}
                  {order.tip > 0 && (<View style={styles.masterHistoryTipBadge}><Ionicons name="heart" size={10} color="#e74c3c" /><Text style={styles.masterHistoryTipText}> +{order.tip.toLocaleString('ru-RU')} ₽ чаевые</Text></View>)}
                  <View style={styles.masterHistoryCommissionRow}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Ionicons name="wallet-outline" size={11} color="#f39c12" /><Text style={styles.masterHistoryCommissionLabel}> Комиссия {formatCommissionPct(order.amount)}</Text></View><Text style={styles.masterHistoryCommissionValue}>−{orderCommission.toLocaleString('ru-RU')} ₽</Text></View>
                  <View style={styles.masterHistoryNetRow}><Text style={styles.masterHistoryNetLabel}>💵 На руки: </Text><Text style={styles.masterHistoryNetValue}>{orderNet.toLocaleString('ru-RU')} ₽</Text></View>
                </AnimatedCard>
              );
            })}
            <Text style={styles.sectionTitle}>Отзывы клиентов ({reviews.length})</Text>
            {reviews.map((r, i) => (
              <AnimatedCard key={r.id} index={i} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <View style={styles.reviewAvatar}><Text style={styles.reviewAvatarText}>{r.client.charAt(0)}</Text></View>
                  <View style={{ flex: 1 }}><Text style={styles.reviewClient}>{r.client}</Text><View style={styles.reviewStarsRow}>{renderStars(r.rating)}<Text style={styles.reviewDate}> {r.date}</Text></View></View>
                </View>
                <Text style={styles.reviewText}>{r.text}</Text>
              </AnimatedCard>
            ))}
          </View>
        </ScrollView>
      ) : (
        <KeyboardAvoidingView style={styles.waChatContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
          <ChatWallpaper />
          <FlatList ref={chatListRef} data={messages} keyExtractor={item => item.id} renderItem={renderMessage} contentContainerStyle={{ paddingHorizontal: 6, paddingVertical: 12, flexGrow: 1, justifyContent: 'flex-end' }} onContentSizeChange={() => chatListRef.current?.scrollToEnd({ animated: true })} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" />
          {isRecording ? (
            <View style={styles.recordingPanel}>
              <View style={styles.recordingDot} /><Text style={styles.recordingText}>Запись {formatSec(recordingTime)}</Text>
              <View style={{ flex: 1 }} />
              <TouchableOpacity style={styles.recordActionBtn} onPress={cancelRecording}><Ionicons name="close" size={20} color="#fff" /></TouchableOpacity>
              <TouchableOpacity style={[styles.recordActionBtn, { backgroundColor: WA_GREEN }]} onPress={stopRecordingAndSend}><Ionicons name="send" size={18} color="#fff" /></TouchableOpacity>
            </View>
          ) : (
            <View style={styles.waInputRow}>
              <View style={styles.waInputWrap}>
                <TouchableOpacity style={styles.waInputIcon} onPress={() => { Keyboard.dismiss(); setShowAttach(s => !s); }}><Ionicons name={showAttach ? 'close' : 'add'} size={24} color="#8696a0" /></TouchableOpacity>
                <TextInput style={styles.waInput} placeholder="Сообщение" placeholderTextColor="#8696a0" value={draft} onChangeText={setDraft} multiline onFocus={() => setTimeout(() => chatListRef.current?.scrollToEnd({ animated: true }), 350)} />
                <TouchableOpacity style={styles.waInputIcon} onPress={startRecording}><Ionicons name="mic" size={22} color="#8696a0" /></TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.waSendBtn} onPress={sendMessage}><Ionicons name="send" size={20} color="#fff" /></TouchableOpacity>
            </View>
          )}
          <AttachPanel visible={showAttach} onPhoto={pickPhoto} onVideo={pickVideo} onClose={() => setShowAttach(false)} />
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}