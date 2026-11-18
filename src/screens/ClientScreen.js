import React, { useState, useEffect } from 'react';
import { SafeAreaView, StatusBar, View, Text, FlatList, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../config/supabase';
import { CATEGORIES, SERVICES, CLIENT_PROFILE, CLIENT_REVIEWS, RANKS, DEFAULT_LOCATION } from '../constants';
import { getDistanceMeters, reverseGeocodeToAddress, pluralServices, parsePrice, softVibrate, renderStars } from '../utils';
import { AnimatedCard, CategoryCard } from '../components/AnimatedUI';
import ProfileCard from '../components/ProfileCard';
import styles from '../styles';

export default function ClientScreen({ onExit, user }) {
  const [view, setView] = useState('main');
  const [mainTab, setMainTab] = useState('services');
  const [activeCategory, setActiveCategory] = useState(null);
  const [cart, setCart] = useState([]);
  const [history, setHistory] = useState([]);
  const [masters, setMasters] = useState([]);
  const [selectedMasterId, setSelectedMasterId] = useState(null);
  const [viewingMasterId, setViewingMasterId] = useState(null);
  const [reviewingOrder, setReviewingOrder] = useState(null);
  const [tippingOrder, setTippingOrder] = useState(null);
  const [masterReviews, setMasterReviews] = useState({});
  const [profile, setProfile] = useState(user ? { ...CLIENT_PROFILE, name: user.name || CLIENT_PROFILE.name, surname: user.surname || '', phone: user.phone || CLIENT_PROFILE.phone } : CLIENT_PROFILE);
  const [clientReviews] = useState(CLIENT_REVIEWS);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [myLocation, setMyLocation] = useState(DEFAULT_LOCATION);
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationError, setLocationError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [addingServicesTo, setAddingServicesTo] = useState(null);
  const [orderAddQuery, setOrderAddQuery] = useState('');

  const fetchLocation = async () => {
    setLocationLoading(true); setLocationError(null);
    try {
      const { status } = await (await import('expo-location')).requestForegroundPermissionsAsync();
      if (status !== 'granted') { setLocationError('Нет доступа к геолокации'); setLocationLoading(false); return; }
      try {
        const last = await (await import('expo-location')).getLastKnownPositionAsync({});
        if (last && last.coords) {
          const addr = await reverseGeocodeToAddress(last.coords.latitude, last.coords.longitude);
          setMyLocation({ lat: last.coords.latitude, lng: last.coords.longitude, text: addr || `${last.coords.latitude.toFixed(4)}, ${last.coords.longitude.toFixed(4)}` });
        }
      } catch (e) {}
      const loc = await (await import('expo-location')).getCurrentPositionAsync({ accuracy: (await import('expo-location')).Accuracy.Balanced });
      const addr = await reverseGeocodeToAddress(loc.coords.latitude, loc.coords.longitude);
      setMyLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude, text: addr || `${loc.coords.latitude.toFixed(4)}, ${loc.coords.longitude.toFixed(4)}` });
    } catch (e) { setLocationError('GPS недоступен — используем Москву'); }
    finally { setLocationLoading(false); }
  };

  useEffect(() => { fetchLocation(); }, []);

  useEffect(() => {
    const loadMasters = async () => {
      const { data } = await supabase.from('profiles').select('*').eq('role', 'master').not('name', 'is', null).neq('name', '').not('phone', 'is', null).neq('phone', '');
      if (data) setMasters(data.map(m => ({ ...m, avatar: m.avatar || 'construct', rank: m.rank_id || 'master', rating: Number(m.rating) || 5.0, reviewsCount: m.reviews_count || 0, ordersDone: m.orders_done || 0, about: m.about || '', lat: Number(m.lat) || 55.7558, lng: Number(m.lng) || 37.6173 })));
    };
    loadMasters();
    const ch = supabase.channel('masters-ch').on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, loadMasters).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const loadHistory = async () => {
    const { data } = await supabase.from('orders').select('*, master:profiles!master_id(name, surname)').eq('client_id', user.id).order('created_at', { ascending: false });
    if (data) setHistory(data.map(o => ({ id: o.id, date: new Date(o.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }), time: new Date(o.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }), items: o.items || [], total: o.total, tip: o.tip || 0, masterId: o.master_id, masterName: o.master ? `${o.master.name} ${o.master.surname || ''}`.trim() : 'Мастер будет назначен', status: o.status === 'done' ? 'done' : 'active', myReview: null, completedAt: null })));
  };

  useEffect(() => {
    loadHistory();
    const ch = supabase.channel('client-orders-' + user.id).on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `client_id=eq.${user.id}` }, loadHistory).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user.id]);

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const cartTotal = cart.reduce((s, i) => s + parsePrice(i.price) * i.qty, 0);
  const selectedMaster = selectedMasterId ? masters.find(m => m.id === selectedMasterId) : null;
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const searchResults = normalizedQuery ? SERVICES.filter(s => { const cat = CATEGORIES.find(c => c.id === s.category); return s.title.toLowerCase().includes(normalizedQuery) || (cat && cat.title.toLowerCase().includes(normalizedQuery)); }) : [];

  const addToCart = (service) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === service.id);
      if (existing) return prev.map(i => i.id === service.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { ...service, qty: 1 }];
    });
  };

  const removeFromCart = (id) => {
    setCart(prev => {
      const item = prev.find(i => i.id === id);
      if (item && item.qty > 1) return prev.map(i => i.id === id ? { ...i, qty: i.qty - 1 } : i);
      return prev.filter(i => i.id !== id);
    });
  };

  const checkout = async () => {
    if (cart.length === 0) return;
    const finalItems = cart.map(i => ({ ...i }));
    const { error } = await supabase.from('orders').insert({ client_id: user.id, master_id: selectedMaster ? selectedMaster.id : null, total: cartTotal, items: finalItems, status: 'new' });
    if (error) { Alert.alert('Ошибка', error.message); return; }
    setCart([]); setSelectedMasterId(null); setView('main'); setMainTab('history');
    setProfile(p => ({ ...p, ordersCount: p.ordersCount + 1 }));
    Alert.alert('Заказ оформлен!', `${selectedMaster ? `Мастер: ${selectedMaster.name}` : 'Мастер будет назначен'}\nИтого: ${cartTotal.toLocaleString('ru-RU')} ₽`);
  };

  const submitReview = () => {
    if (!reviewingOrder || !reviewText.trim()) return Alert.alert('Напишите отзыв', 'Поделитесь впечатлением.');
    const now = new Date();
    const review = { id: `mr${Date.now()}`, client: profile.name, rating: reviewRating, date: now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }), text: reviewText.trim() };
    setHistory(prev => prev.map(o => o.id === reviewingOrder.id ? { ...o, myReview: review } : o));
    setMasterReviews(prev => ({ ...prev, [reviewingOrder.masterId]: [review, ...(prev[reviewingOrder.masterId] || [])] }));
    setReviewingOrder(null); setReviewText(''); setReviewRating(5); setView('main'); setMainTab('history');
    Alert.alert('Спасибо!', 'Ваш отзыв отправлен.');
  };

  const sendTip = async (amount) => {
    if (!tippingOrder) return;
    const { error } = await supabase.from('orders').update({ tip: (tippingOrder.tip || 0) + amount }).eq('id', tippingOrder.id);
    if (error) { Alert.alert('Ошибка', error.message); return; }
    setProfile(p => ({ ...p, tips: p.tips + amount }));
    setTippingOrder(null); setView('main'); setMainTab('history');
    loadHistory();
    Alert.alert('Спасибо!', `Вы дали ${amount.toLocaleString('ru-RU')} ₽ чаевых.`);
  };

  const addServiceToOrder = async (orderId, service) => {
    const order = history.find(o => o.id === orderId);
    if (!order) return;
    const existing = order.items.find(i => i.id === service.id);
    const newItems = existing ? order.items.map(i => i.id === service.id ? { ...i, qty: i.qty + 1 } : i) : [...order.items, { ...service, qty: 1 }];
    const newTotal = newItems.reduce((s, i) => s + parsePrice(i.price) * i.qty, 0);
    const { error } = await supabase.from('orders').update({ items: newItems, total: newTotal }).eq('id', orderId);
    if (error) { Alert.alert('Ошибка', error.message); return; }
    setHistory(prev => prev.map(o => o.id === orderId ? { ...o, items: newItems, total: newTotal } : o));
    softVibrate(10);
  };

  const completeOrder = (orderId) => {
    Alert.alert('Завершить заказ?', 'Подтвердите, что мастер выполнил все работы.', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Завершить', onPress: async () => {
        const { error } = await supabase.from('orders').update({ status: 'done' }).eq('id', orderId);
        if (error) { Alert.alert('Ошибка', error.message); return; }
        const now = new Date();
        setHistory(prev => prev.map(o => o.id === orderId ? { ...o, status: 'done', completedAt: now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) } : o));
        softVibrate(15); Alert.alert('Готово', 'Заказ завершён');
      }}
    ]);
  };

  // --- Рендеринг под-экранов ---
  if (view === 'review' && reviewingOrder) {
    return (
      <SafeAreaView style={styles.clientContainer}>
        <StatusBar barStyle="light-content" />
        <View style={styles.topBarDark}>
          <TouchableOpacity onPress={() => { setView('main'); setMainTab('history'); setReviewingOrder(null); }}><Ionicons name="arrow-back" size={26} color="#fff" /></TouchableOpacity>
          <Text style={styles.titleLight}>Оставить отзыв</Text><View style={{ width: 26 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <View style={styles.reviewFormCard}>
            <Text style={styles.reviewFormTitle}>Мастер: {reviewingOrder.masterName}</Text>
            <Text style={styles.reviewFormSub}>Как прошёл заказ?</Text>
            <View style={styles.starsPicker}>{[1, 2, 3, 4, 5].map(i => (<TouchableOpacity key={i} onPress={() => setReviewRating(i)} hitSlop={8}><Ionicons name={i <= reviewRating ? 'star' : 'star-outline'} size={36} color="#f39c12" style={{ marginHorizontal: 4 }} /></TouchableOpacity>))}</View>
            <TextInput style={styles.reviewInput} placeholder="Поделитесь впечатлениями..." placeholderTextColor="#777" value={reviewText} onChangeText={setReviewText} multiline numberOfLines={5} />
            <TouchableOpacity style={styles.submitReviewBtn} onPress={submitReview}><Text style={styles.submitReviewBtnText}>Отправить отзыв</Text></TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (view === 'tip' && tippingOrder) {
    const tips = [100, 200, 500, 1000];
    return (
      <SafeAreaView style={styles.clientContainer}>
        <StatusBar barStyle="light-content" />
        <View style={styles.topBarDark}>
          <TouchableOpacity onPress={() => { setView('main'); setMainTab('history'); setTippingOrder(null); }}><Ionicons name="arrow-back" size={26} color="#fff" /></TouchableOpacity>
          <Text style={styles.titleLight}>Чаевые</Text><View style={{ width: 26 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <View style={styles.reviewFormCard}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}><Ionicons name="heart" size={48} color="#e74c3c" /></View>
            <Text style={[styles.reviewFormTitle, { textAlign: 'center' }]}>Спасибо мастеру</Text>
            <Text style={[styles.reviewFormSub, { textAlign: 'center', marginBottom: 20 }]}>{tippingOrder.masterName} выполнил заказ</Text>
            <View style={styles.tipOptionsRow}>{tips.map(sum => (<TouchableOpacity key={sum} style={styles.tipOption} onPress={() => sendTip(sum)}><Text style={styles.tipOptionText}>{sum} ₽</Text></TouchableOpacity>))}</View>
            <TouchableOpacity style={[styles.tipOption, styles.tipCustom]} onPress={() => sendTip(1500)}><Text style={styles.tipOptionText}>1500 ₽</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.submitReviewBtn, { backgroundColor: '#333', marginTop: 16 }]} onPress={() => { setView('main'); setMainTab('history'); setTippingOrder(null); }}><Text style={styles.submitReviewBtnText}>Позже</Text></TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (view === 'masterView' && viewingMasterId) {
    const m = masters.find(x => x.id === viewingMasterId);
    if (!m) { setView('masterSelect'); setViewingMasterId(null); return null; }
    const rank = RANKS.find(r => r.id === m.rank) || RANKS[0];
    const revs = masterReviews[m.id] || [];
    const masterDistance = getDistanceMeters(myLocation.lat, myLocation.lng, m.lat, m.lng);
    return (
      <SafeAreaView style={styles.clientContainer}>
        <StatusBar barStyle="light-content" />
        <View style={styles.topBarDark}>
          <TouchableOpacity onPress={() => { setView(selectedMasterId === m.id ? 'cart' : 'masterSelect'); setViewingMasterId(null); }}><Ionicons name="arrow-back" size={26} color="#fff" /></TouchableOpacity>
          <Text style={styles.titleLight}>Профиль мастера</Text><View style={{ width: 26 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
          <View style={styles.masterProfileCard}>
            <View style={[styles.masterAvatarLarge, { borderColor: rank.color }]}><Ionicons name={m.avatar} size={44} color={rank.color} /></View>
            <Text style={styles.masterProfileName}>{m.name} {m.surname || ''}</Text>
            <View style={styles.masterRatingRow}>{renderStars(m.rating, 16)}<Text style={styles.masterRatingText}> {m.rating} · {m.reviewsCount} отзывов</Text></View>
            <View style={[styles.rankPill, { backgroundColor: rank.color + '22', borderColor: rank.color }]}><Ionicons name={rank.icon} size={14} color={rank.color} /><Text style={[styles.rankPillText, { color: rank.color }]}> {rank.title}</Text></View>
            <View style={styles.masterDistanceCard}><Ionicons name="navigate" size={16} color="#3498db" /><Text style={styles.masterDistanceCardText}> До мастера: <Text style={styles.masterDistanceCardValue}>{(masterDistance < 1000 ? `${masterDistance} м` : `${(masterDistance / 1000).toFixed(1)} км`)}</Text></Text></View>
            {m.about ? <Text style={styles.masterAbout}>{m.about}</Text> : null}
            <View style={styles.masterStatsRow}>
              <View style={styles.masterStat}><Text style={styles.masterStatValue}>{m.ordersDone}</Text><Text style={styles.masterStatLabel}>заказов</Text></View>
              <View style={styles.statDivider} />
              <View style={styles.masterStat}><Text style={styles.masterStatValue}>{m.reviewsCount}</Text><Text style={styles.masterStatLabel}>отзывов</Text></View>
              <View style={styles.statDivider} />
              <View style={styles.masterStat}><Text style={styles.masterStatValue}>{m.rating}</Text><Text style={styles.masterStatLabel}>рейтинг</Text></View>
            </View>
          </View>
          <Text style={styles.sectionTitle}>Отзывы о мастере ({revs.length})</Text>
          {revs.length === 0 ? <Text style={styles.emptyReviews}>Пока нет отзывов</Text> : revs.map((r, i) => (
            <AnimatedCard key={r.id} index={i} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <View style={styles.reviewAvatar}><Text style={styles.reviewAvatarText}>{r.client.charAt(0)}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reviewClient}>{r.client}</Text>
                  <View style={styles.reviewStarsRow}>{renderStars(r.rating)}<Text style={styles.reviewDate}> {r.date}</Text></View>
                </View>
              </View>
              <Text style={styles.reviewText}>{r.text}</Text>
            </AnimatedCard>
          ))}
        </ScrollView>
        <View style={styles.masterSelectFooter}>
          <TouchableOpacity style={[styles.checkoutBtn, { backgroundColor: selectedMasterId === m.id ? '#27ae60' : '#3498db' }]} onPress={() => { setSelectedMasterId(m.id); setViewingMasterId(null); setView('main'); }}>
            <Text style={styles.checkoutBtnText}>{selectedMasterId === m.id ? 'Мастер выбран ✓' : 'Выбрать этого мастера'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (view === 'masterSelect') {
    return (
      <SafeAreaView style={styles.clientContainer}>
        <StatusBar barStyle="light-content" />
        <View style={styles.topBarDark}>
          <TouchableOpacity onPress={() => setView('cart')}><Ionicons name="arrow-back" size={26} color="#fff" /></TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.titleLight}>Выбор мастера</Text>
            {locationLoading ? <Text style={{ color: '#3498db', fontSize: 11, marginTop: 2 }}>Определяем геолокацию…</Text> : locationError ? <Text style={{ color: '#e74c3c', fontSize: 11, marginTop: 2 }}>{locationError}</Text> : <Text style={{ color: '#27ae60', fontSize: 11, marginTop: 2 }} numberOfLines={1}>📍 {myLocation.text}</Text>}
          </View>
          <TouchableOpacity onPress={fetchLocation} hitSlop={8} disabled={locationLoading}>{locationLoading ? <ActivityIndicator color="#3498db" size="small" /> : <Ionicons name="refresh" size={24} color="#3498db" />}</TouchableOpacity>
        </View>
        <FlatList data={masters} keyExtractor={m => m.id} contentContainerStyle={{ padding: 16 }} ListEmptyComponent={<Text style={{ color: '#888', textAlign: 'center', marginTop: 20 }}>Нет доступных мастеров</Text>} renderItem={({ item: m, index }) => {
          const rank = RANKS.find(r => r.id === m.rank) || RANKS[0]; const isSelected = selectedMasterId === m.id;
          const mDistance = getDistanceMeters(myLocation.lat, myLocation.lng, m.lat, m.lng);
          return (
            <AnimatedCard index={index} style={[styles.masterSelectCard, isSelected && { borderColor: '#27ae60', borderWidth: 2 }]}>
              <TouchableOpacity onPress={() => { setViewingMasterId(m.id); setView('masterView'); }} activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View style={[styles.masterAvatarSmall, { backgroundColor: rank.color + '22' }]}><Ionicons name={m.avatar} size={26} color={rank.color} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.masterSelectName}>{m.name} {m.surname || ''}</Text>
                  <View style={styles.masterRatingRow}>{renderStars(m.rating, 11)}<Text style={styles.masterSelectRating}> {m.rating} · {m.reviewsCount} отзывов</Text></View>
                  <View style={styles.masterDistanceRow}><Ionicons name="navigate" size={11} color="#3498db" /><Text style={styles.masterDistanceText}> {(mDistance < 1000 ? `${mDistance} м` : `${(mDistance / 1000).toFixed(1)} км`)} от вас</Text></View>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.selectMasterBtn, isSelected && { backgroundColor: '#27ae60' }]} onPress={() => { setSelectedMasterId(m.id); setView('cart'); }}><Ionicons name={isSelected ? 'checkmark' : 'add'} size={20} color="#fff" /></TouchableOpacity>
            </AnimatedCard>
          );
        }} />
      </SafeAreaView>
    );
  }

  if (view === 'cart') {
    return (
      <SafeAreaView style={styles.clientContainer}>
        <StatusBar barStyle="light-content" />
        <View style={styles.topBarDark}>
          <TouchableOpacity onPress={() => setView('main')}><Ionicons name="arrow-back" size={26} color="#fff" /></TouchableOpacity>
          <Text style={styles.titleLight}>Корзина</Text><View style={{ width: 26 }} />
        </View>
        {cart.length === 0 ? (
          <View style={styles.emptyCart}>
            <Ionicons name="cart-outline" size={64} color="#333" />
            <Text style={styles.emptyCartText}>Корзина пуста</Text>
            <TouchableOpacity style={styles.emptyCartBtn} onPress={() => setView('main')}><Text style={styles.emptyCartBtnText}>Выбрать услуги</Text></TouchableOpacity>
          </View>
        ) : (
          <>
            <FlatList data={cart} keyExtractor={i => i.id} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 260 }}
              ListFooterComponent={
                <View style={styles.masterSection}>
                  <Text style={styles.masterSectionTitle}>Мастер</Text>
                  {selectedMaster ? (
                    <TouchableOpacity style={styles.masterChosenRow} onPress={() => setView('masterSelect')}>
                      <View style={styles.masterAvatarSmall}><Ionicons name={selectedMaster.avatar} size={22} color="#3498db" /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.masterChosenName}>{selectedMaster.name}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>{renderStars(selectedMaster.rating, 11)}<Text style={styles.masterSelectRating}> {selectedMaster.rating}</Text></View>
                        <View style={styles.masterDistanceRow}><Ionicons name="navigate" size={11} color="#3498db" /><Text style={styles.masterDistanceText}> {(getDistanceMeters(myLocation.lat, myLocation.lng, selectedMaster.lat, selectedMaster.lng) < 1000 ? `${getDistanceMeters(myLocation.lat, myLocation.lng, selectedMaster.lat, selectedMaster.lng)} м` : `${(getDistanceMeters(myLocation.lat, myLocation.lng, selectedMaster.lat, selectedMaster.lng) / 1000).toFixed(1)} км`)} от вас</Text></View>
                      </View>
                      <Text style={styles.changeMasterText}>Изменить</Text>
                    </TouchableOpacity>
                  ) : (
                    <>
                      <TouchableOpacity style={styles.selectMasterCta} onPress={() => setView('masterSelect')}>
                        <Ionicons name="person-add" size={20} color="#3498db" /><Text style={styles.selectMasterCtaText}> Выбрать мастера</Text>
                      </TouchableOpacity>
                      <Text style={{ color: '#888', fontSize: 12, textAlign: 'center', marginTop: 10 }}>Можно оформить и без мастера — мы назначим его автоматически.</Text>
                    </>
                  )}
                </View>
              }
              renderItem={({ item }) => (
                <View style={styles.cartItem}>
                  <View style={styles.clientIconWrap}><Ionicons name={item.icon} size={22} color="#3498db" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cartItemTitle}>{item.title}</Text>
                    <Text style={styles.cartItemPrice}>{(parsePrice(item.price) * item.qty).toLocaleString('ru-RU')} ₽</Text>
                  </View>
                  <View style={styles.qtyControls}>
                    <TouchableOpacity style={styles.qtyBtn} onPress={() => removeFromCart(item.id)}><Ionicons name="remove" size={18} color="#fff" /></TouchableOpacity>
                    <Text style={styles.qtyText}>{item.qty}</Text>
                    <TouchableOpacity style={styles.qtyBtn} onPress={() => addToCart(item)}><Ionicons name="add" size={18} color="#fff" /></TouchableOpacity>
                  </View>
                </View>
              )}
            />
            <View style={styles.cartFooter}>
              <View style={styles.cartTotalRow}><Text style={styles.cartTotalLabel}>Итого</Text><Text style={styles.cartTotalValue}>{cartTotal.toLocaleString('ru-RU')} ₽</Text></View>
              <TouchableOpacity style={styles.checkoutBtn} onPress={() => { softVibrate(15); checkout(); }}>
                <Text style={styles.checkoutBtnText}>{selectedMaster ? 'Оформить заказ' : 'Оформить без мастера'}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </SafeAreaView>
    );
  }

  if (view === 'category' && activeCategory) {
    const cat = CATEGORIES.find(c => c.id === activeCategory);
    const services = SERVICES.filter(s => s.category === activeCategory);
    return (
      <SafeAreaView style={styles.clientContainer}>
        <StatusBar barStyle="light-content" />
        <View style={styles.clientHeader}>
          <TouchableOpacity onPress={() => { setView('main'); setActiveCategory(null); }} hitSlop={12}><Ionicons name="arrow-back" size={26} color="#fff" /></TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}><Text style={styles.clientHeaderTitle}>{cat.title}</Text><Text style={styles.clientHeaderSubtitle}>{services.length} {pluralServices(services.length)}</Text></View>
          <TouchableOpacity onPress={onExit} hitSlop={12}><Text style={styles.clientExitText}>Выйти</Text></TouchableOpacity>
        </View>
        <FlatList data={services} keyExtractor={item => item.id} contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 16, paddingTop: 8 }} renderItem={({ item, index }) => (
          <AnimatedCard index={index} style={styles.clientCardDark}>
            <View style={[styles.clientIconWrap, { backgroundColor: cat.color + '22' }]}><Ionicons name={item.icon} size={26} color={cat.color} /></View>
            <View style={{ flex: 1 }}><Text style={styles.clientTitleLight}>{item.title}</Text><Text style={styles.clientPrice}>{item.price}</Text></View>
            <TouchableOpacity style={styles.orderBtn} onPress={() => addToCart(item)}><Ionicons name="add" size={20} color="#fff" /></TouchableOpacity>
          </AnimatedCard>
        )} />
        {cartCount > 0 && (
          <TouchableOpacity style={styles.floatingCart} onPress={() => { softVibrate(12); setView('cart'); }} activeOpacity={0.9}>
            <Ionicons name="cart" size={22} color="#fff" /><Text style={styles.floatingCartText}> Корзина · {cartTotal.toLocaleString('ru-RU')} ₽</Text>
          </TouchableOpacity>
        )}
      </SafeAreaView>
    );
  }

  if (view === 'addServices' && addingServicesTo) {
    const order = history.find(o => o.id === addingServicesTo);
    if (!order) { setView('main'); setMainTab('history'); setAddingServicesTo(null); return null; }
    const q = orderAddQuery.trim().toLowerCase();
    const filtered = q ? SERVICES.filter(s => { const cat = CATEGORIES.find(c => c.id === s.category); return s.title.toLowerCase().includes(q) || (cat && cat.title.toLowerCase().includes(q)); }) : SERVICES;
    return (
      <SafeAreaView style={styles.clientContainer}>
        <StatusBar barStyle="light-content" />
        <View style={styles.clientHeader}>
          <TouchableOpacity onPress={() => { setView('main'); setMainTab('history'); setAddingServicesTo(null); setOrderAddQuery(''); }} hitSlop={12}><Ionicons name="arrow-back" size={26} color="#fff" /></TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}><Text style={styles.clientHeaderTitle}>Добавить услуги</Text><Text style={styles.clientHeaderSubtitle}>К заказу от {order.date}</Text></View>
          <TouchableOpacity onPress={() => { setView('main'); setMainTab('history'); setAddingServicesTo(null); setOrderAddQuery(''); }}><Text style={{ color: '#27ae60', fontSize: 15, fontWeight: '700' }}>Готово</Text></TouchableOpacity>
        </View>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color="#888" style={{ marginLeft: 12 }} />
          <TextInput style={styles.searchInput} placeholder="Поиск услуги..." placeholderTextColor="#666" value={orderAddQuery} onChangeText={setOrderAddQuery} />
          {orderAddQuery.length > 0 && (<TouchableOpacity onPress={() => setOrderAddQuery('')} hitSlop={8} style={{ paddingRight: 12 }}><Ionicons name="close-circle" size={18} color="#888" /></TouchableOpacity>)}
        </View>
        <View style={{ paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: '#888', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>Текущий итог заказа</Text>
          <Text style={{ color: '#27ae60', fontSize: 16, fontWeight: '700' }}>{order.total.toLocaleString('ru-RU')} ₽</Text>
        </View>
        <FlatList data={filtered} keyExtractor={item => item.id} contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 16, paddingTop: 4 }} ListEmptyComponent={<View style={styles.emptyCart}><Ionicons name="search-outline" size={56} color="#333" /><Text style={styles.emptyCartText}>Ничего не найдено</Text></View>} renderItem={({ item, index }) => {
          const cat = CATEGORIES.find(c => c.id === item.category);
          const color = cat ? cat.color : '#3498db';
          const inOrder = order.items.find(i => i.id === item.id);
          return (
            <AnimatedCard index={Math.min(index, 8)} style={styles.clientCardDark}>
              <View style={[styles.clientIconWrap, { backgroundColor: color + '22' }]}><Ionicons name={item.icon} size={26} color={color} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.clientTitleLight}>{item.title}</Text>
                <Text style={styles.clientPrice}>{item.price}</Text>
                {inOrder && (<View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}><Ionicons name="checkmark-circle" size={12} color="#27ae60" /><Text style={{ color: '#27ae60', fontSize: 11, fontWeight: '600' }}> В заказе ×{inOrder.qty}</Text></View>)}
              </View>
              <TouchableOpacity style={styles.orderBtn} onPress={() => addServiceToOrder(order.id, item)}><Ionicons name="add" size={20} color="#fff" /></TouchableOpacity>
            </AnimatedCard>
          );
        }} />
      </SafeAreaView>
    );
  }

  // --- Главный экран клиента ---
  return (
    <SafeAreaView style={styles.clientContainer}>
      <StatusBar barStyle="light-content" />
      <View style={styles.clientHeader}>
        <View><Text style={styles.clientHeaderTitle}>Отопление и ремонт</Text><Text style={styles.clientHeaderSubtitle}>{mainTab === 'services' ? 'Выберите категорию' : mainTab === 'history' ? 'Ваши заказы' : 'Ваш профиль'}</Text></View>
        <TouchableOpacity onPress={onExit} hitSlop={12}><Text style={styles.clientExitText}>Выйти</Text></TouchableOpacity>
      </View>
      <View style={styles.segmentRow}>
        <TouchableOpacity style={[styles.segmentBtn, mainTab === 'services' && styles.segmentBtnActive]} onPress={() => setMainTab('services')}><Text style={[styles.segmentText, mainTab === 'services' && styles.segmentTextActive]}>Услуги</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.segmentBtn, mainTab === 'history' && styles.segmentBtnActive]} onPress={() => setMainTab('history')}><Text style={[styles.segmentText, mainTab === 'history' && styles.segmentTextActive]}>История{history.length > 0 ? `(${history.length})` : ''}</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.segmentBtn, mainTab === 'profile' && styles.segmentBtnActive]} onPress={() => setMainTab('profile')}><Text style={[styles.segmentText, mainTab === 'profile' && styles.segmentTextActive]}>Профиль</Text></TouchableOpacity>
      </View>

      {mainTab === 'services' && (
        <ScrollView contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={18} color="#888" style={{ marginLeft: 12 }} />
            <TextInput style={styles.searchInput} placeholder="Поиск услуги..." placeholderTextColor="#666" value={searchQuery} onChangeText={setSearchQuery} returnKeyType="search" />
            {searchQuery.length > 0 && (<TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8} style={{ paddingRight: 12 }}><Ionicons name="close-circle" size={18} color="#888" /></TouchableOpacity>)}
          </View>
          {normalizedQuery ? (
            searchResults.length === 0 ? (
              <View style={styles.emptyCart}><Ionicons name="search-outline" size={56} color="#333" /><Text style={styles.emptyCartText}>Ничего не найдено</Text></View>
            ) : (
              <>
                <Text style={styles.searchResultsLabel}>Найдено: {searchResults.length} {pluralServices(searchResults.length)}</Text>
                <View style={{ paddingHorizontal: 16 }}>
                  {searchResults.map((item, index) => {
                    const cat = CATEGORIES.find(c => c.id === item.category);
                    const color = cat ? cat.color : '#3498db';
                    return (
                      <AnimatedCard key={item.id} index={index} style={styles.clientCardDark}>
                        <View style={[styles.clientIconWrap, { backgroundColor: color + '22' }]}><Ionicons name={item.icon} size={26} color={color} /></View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.clientTitleLight}>{item.title}</Text>
                          <Text style={styles.clientPrice}>{item.price}</Text>
                          {cat && (<View style={styles.searchCategoryRow}><Ionicons name={cat.icon} size={10} color={color} /><Text style={[styles.searchCategoryBadge, { color }]}>{cat.title}</Text></View>)}
                        </View>
                        <TouchableOpacity style={styles.orderBtn} onPress={() => addToCart(item)}><Ionicons name="add" size={20} color="#fff" /></TouchableOpacity>
                      </AnimatedCard>
                    );
                  })}
                </View>
              </>
            )
          ) : (
            <View style={styles.categoryGrid}>
              {CATEGORIES.map((cat, i) => (<CategoryCard key={cat.id} category={cat} count={SERVICES.filter(s => s.category === cat.id).length} index={i} onPress={() => { setActiveCategory(cat.id); setView('category'); }} />))}
            </View>
          )}
        </ScrollView>
      )}

      {mainTab === 'history' && (
        <FlatList data={history} keyExtractor={o => o.id} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, paddingTop: 4 }}
          ListEmptyComponent={<View style={styles.emptyCart}><Ionicons name="time-outline" size={64} color="#333" /><Text style={styles.emptyCartText}>Заказов пока нет</Text><TouchableOpacity style={styles.emptyCartBtn} onPress={() => setMainTab('services')}><Text style={styles.emptyCartBtnText}>Выбрать услугу</Text></TouchableOpacity></View>}
          renderItem={({ item: order }) => {
            const isDone = order.status === 'done';
            return (
              <View style={styles.historyCard}>
                <View style={styles.historyHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historyDate}>{order.date} · {order.time}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                      <View style={[styles.orderStatusBadge, { backgroundColor: isDone ? 'rgba(39,174,96,0.15)' : 'rgba(52,152,219,0.15)' }]}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isDone ? '#27ae60' : '#3498db' }} />
                        <Text style={[styles.orderStatusText, { color: isDone ? '#27ae60' : '#3498db' }]}>{isDone ? 'Завершён' : 'Активен'}</Text>
                      </View>
                    </View>
                  </View>
                  <Text style={styles.historyTotal}>{order.total.toLocaleString('ru-RU')} ₽</Text>
                </View>
                <Text style={styles.historyMaster}>👷 Мастер: {order.masterName}</Text>
                <View style={styles.historyDivider} />
                {order.items.map((it, i) => (<View key={i} style={styles.historyItemRow}><Text style={styles.historyItemName}>{it.title}{it.qty > 1 ? ` ×${it.qty}` : ''}</Text><Text style={styles.historyItemSum}>{(parsePrice(it.price) * it.qty).toLocaleString('ru-RU')} ₽</Text></View>))}
                {order.myReview && (<View style={styles.myReviewBox}><Text style={styles.myReviewTitle}>Ваш отзыв:</Text><View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>{renderStars(order.myReview.rating, 12)}<Text style={styles.myReviewText}> — {order.myReview.text}</Text></View></View>)}
                {order.tip > 0 && (<View style={styles.tipBadge}><Ionicons name="heart" size={14} color="#e74c3c" /><Text style={styles.tipBadgeText}> Чаевые: {order.tip} ₽ (в итого)</Text></View>)}
                {!isDone && (
                  <View style={styles.orderManageRow}>
                    <TouchableOpacity style={styles.orderManageBtn} onPress={() => { setAddingServicesTo(order.id); setOrderAddQuery(''); setView('addServices'); }}>
                      <Ionicons name="add-circle-outline" size={16} color="#3498db" /><Text style={styles.orderManageBtnText}> Добавить услуги</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.orderManageBtn, { borderColor: '#27ae60' }]} onPress={() => completeOrder(order.id)}>
                      <Ionicons name="checkmark-done-circle-outline" size={16} color="#27ae60" /><Text style={[styles.orderManageBtnText, { color: '#27ae60' }]}> Завершить заказ</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {isDone && (
                  <View style={styles.orderActions}>
                    {!order.myReview && (<TouchableOpacity style={styles.orderActionBtn} onPress={() => { setReviewingOrder(order); setView('review'); }}><Ionicons name="star" size={14} color="#f39c12" /><Text style={styles.orderActionText}> Оставить отзыв</Text></TouchableOpacity>)}
                    <TouchableOpacity style={styles.orderActionBtn} onPress={() => { setTippingOrder(order); setView('tip'); }}><Ionicons name="heart" size={14} color="#e74c3c" /><Text style={styles.orderActionText}> Дать чаевые</Text></TouchableOpacity>
                  </View>
                )}
              </View>
            );
          }} />
      )}

      {mainTab === 'profile' && (
        <ScrollView contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 16 }}>
          <ProfileCard profile={profile} onSave={setProfile} isMaster={false} />
          <TouchableOpacity style={styles.locationCard} onPress={fetchLocation} activeOpacity={0.75}>
            <Ionicons name={locationLoading ? 'ellipsis-horizontal' : locationError ? 'alert-circle' : 'location'} size={18} color={locationError ? '#e74c3c' : '#3498db'} />
            <View style={{ flex: 1 }}><Text style={styles.locationLabel}>Текущая геолокация</Text><Text style={styles.locationValue}>{locationLoading ? 'Определяем...' : locationError ? `${myLocation.text} · ${locationError}` : myLocation.text}</Text></View>
            <Ionicons name="refresh" size={18} color="#3498db" />
          </TouchableOpacity>
          <Text style={styles.sectionTitle}>Отзывы мастеров о вас ({clientReviews.length})</Text>
          {clientReviews.length === 0 ? <Text style={styles.emptyReviews}>Пока нет отзывов</Text> : clientReviews.map((r, i) => (
            <AnimatedCard key={r.id} index={i} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <View style={[styles.reviewAvatar, { backgroundColor: '#9b59b6' }]}><Ionicons name="construct" size={16} color="#fff" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reviewClient}>{r.master}</Text>
                  <View style={styles.reviewStarsRow}>{renderStars(r.rating)}<Text style={styles.reviewDate}> {r.date}</Text></View>
                </View>
              </View>
              <Text style={styles.reviewText}>{r.text}</Text>
            </AnimatedCard>
          ))}
        </ScrollView>
      )}

      {cartCount > 0 && (
        <TouchableOpacity style={styles.floatingCart} onPress={() => { softVibrate(12); setView('cart'); }} activeOpacity={0.9}>
          <Ionicons name="cart" size={22} color="#fff" /><Text style={styles.floatingCartText}> Корзина · {cartTotal.toLocaleString('ru-RU')} ₽</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}