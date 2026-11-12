import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, SafeAreaView, StatusBar, Alert, Linking, ScrollView, Animated, TextInput, KeyboardAvoidingView, Platform, Image, Easing, Vibration, Modal, ActivityIndicator, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Location from 'expo-location';
import { useAudioRecorder, useAudioPlayer, useAudioPlayerStatus, AudioModule, RecordingPresets, setAudioModeAsync } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import { createClient } from '@supabase/supabase-js';

// ============================================================
// SUPABASE
// ============================================================
const supabase = createClient(
  'https://lzvhkpxahbavkmllygtw.supabase.co',
  'sb_publishable_Er46lfc2ZjwZUryLKJkkmA_y6s1Mery',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

const MASTER_ACCENT = '#FFFFFF';
const WA_CHAT_BG = '#0b141a';
const WA_BUBBLE_MINE = '#005c4b';
const WA_BUBBLE_OTHER = '#202c33';
const WA_GREEN = '#00a884';
const WA_TICK = '#53bdeb';
const VISIT_PRICE = '3000 ₽';
const VISIT_ID = 's0';
const DEFAULT_LOCATION = { lat: 55.7558, lng: 37.6173, text: 'Москва (по умолчанию)' };

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

const CLIENT_PROFILE = { name: 'Вы', surname: '', phone: '+7 (900) 000-00-00', rating: 4.9, reviewsCount: 8, ordersCount: 12, tips: 2500, avatar: null };
const CLIENT_REVIEWS = [
  { id: 'cr1', master: 'Сергей Иванов', rating: 5, date: '20 октября', text: 'Отличный клиент, всё по договорённости. Оплата сразу.' },
  { id: 'cr2', master: 'Андрей Петров', rating: 5, date: '18 октября', text: 'Приятный человек, вежливый, заранее подготовил всё для работы.' },
  { id: 'cr3', master: 'Дмитрий Козлов', rating: 5, date: '15 октября', text: 'Всегда рад помочь такому клиенту!' },
];
const MASTER_PROFILE = { name: 'Сергей', surname: 'Иванов', phone: '+7 (900) 123-45-67', ordersDone: 18, rating: 4.8, totalRatings: 27, balance: 45000, avatar: null };
const INITIAL_REVIEWS = [
  { id: 'r1', client: 'Иванов И.И.', rating: 5, date: '20 октября', text: 'Отличный мастер! Быстро и качественно установил батарею.', service: 'Монтаж радиатора' },
  { id: 'r2', client: 'Петрова А.С.', rating: 5, date: '18 октября', text: 'Сергей профессионал своего дела.', service: 'Монтаж котла' },
  { id: 'r3', client: 'Сидоров П.П.', rating: 4, date: '15 октября', text: 'Хорошая работа, но приехал на 15 минут позже.', service: 'Ремонт батареи' },
];

const CATEGORIES = [
  { id: 'service', title: 'Выезд мастера', icon: 'car-sport', color: '#27ae60' },
  { id: 'leak', title: 'Устранение утечек', icon: 'water', color: '#e74c3c' },
  { id: 'heating', title: 'Отопление', icon: 'flame', color: '#f39c12' },
  { id: 'boiler', title: 'Котельное', icon: 'settings', color: '#e74c3c' },
  { id: 'chimney', title: 'Дымоходы', icon: 'cloud', color: '#95a5a6' },
  { id: 'water', title: 'Водоснабжение', icon: 'water', color: '#3498db' },
  { id: 'sewer', title: 'Канализация', icon: 'git-network', color: '#1abc9c' },
  { id: 'pipes', title: 'Трубопровод', icon: 'git-branch', color: '#9b59b6' },
  { id: 'insulation', title: 'Утепление', icon: 'layers', color: '#e67e22' },
  { id: 'filtration', title: 'Фильтрация', icon: 'filter', color: '#16a085' },
  { id: 'automation', title: 'Автоматика', icon: 'hardware-chip', color: '#8e44ad' },
  { id: 'commissioning', title: 'Пусконаладка', icon: 'rocket', color: '#2ecc71' },
  { id: 'repair', title: 'Ремонт', icon: 'construct', color: '#c0392b' },
  { id: 'sanitary', title: 'Сантехника', icon: 'home', color: '#2980b9' },
  { id: 'chasing', title: 'Штробление', icon: 'hammer', color: '#d35400' },
  { id: 'extra', title: 'Доп. работы', icon: 'add-circle', color: '#7f8c8d' },
  { id: 'welding', title: 'Сварка', icon: 'bonfire', color: '#ff6b35' },
];

const S = (id, category, title, price, icon) => ({ id, category, title, price, icon });

const SERVICES = [
  S(VISIT_ID, 'service', 'Выезд мастера', VISIT_PRICE, 'car-outline'),
  S('lk1', 'leak', 'Устранение утечек', '3000 ₽', 'water-outline'),
  S('h1', 'heating', 'Монтаж радиатора (без подводящих сетей)', '4500 ₽', 'thermometer-outline'),
  S('h2', 'heating', 'Монтаж дизайн-радиаторов', '9000 ₽', 'color-palette-outline'),
  S('h3', 'heating', 'Монтаж радиатора обвязка металлом (чугун)', '6500 ₽', 'cube-outline'),
  S('h4', 'heating', 'Монтаж тёплого пола пенофол/пеноплекс', 'от 700 до 900 ₽', 'grid-outline'),
  S('h5', 'heating', 'Монтаж водяной воздушной завесы', '8000 ₽', 'cloudy-outline'),
  S('h6', 'heating', 'Монтаж электрической воздушной завесы', '4500 ₽', 'flash-outline'),
  S('h7', 'heating', 'Монтаж фанкойла кассетного', '9000 ₽', 'snow-outline'),
  S('h8', 'heating', 'Монтаж фанкойла канального', '8000 ₽', 'swap-horizontal-outline'),
  S('h9', 'heating', 'Монтаж фанкойла настенного', '8000 ₽', 'calendar-outline'),
  S('h10', 'heating', 'Монтаж фанкойла напольно-потолочного', '5500 ₽', 'layers-outline'),
  S('h11', 'heating', 'Монтаж конвектора настенного', '4500 ₽', 'thermometer-outline'),
  S('h12', 'heating', 'Монтаж конвектора напольного', '4500 ₽', 'thermometer-outline'),
  S('h13', 'heating', 'Монтаж конвектора внутрипольного', '9000 ₽', 'thermometer-outline'),
  S('h14', 'heating', 'Монтаж водяного тепловентилятора (вулкане)', '8000 ₽', 'flame-outline'),
  S('h15', 'heating', 'Обвязка теплообменника вентиляции', '6500 ₽', 'sync-outline'),
  S('h16', 'heating', 'Установка коллекторного шкафа без штробления', '1500 ₽', 'file-tray-stacked-outline'),
  S('h17', 'heating', 'Монтаж коллектора тёплого пола с насосом (до 4 контуров)', '8500 ₽', 'git-merge-outline'),
  S('h18', 'heating', 'Монтаж коллектора отопления (до 4 контуров)', '5000 ₽', 'git-merge-outline'),
  S('h19', 'heating', 'Монтаж РТЛ клапана, ТСГ ВПС', '700 ₽', 'water-outline'),
  S('h20', 'heating', 'Монтаж унибокса', '4500 ₽', 'cube-outline'),
  S('b1', 'boiler', 'Монтаж настенного газового котла', '13000 ₽', 'flame-outline'),
  S('b2', 'boiler', 'Монтаж электрического настенного котла', '10500 ₽', 'flash-outline'),
  S('b3', 'boiler', 'Монтаж котла напольного до 50 кВт', '15500 ₽', 'flame-outline'),
  S('b4', 'boiler', 'Монтаж котла напольного 50–100 кВт', '22000 ₽', 'flame-outline'),
  S('b5', 'boiler', 'Монтаж накопительного водонагревателя газового до 200/300 л', 'от 10000 до 13000 ₽', 'water-outline'),
  S('b6', 'boiler', 'Монтаж накопительного водонагревателя газового до 500 л', '15500 ₽', 'water-outline'),
  S('b7', 'boiler', 'Монтаж водонагревателя косвенного нагрева до 200/300 л', 'от 15000 до 19000 ₽', 'water-outline'),
  S('b8', 'boiler', 'Монтаж водонагревателя косвенного нагрева до 500 л', '25000 ₽', 'water-outline'),
  S('b9', 'boiler', 'Монтаж электрического бойлера', '6500 ₽', 'flash-outline'),
  S('b10', 'boiler', 'Монтаж газовой колонки', '5000 ₽', 'flame-outline'),
  S('b11', 'boiler', 'Монтаж контура циркуляции с насосом и смес. узлом', '8500 ₽', 'sync-outline'),
  S('b12', 'boiler', 'Монтаж контура циркуляции с насосом', '8000 ₽', 'sync-outline'),
  S('b13', 'boiler', 'Монтаж контура узла рециркуляции', '6000 ₽', 'sync-outline'),
  S('b14', 'boiler', 'Монтаж гидрострелки до 80 кВт', '4000 ₽', 'funnel-outline'),
  S('b15', 'boiler', 'Монтаж гидрострелки свыше 80 кВт', '4500 ₽', 'funnel-outline'),
  S('b16', 'boiler', 'Обвязка теплообменника до 100 кВт', '10500 ₽', 'sync-outline'),
  S('b17', 'boiler', 'Обвязка теплообменника свыше 100 кВт', '13000 ₽', 'sync-outline'),
  S('b18', 'boiler', 'Монтаж расширительного бака', '3500 ₽', 'ellipse-outline'),
  S('b19', 'boiler', 'Монтаж распределительного коллектора до 100 кВт', '4500 ₽', 'git-merge-outline'),
  S('b20', 'boiler', 'Монтаж распределительного коллектора свыше 100 кВт', '6000 ₽', 'git-merge-outline'),
  S('b21', 'boiler', 'Монтаж коллектора-разделителя до 90 кВт', '6500 ₽', 'git-merge-outline'),
  S('b22', 'boiler', 'Монтаж турбовытяжки напольного котла', '6500 ₽', 'cloud-outline'),
  S('b23', 'boiler', 'Монтаж узла подпитки', '2500 ₽', 'water-outline'),
  S('b24', 'boiler', 'Монтаж газового редуктора', '2000 ₽', 'settings-outline'),
  S('b25', 'boiler', 'Монтаж групп быстрого монтажа', '7000 ₽', 'flash-outline'),
  S('b26', 'boiler', 'Монтаж трубой из нержавейки (+30% к стоимости)', 'договорная', 'add-circle-outline'),
  S('c1', 'chimney', 'Монтаж дымохода (одностенная) до 5 м', '1500 ₽', 'cloud-outline'),
  S('c2', 'chimney', 'Монтаж дымохода (двустенная) до 5 м', '2000 ₽', 'cloud-outline'),
  S('c3', 'chimney', 'Монтаж дымохода по наружней стене (двуст.)', '2500 ₽', 'cloud-outline'),
  S('c4', 'chimney', 'Монтаж дефлектора', '2000 ₽', 'airplane-outline'),
  S('c5', 'chimney', 'Монтаж фасонины дымохода (тройники, углы)', 'от 500 ₽', 'git-branch-outline'),
  S('c6', 'chimney', 'Герметичный проход дымохода через кровлю', '3500 ₽', 'home-outline'),
  S('c7', 'chimney', 'Монтажная площадка', '1500 ₽', 'square-outline'),
  S('w1', 'water', 'Монтаж точки водоснабжения', '1300 ₽', 'water-outline'),
  S('w2', 'water', 'Врезка в трубопровод ХВС ф32–63', '3000 ₽', 'git-merge-outline'),
  S('w3', 'water', 'Монтаж редуктора давления ХВС', '2000 ₽', 'settings-outline'),
  S('w4', 'water', 'Монтаж повышающего насоса бытового с байпасом', '6500 ₽', 'arrow-up-circle-outline'),
  S('w5', 'water', 'Монтаж повышающего насоса полупромышленного', '9000 ₽', 'arrow-up-circle-outline'),
  S('w6', 'water', 'Монтаж погружного/скважинного/колодезного насоса', '6500 ₽', 'water-outline'),
  S('w7', 'water', 'Установка водяного счётчика 1/2"–1"', 'от 2500 до 3500 ₽', 'speedometer-outline'),
  S('w8', 'water', 'Установка и обвязка ёмкости до 1000 л', '6500 ₽', 'cube-outline'),
  S('w9', 'water', 'Установка и обвязка ёмкости до 5000 л', '9000 ₽', 'cube-outline'),
  S('w10', 'water', 'Установка и обвязка ёмкости до 10000 л', '10500 ₽', 'cube-outline'),
  S('w11', 'water', 'Монтаж коллектора водоснабжения (1 выход)', '800 ₽', 'git-merge-outline'),
  S('w12', 'water', 'Монтаж скрытого смесителя (встраиваемая часть)', 'от 6000 до 7000 ₽', 'options-outline'),
  S('w13', 'water', 'Узел ввода (кран, грязевик, счётчик, клапан)', '6500 ₽', 'enter-outline'),
  S('w14', 'water', 'Сантехшкаф (комплект)', '23000 ₽', 'file-tray-stacked-outline'),
  S('w15', 'water', 'Байпас (кран, тройники)', '2000 ₽', 'git-branch-outline'),
  S('w16', 'water', 'КИП и арматура (манометр, термометр и т.п.)', '800 ₽', 'speedometer-outline'),
  S('w17', 'water', 'Краны, вентили до 1"', '1500 ₽', 'water-outline'),
  S('w18', 'water', 'Краны, вентили до 2"', '2000 ₽', 'water-outline'),
  S('s1', 'sewer', 'Монтаж точки канализации', '1300 ₽', 'git-network-outline'),
  S('s2', 'sewer', 'Монтаж внутр. канализац. трубопровода ф50', 'от 400 до 700 ₽', 'git-network-outline'),
  S('s3', 'sewer', 'Монтаж внутр. канализац. трубопровода ф110', 'от 500 до 800 ₽', 'git-network-outline'),
  S('s4', 'sewer', 'Монтаж внутр. канализац. трубопровода ф160', 'от 600 до 900 ₽', 'git-network-outline'),
  S('s5', 'sewer', 'Монтаж внутр. канализац. трубопровода ф200', 'от 700 до 900 ₽', 'git-network-outline'),
  S('s6', 'sewer', 'Монтаж наружного канализац. трубопровода ф110', '900 ₽', 'git-network-outline'),
  S('s7', 'sewer', 'Монтаж наружного канализац. трубопровода ф160', '1000 ₽', 'git-network-outline'),
  S('s8', 'sewer', 'Монтаж наружного канализац. трубопровода ф200', '1200 ₽', 'git-network-outline'),
  S('s9', 'sewer', 'Монтаж наружного канализац. трубопровода ф250', '1600 ₽', 'git-network-outline'),
  S('s10', 'sewer', 'Монтаж канализационного стояка ф110', '2500 ₽', 'git-network-outline'),
  S('s11', 'sewer', 'Врезка в действующую канализацию ф110–ф200', 'от 3000 до 5000 ₽', 'git-merge-outline'),
  S('s12', 'sewer', 'Соединение канализац. стояка в лежак', '1200 ₽', 'link-outline'),
  S('s13', 'sewer', 'Соединение канализац. лежака в стояк', '800 ₽', 'link-outline'),
  S('s14', 'sewer', 'Монтаж канал. компенсатора в сущ. трубу ф50', '700 ₽', 'swap-horizontal-outline'),
  S('s15', 'sewer', 'Монтаж канал. компенсатора в сущ. трубу ф110', '1500 ₽', 'swap-horizontal-outline'),
  S('s16', 'sewer', 'Монтаж канализационного деаэратора ф50–ф110', '900 ₽', 'cloud-outline'),
  S('s17', 'sewer', 'Монтаж канализационной ревизии', '500 ₽', 'eye-outline'),
  S('s18', 'sewer', 'Монтаж фекального насоса', '5000 ₽', 'arrow-up-circle-outline'),
  S('s19', 'sewer', 'Установка трапа сливного уличного ф110–ф200', '3000 ₽', 'water-outline'),
  S('s20', 'sewer', 'Монтаж душевого лотка (щелевой трап)', '6000 ₽', 'water-outline'),
  S('s21', 'sewer', 'Монтаж душевого трапа', '3500 ₽', 'water-outline'),
  S('s22', 'sewer', 'Монтаж квадратного трапа', '1200 ₽', 'water-outline'),
  S('s23', 'sewer', 'Замена канализационного стояка (чугун/пласт.)', '13000 ₽', 'refresh-outline'),
  S('s24', 'sewer', 'Монтаж канализационного колодца с люком', 'от 4000 до 9000 ₽', 'ellipse-outline'),
  S('s25', 'sewer', 'Монтаж дренажных лотков', '2500 ₽', 'remove-outline'),
  S('s26', 'sewer', 'Шумоизоляция стояка', '2500 ₽', 'volume-mute-outline'),
  S('s27', 'sewer', 'Шумоизоляция крестовины', '2000 ₽', 'volume-mute-outline'),
  S('p1', 'pipes', 'Монтаж трубопровода ф16–ф20 м/п, PEX, PERT', '150 ₽', 'git-branch-outline'),
  S('p2', 'pipes', 'Монтаж трубопровода ф25–ф32 м/п, PEX, PERT', '200 ₽', 'git-branch-outline'),
  S('p3', 'pipes', 'Монтаж трубопровода ф20–ф25 ППР', '170 ₽', 'git-branch-outline'),
  S('p4', 'pipes', 'Монтаж трубопровода ф32–ф40 ППР', '200 ₽', 'git-branch-outline'),
  S('p5', 'pipes', 'Монтаж трубопровода ф50–ф63 ППР', '320 ₽', 'git-branch-outline'),
  S('p6', 'pipes', 'Монтаж трубопровода ф75–ф90 ППР', 'от 500 до 700 ₽', 'git-branch-outline'),
  S('p7', 'pipes', 'Монтаж трубопровода ф110 ППР', '800 ₽', 'git-branch-outline'),
  S('p8', 'pipes', 'Монтаж трубопровода ф125 ППР', '900 ₽', 'git-branch-outline'),
  S('p9', 'pipes', 'Монтаж трубопровода по стене ф16–ф25', '170 ₽', 'git-branch-outline'),
  S('p10', 'pipes', 'Монтаж трубопровода по стене ф32–ф40', '250 ₽', 'git-branch-outline'),
  S('p11', 'pipes', 'Монтаж трубопровода по стене ф50–ф63', '450 ₽', 'git-branch-outline'),
  S('p12', 'pipes', 'Монтаж трубопровода по стене ф75', '650 ₽', 'git-branch-outline'),
  S('p13', 'pipes', 'Монтаж трубопровода по стене ф90', '800 ₽', 'git-branch-outline'),
  S('p14', 'pipes', 'Монтаж трубопровода по стене ф110', '900 ₽', 'git-branch-outline'),
  S('p15', 'pipes', 'Монтаж трубопровода по стене ф125', '1200 ₽', 'git-branch-outline'),
  S('p16', 'pipes', 'Монтаж трубопровода по потолку ф16–ф25', '250 ₽', 'git-branch-outline'),
  S('p17', 'pipes', 'Монтаж трубопровода по потолку ф32–ф40', '400 ₽', 'git-branch-outline'),
  S('p18', 'pipes', 'Монтаж трубопровода по потолку ф50–ф63', '600 ₽', 'git-branch-outline'),
  S('p19', 'pipes', 'Монтаж трубопровода по потолку ф75', '800 ₽', 'git-branch-outline'),
  S('p20', 'pipes', 'Монтаж трубопровода по потолку ф90', '900 ₽', 'git-branch-outline'),
  S('p21', 'pipes', 'Монтаж трубопровода по потолку ф110', '1200 ₽', 'git-branch-outline'),
  S('p22', 'pipes', 'Монтаж трубопровода по потолку ф125', '1500 ₽', 'git-branch-outline'),
  S('p23', 'pipes', 'Труба армированная алюминиевой фольгой (+30% к монтажу)', 'договорная', 'add-circle-outline'),
  S('i1', 'insulation', 'Теплоизоляция ф20–ф40', '45 ₽', 'layers-outline'),
  S('i2', 'insulation', 'Теплоизоляция ф50', '55 ₽', 'layers-outline'),
  S('i3', 'insulation', 'Теплоизоляция ф63', '70 ₽', 'layers-outline'),
  S('i4', 'insulation', 'Теплоизоляция ф75', '80 ₽', 'layers-outline'),
  S('i5', 'insulation', 'Теплоизоляция ф90', '90 ₽', 'layers-outline'),
  S('i6', 'insulation', 'Теплоизоляция ф110', '100 ₽', 'layers-outline'),
  S('i7', 'insulation', 'Утепление усиленное ф20–ф40', '110 ₽', 'layers-outline'),
  S('i8', 'insulation', 'Утепление усиленное ф50', '120 ₽', 'layers-outline'),
  S('i9', 'insulation', 'Утепление усиленное ф63', '200 ₽', 'layers-outline'),
  S('i10', 'insulation', 'Утепление усиленное ф75', '250 ₽', 'layers-outline'),
  S('i11', 'insulation', 'Утепление усиленное ф90', '300 ₽', 'layers-outline'),
  S('i12', 'insulation', 'Утепление усиленное ф110', '400 ₽', 'layers-outline'),
  S('f1', 'filtration', 'Монтаж колонного фильтра (1 колонна)', '13000 ₽', 'filter-outline'),
  S('f2', 'filtration', 'Монтаж кабинетного фильтра', '10500 ₽', 'filter-outline'),
  S('f3', 'filtration', 'Монтаж солевого бака', '1500 ₽', 'cube-outline'),
  S('f4', 'filtration', 'Монтаж ультрафиолетовой лампы', '4000 ₽', 'flash-outline'),
  S('f5', 'filtration', 'Монтаж магистрального фильтра (большая колба)', '4000 ₽', 'filter-outline'),
  S('f6', 'filtration', 'Фильтр картриджный (маленькая колба)', '2000 ₽', 'filter-outline'),
  S('f7', 'filtration', 'Установка фильтра сетчатого косого (грязевик)', '2000 ₽', 'filter-outline'),
  S('f8', 'filtration', 'Установка фильтра сетчатого самопромывного ступенчатого', '3000 ₽', 'filter-outline'),
  S('f9', 'filtration', 'Монтаж фильтра кухонного 3х', '4000 ₽', 'filter-outline'),
  S('f10', 'filtration', 'Монтаж кухонного фильтра с обратным осмосом', '6000 ₽', 'filter-outline'),
  S('a1', 'automation', 'Датчик уличной температуры', '2500 ₽', 'thermometer-outline'),
  S('a2', 'automation', 'Датчик температуры бойлера (БКН)', '2000 ₽', 'thermometer-outline'),
  S('a3', 'automation', 'Комнатный термостат', 'от 2500 до 3000 ₽', 'thermometer-outline'),
  S('a4', 'automation', 'Автоматика управления котлом и отоплением', '15000 ₽', 'hardware-chip-outline'),
  S('a5', 'automation', 'Установка сервоприводов коллектора', '700 ₽', 'hardware-chip-outline'),
  S('a6', 'automation', 'Зональное управление тёплыми полами, радиаторами', '6500 ₽', 'hardware-chip-outline'),
  S('a7', 'automation', 'Система антипротечки', '6500 ₽', 'shield-checkmark-outline'),
  S('a8', 'automation', 'Коммутатор, контроллер (6–8 выводов)', '6500 ₽', 'hardware-chip-outline'),
  S('a9', 'automation', 'Установка доп. модуля к контроллеру', '4000 ₽', 'hardware-chip-outline'),
  S('a10', 'automation', 'Монтаж автоматики насоса водоснабжения', '2000 ₽', 'hardware-chip-outline'),
  S('a11', 'automation', 'Монтаж радиаторной термоголовки', '400 ₽', 'thermometer-outline'),
  S('pc1', 'commissioning', 'Запуск и наладка настенного котла', '3000 ₽', 'rocket-outline'),
  S('pc2', 'commissioning', 'Запуск и наладка напольного котла', '3500 ₽', 'rocket-outline'),
  S('pc3', 'commissioning', 'Опрессовка и запуск системы отопления (до 7 рад.)', '2500 ₽', 'water-outline'),
  S('pc4', 'commissioning', 'Заполнение системы теплоносителем', '70 ₽', 'water-outline'),
  S('r1', 'repair', 'Выезд мастера на диагностику, сервис, ремонт', '2000 ₽', 'car-outline'),
  S('r2', 'repair', 'Замена турбины', 'от 2000 до 3000 ₽', 'settings-outline'),
  S('r3', 'repair', 'Замена датчиков', 'от 800 до 1500 ₽', 'thermometer-outline'),
  S('r4', 'repair', 'Замена циркуляционного насоса навесного котла', 'от 2000 до 2500 ₽', 'sync-outline'),
  S('r5', 'repair', 'Замена платы котла', 'от 2000 до 5000 ₽', 'hardware-chip-outline'),
  S('r6', 'repair', 'Замена трёхходового крана котла', 'от 1000 до 1500 ₽', 'git-merge-outline'),
  S('r7', 'repair', 'Замена газового клапана котла', 'от 1000 до 3000 ₽', 'flame-outline'),
  S('r8', 'repair', 'Замена сервопривода котла', 'от 1200 до 1800 ₽', 'hardware-chip-outline'),
  S('r9', 'repair', 'Замена крана подпитки котла', 'от 1000 до 1500 ₽', 'water-outline'),
  S('r10', 'repair', 'Замена теплообменника котла', 'от 2500 до 3000 ₽', 'sync-outline'),
  S('r11', 'repair', 'Замена вторичного теплообменника', 'от 2000 до 2500 ₽', 'sync-outline'),
  S('r12', 'repair', 'Снять котёл на полную диагностику (с установкой)', 'от 7000 до 8000 ₽', 'construct-outline'),
  S('r13', 'repair', 'Ремонт / замена смесителя', '3000 ₽', 'water-outline'),
  S('san1', 'sanitary', 'Инсталляция рамы без подводки', '7000 ₽', 'home-outline'),
  S('san2', 'sanitary', 'Установка чаши на инсталляцию', '4500 ₽', 'ellipse-outline'),
  S('san3', 'sanitary', 'Установка унитаза', '3500 ₽', 'ellipse-outline'),
  S('san4', 'sanitary', 'Установка чаши генуа', '6500 ₽', 'ellipse-outline'),
  S('san5', 'sanitary', 'Раковина с тумбой и зеркалом', '9000 ₽', 'water-outline'),
  S('san6', 'sanitary', 'Установка зеркала', '2000 ₽', 'square-outline'),
  S('san7', 'sanitary', 'Умывальник (тюльпан)', '4500 ₽', 'water-outline'),
  S('san8', 'sanitary', 'Умывальник', '3000 ₽', 'water-outline'),
  S('san9', 'sanitary', 'Биде', '5000 ₽', 'water-outline'),
  S('san10', 'sanitary', 'Писсуар', '3000 ₽', 'water-outline'),
  S('san11', 'sanitary', 'Смеситель на раковину, умывальник, ванну, биде', '2500 ₽', 'water-outline'),
  S('san12', 'sanitary', 'Смеситель скрытый наружная часть', 'от 3500 до 6000 ₽', 'options-outline'),
  S('san13', 'sanitary', 'Душевая стойка', '3500 ₽', 'rainy-outline'),
  S('san14', 'sanitary', 'Душевая кабина', 'от 8000 ₽', 'rainy-outline'),
  S('san15', 'sanitary', 'Ванная металлическая, чугунная, акриловая', 'от 3000 ₽', 'water-outline'),
  S('san16', 'sanitary', 'Ванная акриловая с джакузи', 'от 7000 ₽', 'water-outline'),
  S('san17', 'sanitary', 'Поддон', 'от 2000 ₽', 'ellipse-outline'),
  S('san18', 'sanitary', 'Установка стиральной/посудомоечной машины', 'от 2500 ₽', 'cube-outline'),
  S('san19', 'sanitary', 'Установка полотенцесушителя водяного/электрического', 'от 2500 до 3000 ₽', 'thermometer-outline'),
  S('san20', 'sanitary', 'Аксессуары', '1000 ₽', 'add-circle-outline'),
  S('ch1', 'chasing', 'Штроба ф16–ф32 (пеноблок/кирпич/бетон)', 'от 800 до 1500 ₽', 'hammer-outline'),
  S('ch2', 'chasing', 'Штроба ф40–ф63 (пеноблок/кирпич/бетон)', 'от 900 до 1600 ₽', 'hammer-outline'),
  S('ch3', 'chasing', 'Штроба ф75–ф110 (пеноблок/кирпич/бетон)', 'от 1200 до 2300 ₽', 'hammer-outline'),
  S('ch4', 'chasing', 'Штроба 120×120 – 120×400 (пеноблок/кирпич/бетон)', 'от 1800 до 3700 ₽', 'hammer-outline'),
  S('ch5', 'chasing', 'Сверление отверстий ф25–ф82', 'от 25 до 45 ₽', 'ellipse-outline'),
  S('ch6', 'chasing', 'Сверление отверстий ф92–ф132', 'от 30 до 50 ₽', 'ellipse-outline'),
  S('ch7', 'chasing', 'Разбивка ниши под ШРВ №1, №2, №3 (кирпич)', '5000 ₽', 'square-outline'),
  S('ch8', 'chasing', 'Разбивка ниши под ШРВ №4, №5 (кирпич)', '5500 ₽', 'square-outline'),
  S('ch9', 'chasing', 'Разбивка ниши под ШРВ №6, №7 (кирпич)', '6000 ₽', 'square-outline'),
  S('ch10', 'chasing', 'Пробивка отверстий 100×100×120', 'от 900 до 1900 ₽', 'hammer-outline'),
  S('ch11', 'chasing', 'Пробивка отверстий 100×100×240', 'от 800 до 1900 ₽', 'hammer-outline'),
  S('ch12', 'chasing', 'Пробивка отверстий 100×240×360', 'от 1000 до 2500 ₽', 'hammer-outline'),
  S('ch13', 'chasing', 'Прочие отверстия, штробы (по факту)', 'договорная', 'ellipsis-horizontal-outline'),
  S('ch14', 'chasing', 'Штукатурка штроб', '500 ₽', 'brush-outline'),
  S('e1', 'extra', 'Снятие/установка радиатора для малярных работ', '2000 ₽', 'repeat-outline'),
  S('e2', 'extra', 'Снятие/установка котла навесного для малярных работ', 'от 4000 до 5000 ₽', 'repeat-outline'),
  S('e3', 'extra', 'Подготовительные работы для тёплого пола', '130 ₽', 'construct-outline'),
  S('e4', 'extra', 'Расчёт систем отопления', '100 ₽', 'calculator-outline'),
  S('e5', 'extra', 'Расчёт систем водоснабжения и канализации', '70 ₽', 'calculator-outline'),
  S('e6', 'extra', 'Расчёт котельной', '400 ₽', 'calculator-outline'),
  S('e7', 'extra', 'Уборка помещения', 'от 150 до 200 ₽', 'trash-outline'),
  S('wl1', 'welding', 'Сварка стыка Ø15', 'от 500 ₽', 'bonfire-outline'),
  S('wl2', 'welding', 'Сварка стыка Ø20', 'от 650 ₽', 'bonfire-outline'),
  S('wl3', 'welding', 'Сварка стыка Ø25', 'от 850 ₽', 'bonfire-outline'),
  S('wl4', 'welding', 'Сварка стыка Ø32', 'от 1000 ₽', 'bonfire-outline'),
  S('wl5', 'welding', 'Сварка стыка Ø40', 'от 1500 ₽', 'bonfire-outline'),
  S('wl6', 'welding', 'Сварка стыка Ø50', 'от 2000 ₽', 'bonfire-outline'),
];

const INITIAL_MESSAGES = [
  { id: 'd1', type: 'date', text: 'Сегодня' },
  { id: 'm1', author: 'Сергей', text: 'Кто сегодня на Ленина 15?', time: '09:12', mine: false, type: 'text' },
  { id: 'm2', author: 'Вы', text: 'Я буду после обеда', time: '09:15', mine: true, type: 'text', read: true },
  { id: 'm3', author: 'Андрей', text: 'Подскажите, какой котёл ставили на Мира 8?', time: '09:40', mine: false, type: 'text' },
  { id: 'm4', author: 'Сергей', text: 'Baxi Luna-3, если что — у меня есть инструкция', time: '09:42', mine: false, type: 'text' },
  { id: 'm5', author: 'Вы', text: 'Спасибо, буду знать', time: '09:45', mine: true, type: 'text', read: true },
];
const STATUS_LABELS = { new: 'Новая', on_way: 'В пути', on_site: 'На объекте', done: 'Завершена' };
const pluralServices = (n) => { const m10 = n % 10, m100 = n % 100; if (m10 === 1 && m100 !== 11) return 'услуга'; if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return 'услуги'; return 'услуг'; };
const renderStars = (rating, size = 14) => { const arr = []; for (let i = 1; i <= 5; i++) { arr.push(<Ionicons key={i} name={i <= Math.round(rating) ? 'star' : 'star-outline'} size={size} color="#f39c12" style={{ marginRight: 2 }} />); } return arr; };
const formatSec = (sec) => { const s = Math.max(0, Math.floor(sec || 0)); const m = Math.floor(s / 60); const r = s % 60; return `${m}:${String(r).padStart(2, '0')}`; };
const cleanPhone = (p) => String(p).replace(/[^\d+]/g, '');

const softVibrate = (ms = 12) => { try { Vibration.vibrate(ms); } catch (e) {} };

function AnimatedIcon({ name, size = 28, color = '#fff', style }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(scale, { toValue: 1.15, duration: 900, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 900, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [scale]);
  return <Animated.View style={[{ transform: [{ scale }] }, style]}><Ionicons name={name} size={size} color={color} /></Animated.View>;
}

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
  const iconPulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 500, delay: index * 100, useNativeDriver: true }).start();
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(iconPulse, { toValue: 1.12, duration: 1600, useNativeDriver: true }),
      Animated.timing(iconPulse, { toValue: 1, duration: 1600, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [anim, iconPulse, index]);
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });
  return (
    <Animated.View style={[styles.categoryCard, { backgroundColor: category.color + '18', borderColor: category.color + '55', opacity: anim, transform: [{ translateY }, { scale: press }] }]}>
      <TouchableOpacity style={styles.categoryCardInner} activeOpacity={1}
        onPressIn={() => Animated.spring(press, { toValue: 0.95, useNativeDriver: true, speed: 40 }).start()}
        onPressOut={() => Animated.spring(press, { toValue: 1, useNativeDriver: true, speed: 40 }).start()}
        onPress={onPress}>
        <Animated.View style={{ transform: [{ scale: iconPulse }], alignSelf: 'flex-start' }}>
          <View style={[styles.categoryIconCircle, { backgroundColor: category.color }]}><Ionicons name={category.icon} size={30} color="#fff" /></View>
        </Animated.View>
        <View style={{ flex: 1 }} />
        <Text style={styles.categoryCardTitle}>{category.title}</Text>
        <Text style={[styles.categoryCardCount, { color: category.color }]}>{count} {pluralServices(count)}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

function VideoPlayerFull({ uri }) {
  const player = useVideoPlayer(uri, (p) => { p.loop = false; try { p.play(); } catch (e) {} });
  return <VideoView player={player} style={styles.videoFull} contentFit="contain" nativeControls />;
}

function VideoMessage({ uri }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TouchableOpacity style={styles.videoPreview} onPress={() => setOpen(true)} activeOpacity={0.85}>
        <View style={styles.videoPreviewPlay}><Ionicons name="play" size={28} color="#fff" /></View>
        <View style={styles.videoPreviewLabel}><Ionicons name="videocam" size={11} color="#fff" /><Text style={styles.videoPreviewLabelText}>Видео</Text></View>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.videoModal}>
          <TouchableOpacity style={styles.videoModalClose} onPress={() => setOpen(false)}><Ionicons name="close" size={28} color="#fff" /></TouchableOpacity>
          {open && <VideoPlayerFull uri={uri} />}
        </View>
      </Modal>
    </>
  );
}

const WAVE_BARS = 30;
const WAVE_HEIGHTS = Array.from({ length: WAVE_BARS }, (_, i) => { const seed = (i * 7 + 3) % 11; return 6 + (seed % 5) * 3 + (i % 3) * 2; });

function VoiceMessage({ uri, duration }) {
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  useEffect(() => { if (uri) { try { player.replace({ uri }); } catch (e) {} } }, [uri, player]);
  const handlePlayPause = () => {
    try {
      if (status.playing) player.pause();
      else { if (status.duration > 0 && status.currentTime >= status.duration) player.seekTo(0); player.play(); }
    } catch (e) { Alert.alert('Ошибка', String(e.message || e)); }
  };
  const total = Math.round(duration || status.duration || 0);
  const current = Math.floor(status.currentTime || 0);
  const progress = total > 0 ? Math.min(1, current / total) : 0;
  const playedBars = Math.floor(progress * WAVE_BARS);
  return (
    <View style={styles.voiceRow}>
      <TouchableOpacity onPress={handlePlayPause} style={styles.voicePlayBtn} activeOpacity={0.7}><Ionicons name={status.playing ? 'pause' : 'play'} size={18} color="#fff" /></TouchableOpacity>
      <View style={styles.voiceWaveWrap}>
        {WAVE_HEIGHTS.map((h, i) => (<View key={i} style={[styles.voiceWaveBar, { height: h, backgroundColor: i < playedBars ? '#53bdeb' : 'rgba(83,189,235,0.35)' }]} />))}
      </View>
      <Text style={styles.voiceDuration}>{formatSec(current)}/{formatSec(total)}</Text>
    </View>
  );
}

function AttachPanel({ visible, onPhoto, onVideo, onClose }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(340)).current;
  const photoAnim = useRef(new Animated.Value(0)).current;
  const videoAnim = useRef(new Animated.Value(0)).current;
  const photoPress = useRef(new Animated.Value(1)).current;
  const videoPress = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, speed: 16, bounciness: 4 }),
        Animated.spring(photoAnim, { toValue: 1, delay: 90, useNativeDriver: true, speed: 18, bounciness: 10 }),
        Animated.spring(videoAnim, { toValue: 1, delay: 170, useNativeDriver: true, speed: 18, bounciness: 10 }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 340, duration: 200, useNativeDriver: true }),
        Animated.timing(photoAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(videoAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const photoScale = photoAnim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });
  const videoScale = videoAnim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });

  return (
    <Animated.View pointerEvents={visible ? 'auto' : 'none'} style={[styles.attachOverlay, { opacity }]}>
      <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[styles.attachSheet, { transform: [{ translateY }] }]}>
        <View style={styles.attachGrabber} />
        <Text style={styles.attachSheetTitle}>Прикрепить</Text>
        <View style={styles.attachTilesRow}>
          <Animated.View style={{ opacity: photoAnim, transform: [{ scale: photoScale }, { scale: photoPress }] }}>
            <TouchableOpacity activeOpacity={1}
              onPressIn={() => Animated.spring(photoPress, { toValue: 0.9, useNativeDriver: true, speed: 30 }).start()}
              onPressOut={() => Animated.spring(photoPress, { toValue: 1, useNativeDriver: true, speed: 30 }).start()}
              onPress={onPhoto} style={styles.attachTileWrap}>
              <View style={[styles.attachTile, { backgroundColor: '#0ea5e9' }]}><Ionicons name="images" size={22} color="#fff" /></View>
              <Text style={styles.attachTileLabel}>Фото</Text>
            </TouchableOpacity>
          </Animated.View>
          <Animated.View style={{ opacity: videoAnim, transform: [{ scale: videoScale }, { scale: videoPress }] }}>
            <TouchableOpacity activeOpacity={1}
              onPressIn={() => Animated.spring(videoPress, { toValue: 0.9, useNativeDriver: true, speed: 30 }).start()}
              onPressOut={() => Animated.spring(videoPress, { toValue: 1, useNativeDriver: true, speed: 30 }).start()}
              onPress={onVideo} style={styles.attachTileWrap}>
              <View style={[styles.attachTile, { backgroundColor: '#e74c3c' }]}><Ionicons name="videocam" size={22} color="#fff" /></View>
              <Text style={styles.attachTileLabel}>Видео</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

function FadeInScreen({ children, duration = 400 }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.98)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
      Animated.timing(scale, { toValue: 1, duration, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
    ]).start();
  }, [opacity, scale, duration]);
  return <Animated.View style={{ flex: 1, opacity, transform: [{ scale }] }}>{children}</Animated.View>;
}

const HEAT_PARTICLES = Array.from({ length: 18 }, (_, i) => {
  const isEmber = i % 3 === 0;
  return { id: i, type: isEmber ? 'ember' : 'steam', size: isEmber ? 3 + (i * 7) % 5 : 18 + (i * 13) % 32, startX: (i * 37) % 100, delay: (i * 823) % 6000, duration: 6000 + (i * 1000) % 7000, drift: ((i * 31) % 100) - 50 };
});

function RisingParticle({ type, size, startX, delay, duration, drift }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([Animated.delay(delay), Animated.timing(anim, { toValue: 1, duration, useNativeDriver: true, easing: Easing.out(Easing.quad) }), Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true })]));
    loop.start();
    return () => loop.stop();
  }, [anim, delay, duration]);
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [50, -900] });
  const translateX = anim.interpolate({ inputRange: [0, 0.4, 0.7, 1], outputRange: [0, drift * 0.5, drift, drift * 0.6] });
  const opacity = anim.interpolate({ inputRange: [0, 0.1, 0.5, 0.9, 1], outputRange: [0, type === 'ember' ? 0.95 : 0.35, type === 'ember' ? 0.7 : 0.25, type === 'ember' ? 0.4 : 0.1, 0] });
  const scale = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.5, 1.15, 0.85] });
  const isEmber = type === 'ember';
  return (
    <Animated.View style={{ position: 'absolute', bottom: -20, left: `${startX}%`, width: size, height: size, borderRadius: size / 2, backgroundColor: isEmber ? '#ff9a4a' : 'rgba(255, 210, 180, 0.7)', opacity, transform: [{ translateY }, { translateX }, { scale }], ...(isEmber && { shadowColor: '#ff6b35', shadowOpacity: 1, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } }) }} />
  );
}

function HeatWave({ delay, duration, top, color, thickness = 30 }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([Animated.delay(delay), Animated.timing(anim, { toValue: 1, duration, useNativeDriver: true, easing: Easing.inOut(Easing.sin) })]));
    loop.start();
    return () => loop.stop();
  }, [anim, delay, duration]);
  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [-150, 150] });
  const opacity = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.02, 0.07, 0.02] });
  return <Animated.View pointerEvents="none" style={{ position: 'absolute', top, left: '-20%', right: '-20%', height: thickness, borderRadius: thickness / 2, backgroundColor: color, opacity, transform: [{ translateX }] }} />;
}

function HeatingBackground() {
  const pulse1 = useRef(new Animated.Value(0)).current;
  const pulse2 = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop1 = Animated.loop(Animated.sequence([Animated.timing(pulse1, { toValue: 1, duration: 2500, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }), Animated.timing(pulse1, { toValue: 0, duration: 2500, useNativeDriver: true, easing: Easing.inOut(Easing.sin) })]));
    loop1.start();
    const loop2 = Animated.loop(Animated.sequence([Animated.timing(pulse2, { toValue: 1, duration: 3500, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }), Animated.timing(pulse2, { toValue: 0, duration: 3500, useNativeDriver: true, easing: Easing.inOut(Easing.sin) })]));
    loop2.start();
    return () => { loop1.stop(); loop2.stop(); };
  }, []);
  const glow1Opacity = pulse1.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.22] });
  const glow1Scale = pulse1.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.05] });
  const glow2Opacity = pulse2.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.30] });
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: '#0a0505' }} />
      <Animated.View style={{ position: 'absolute', bottom: -250, left: -150, right: -150, height: 650, borderRadius: 325, backgroundColor: '#8b1a00', opacity: glow1Opacity, transform: [{ scale: glow1Scale }] }} />
      <Animated.View style={{ position: 'absolute', bottom: -180, left: -50, right: -50, height: 450, borderRadius: 225, backgroundColor: '#ff4500', opacity: glow2Opacity }} />
      <View style={{ position: 'absolute', bottom: -100, left: '20%', right: '20%', height: 300, borderRadius: 150, backgroundColor: '#ff8c00', opacity: 0.12 }} />
      <HeatWave delay={0} duration={9000} top="15%" color="#ff6b35" thickness={25} />
      <HeatWave delay={2500} duration={11000} top="35%" color="#e74c3c" thickness={35} />
      <HeatWave delay={5000} duration={10000} top="55%" color="#f39c12" thickness={20} />
      {HEAT_PARTICLES.map((p) => <RisingParticle key={p.id} {...p} />)}
    </View>
  );
}

function FlameLogoGlow() {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([Animated.timing(pulse, { toValue: 1, duration: 1400, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }), Animated.timing(pulse, { toValue: 0, duration: 1400, useNativeDriver: true, easing: Easing.inOut(Easing.sin) })]));
    loop.start();
    return () => loop.stop();
  }, []);
  const scale1 = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.25] });
  const opacity1 = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.65] });
  const scale2 = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] });
  const opacity2 = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.30] });
  return (<><Animated.View style={{ position: 'absolute', width: 70, height: 70, borderRadius: 35, backgroundColor: '#ff4500', opacity: opacity2, transform: [{ scale: scale2 }] }} /><Animated.View style={{ position: 'absolute', width: 60, height: 60, borderRadius: 30, backgroundColor: '#ff8c00', opacity: opacity1, transform: [{ scale: scale1 }] }} /></>);
}

function AnimatedRoleFooter() {
  const letters = 'BY_ODINOKI'.split('');
  const anims = useRef(letters.map(() => new Animated.Value(0))).current;
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.stagger(70, anims.map(a => Animated.timing(a, { toValue: 6, duration: 500, useNativeDriver: true, easing: Easing.out(Easing.back(2)) }))).start(() => {
      Animated.loop(Animated.sequence([Animated.timing(glow, { toValue: 1, duration: 2200, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }), Animated.timing(glow, { toValue: 0, duration: 2200, useNativeDriver: true, easing: Easing.inOut(Easing.sin) })])).start();
    });
  }, []);
  const breatheOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] });
  return (
    <Animated.View style={[styles.roleFooter, { opacity: breatheOpacity }]}>
      <View style={{ flexDirection: 'row' }}>
        {letters.map((ch, i) => {
          const translateY = anims[i].interpolate({ inputRange: [0, 1], outputRange: [16, 0] });
          return (<Animated.Text key={i} style={{ opacity: anims[i], transform: [{ translateY }], color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 3, textShadowColor: '#ff6b35', textShadowRadius: 6, textShadowOffset: { width: 0, height: 0 } }}>{ch}</Animated.Text>);
        })}
      </View>
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
    try {
      const p = cleanPhone(phone);
      const fakeEmail = `${p}@heating.local`;

      if (mode === 'register') {
        const { data, error } = await supabase.auth.signUp({ email: fakeEmail, password });
        if (error) throw error;
        if (data.user) {
          const { error: pe } = await supabase.from('profiles').insert({
            id: data.user.id, role, name: name.trim(), surname: surname.trim(), phone: p,
          });
          if (pe) throw pe;
          onAuth({ id: data.user.id, role, name: name.trim(), surname: surname.trim(), phone: p });
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: fakeEmail, password });
        if (error) throw error;
        const { data: profile, error: pe } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
        if (pe) throw pe;
        onAuth({ id: data.user.id, ...profile });
      }
    } catch (e) { Alert.alert('Ошибка', e.message || String(e)); }
    finally { setLoading(false); }
  };
  return (
    <SafeAreaView style={styles.authContainer}>
      <StatusBar barStyle="light-content" />
      <HeatingBackground />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.authScroll} keyboardShouldPersistTaps="handled">
          <View style={styles.authLogoWrap}><View style={{ width: 90, height: 90, alignItems: 'center', justifyContent: 'center' }}><FlameLogoGlow /><Ionicons name="flame" size={48} color="#ff8c42" /></View></View>
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
          <AnimatedRoleFooter />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
          if (profile) setUser({ id: session.user.id, ...profile });
        }
      } catch (e) { console.log(e); }
      finally { setLoading(false); }
    })();
  }, []);
  const handleAuth = async (u) => { setUser(u); };
  const handleLogout = async () => { await supabase.auth.signOut(); setUser(null); };
  if (loading) return (<SafeAreaView style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator color="#3498db" size="large" /></SafeAreaView>);
  if (!user) return <AuthScreen onAuth={handleAuth} />;
  if (user.role === 'client') return <FadeInScreen><ClientScreen user={user} onExit={handleLogout} /></FadeInScreen>;
  return <FadeInScreen><MasterScreen user={user} onExit={handleLogout} /></FadeInScreen>;
}

function ProfileCard({ profile, onSave, isMaster, commissionAmount = 0 }) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editSurname, setEditSurname] = useState('');
  const [editPhoto, setEditPhoto] = useState(null);
  const rank = isMaster ? getRank(profile.ordersDone) : null;
  const borderColor = isMaster ? rank.color : '#3498db';
  const startEdit = () => { setEditName(profile.name || ''); setEditSurname(profile.surname || ''); setEditPhoto(profile.avatar || null); setEditing(true); };
  const save = () => { onSave({ ...profile, name: editName.trim() || profile.name, surname: editSurname.trim(), avatar: editPhoto }); setEditing(false); };
  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Нужно разрешение', 'Разрешите доступ к галерее');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [1, 1] });
    if (!result.canceled) setEditPhoto(result.assets[0].uri);
  };
  return (
    <View style={styles.profileCard}>
      <TouchableOpacity style={[styles.profileAvatar, { borderColor }]} onPress={editing ? pickPhoto : undefined} disabled={!editing} activeOpacity={editing ? 0.7 : 1}>
        {(editing ? editPhoto : profile.avatar) ? (<Image source={{ uri: editing ? editPhoto : profile.avatar }} style={styles.avatarImage} />) : (<Ionicons name="person" size={40} color={borderColor} />)}
        {editing && (<View style={styles.avatarEditBadge}><Ionicons name="camera" size={14} color="#fff" /></View>)}
        {!editing && isMaster && rank && (<View style={[styles.rankBadge, { backgroundColor: rank.color }]}><Ionicons name={rank.icon} size={14} color="#fff" /></View>)}
      </TouchableOpacity>
      {editing ? (
        <View style={{ width: '100%', paddingHorizontal: 20 }}>
          <TextInput style={styles.profileInput} value={editName} onChangeText={setEditName} placeholder="Имя" placeholderTextColor="#666" autoCapitalize="words" />
          <TextInput style={styles.profileInput} value={editSurname} onChangeText={setEditSurname} placeholder="Фамилия" placeholderTextColor="#666" autoCapitalize="words" />
          <View style={styles.profileEditActions}>
            <TouchableOpacity style={styles.profileEditBtnCancel} onPress={() => setEditing(false)}><Text style={styles.profileEditBtnCancelText}>Отмена</Text></TouchableOpacity>
            <TouchableOpacity style={styles.profileEditBtnSave} onPress={save}><Ionicons name="checkmark" size={16} color="#fff" style={{ marginRight: 4 }} /><Text style={styles.profileEditBtnSaveText}>Сохранить</Text></TouchableOpacity>
          </View>
        </View>
      ) : (<>
        <Text style={styles.profileName}>{profile.name}{profile.surname ? ` ${profile.surname}` : ''}</Text>
        <Text style={styles.profilePhone}>{profile.phone}</Text>
        {isMaster && rank && (<View style={[styles.rankPill, { backgroundColor: rank.color + '22', borderColor: rank.color }]}><Ionicons name={rank.icon} size={16} color={rank.color} /><Text style={[styles.rankPillText, { color: rank.color }]}>{rank.title}</Text></View>)}
        <TouchableOpacity style={styles.editProfileBtn} onPress={startEdit}><Ionicons name="pencil" size={14} color="#3498db" /><Text style={styles.editProfileBtnText}>Редактировать профиль</Text></TouchableOpacity>
      </>)}
      {!editing && (
        <View style={styles.statsRow}>
          <View style={styles.statBlock}><Text style={styles.statValue}>{isMaster ? profile.ordersDone : profile.ordersCount}</Text><Text style={styles.statLabel}>заказов</Text></View>
          <View style={styles.statDivider} />
          <View style={styles.statBlock}><View style={{ flexDirection: 'row', alignItems: 'center' }}><Ionicons name="star" size={18} color="#f39c12" style={{ marginRight: 4 }} /><Text style={styles.statValue}>{profile.rating}</Text></View><Text style={styles.statLabel}>{isMaster ? profile.totalRatings : profile.reviewsCount} отзывов</Text></View>
          <View style={styles.statDivider} />
          <View style={styles.statBlock}><Text style={styles.statValue}>{isMaster ? `${profile.balance.toLocaleString('ru-RU')}₽` : `${profile.tips.toLocaleString('ru-RU')}₽`}</Text><Text style={styles.statLabel}>{isMaster ? 'заработано' : 'чаевых'}</Text></View>
        </View>
      )}
      {!editing && isMaster && (
        <View style={styles.profileCommissionNotice}>
          <Ionicons name="wallet" size={14} color="#f39c12" />
          <Text style={styles.profileCommissionText}>Комиссия сервиса: <Text style={{ color: '#f39c12', fontWeight: '700' }}>{commissionAmount.toLocaleString('ru-RU')} ₽</Text><Text style={{ color: '#888' }}>{'  ·  7% до 6000 ₽ • 5% свыше'}</Text></Text>
        </View>
      )}
    </View>
  );
}

function ClientScreen({ onExit, user }) {
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
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setLocationError('Нет доступа к геолокации'); setLocationLoading(false); return; }
      try {
        const last = await Location.getLastKnownPositionAsync({});
        if (last && last.coords) {
          const addr = await reverseGeocodeToAddress(last.coords.latitude, last.coords.longitude);
          setMyLocation({ lat: last.coords.latitude, lng: last.coords.longitude, text: addr || `${last.coords.latitude.toFixed(4)}, ${last.coords.longitude.toFixed(4)}` });
        }
      } catch (e) {}
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const addr = await reverseGeocodeToAddress(loc.coords.latitude, loc.coords.longitude);
      setMyLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude, text: addr || `${loc.coords.latitude.toFixed(4)}, ${loc.coords.longitude.toFixed(4)}` });
    } catch (e) { setLocationError('GPS недоступен — используем Москву'); }
    finally { setLocationLoading(false); }
  };
  useEffect(() => { fetchLocation(); }, []);

  // Загрузка мастеров из БД
  useEffect(() => {
    const loadMasters = async () => {
      const { data } = await supabase
        .from('profiles').select('*').eq('role', 'master')
        .not('name', 'is', null).neq('name', '')
        .not('phone', 'is', null).neq('phone', '');
      if (data) setMasters(data.map(m => ({
        ...m,
        avatar: m.avatar || 'construct',
        rank: m.rank_id || 'master',
        rating: Number(m.rating) || 5.0,
        reviewsCount: m.reviews_count || 0,
        ordersDone: m.orders_done || 0,
        about: m.about || '',
        lat: Number(m.lat) || 55.7558,
        lng: Number(m.lng) || 37.6173,
      })));
    };
    loadMasters();
    const ch = supabase.channel('masters-ch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, loadMasters)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // Загрузка заказов клиента из БД
  const loadHistory = async () => {
    const { data } = await supabase
      .from('orders').select('*, master:profiles!master_id(name, surname)')
      .eq('client_id', user.id).order('created_at', { ascending: false });
    if (data) setHistory(data.map(o => ({
      id: o.id,
      date: new Date(o.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }),
      time: new Date(o.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      items: o.items || [], total: o.total, tip: o.tip || 0,
      masterId: o.master_id,
      masterName: o.master ? `${o.master.name} ${o.master.surname || ''}`.trim() : 'Мастер будет назначен',
      status: o.status === 'done' ? 'done' : 'active',
      myReview: null, completedAt: null,
    })));
  };

  useEffect(() => {
    loadHistory();
    const ch = supabase.channel('client-orders-' + user.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `client_id=eq.${user.id}` }, loadHistory)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user.id]);

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const cartTotal = cart.reduce((s, i) => s + parsePrice(i.price) * i.qty, 0);
  const selectedMaster = selectedMasterId ? masters.find(m => m.id === selectedMasterId) : null;

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const searchResults = normalizedQuery
    ? SERVICES.filter(s => {
        const cat = CATEGORIES.find(c => c.id === s.category);
        return (
          s.title.toLowerCase().includes(normalizedQuery) ||
          (cat && cat.title.toLowerCase().includes(normalizedQuery))
        );
      })
    : [];

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
    const finalTotal = cartTotal;

    const { error } = await supabase.from('orders').insert({
      client_id: user.id,
      master_id: selectedMaster ? selectedMaster.id : null,
      total: finalTotal,
      items: finalItems,
      status: 'new',
    });
    if (error) { Alert.alert('Ошибка', error.message); return; }

    setCart([]); setSelectedMasterId(null); setView('main'); setMainTab('history');
    setProfile(p => ({ ...p, ordersCount: p.ordersCount + 1 }));
    Alert.alert('Заказ оформлен!', `${selectedMaster ? `Мастер: ${selectedMaster.name}` : 'Мастер будет назначен'}\nИтого: ${finalTotal.toLocaleString('ru-RU')} ₽`);
  };

  const openReviewForm = (order) => { setReviewingOrder(order); setReviewRating(5); setReviewText(''); setView('review'); };
  const submitReview = () => {
    if (!reviewingOrder) return;
    if (!reviewText.trim()) return Alert.alert('Напишите отзыв', 'Поделитесь впечатлением.');
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
    const newItems = existing
      ? order.items.map(i => i.id === service.id ? { ...i, qty: i.qty + 1 } : i)
      : [...order.items, { ...service, qty: 1 }];
    const newTotal = newItems.reduce((s, i) => s + parsePrice(i.price) * i.qty, 0);
    const { error } = await supabase.from('orders').update({ items: newItems, total: newTotal }).eq('id', orderId);
    if (error) { Alert.alert('Ошибка', error.message); return; }
    setHistory(prev => prev.map(o => o.id === orderId ? { ...o, items: newItems, total: newTotal } : o));
    softVibrate(10);
  };

  const completeOrder = (orderId) => {
    Alert.alert(
      'Завершить заказ?',
      'Подтвердите, что мастер выполнил все работы. После завершения добавить услуги будет нельзя.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Завершить',
          onPress: async () => {
            const { error } = await supabase.from('orders').update({ status: 'done' }).eq('id', orderId);
            if (error) { Alert.alert('Ошибка', error.message); return; }
            const now = new Date();
            setHistory(prev => prev.map(o => o.id === orderId ? {
              ...o,
              status: 'done',
              completedAt: now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }),
            } : o));
            softVibrate(15);
            Alert.alert('Готово', 'Заказ завершён');
          },
        },
      ]
    );
  };

  if (view === 'review' && reviewingOrder) {
    return (
      <SafeAreaView style={styles.clientContainer}>
        <StatusBar barStyle="light-content" />
        <View style={styles.topBarDark}><TouchableOpacity onPress={() => { setView('main'); setMainTab('history'); setReviewingOrder(null); }}><Ionicons name="arrow-back" size={26} color="#fff" /></TouchableOpacity><Text style={styles.titleLight}>Оставить отзыв</Text><View style={{ width: 26 }} /></View>
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
        <View style={styles.topBarDark}><TouchableOpacity onPress={() => { setView('main'); setMainTab('history'); setTippingOrder(null); }}><Ionicons name="arrow-back" size={26} color="#fff" /></TouchableOpacity><Text style={styles.titleLight}>Чаевые</Text><View style={{ width: 26 }} /></View>
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
        <View style={styles.topBarDark}><TouchableOpacity onPress={() => { setView(selectedMasterId === m.id ? 'cart' : 'masterSelect'); setViewingMasterId(null); }}><Ionicons name="arrow-back" size={26} color="#fff" /></TouchableOpacity><Text style={styles.titleLight}>Профиль мастера</Text><View style={{ width: 26 }} /></View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
          <View style={styles.masterProfileCard}>
            <View style={[styles.masterAvatarLarge, { borderColor: rank.color }]}><Ionicons name={m.avatar} size={44} color={rank.color} /></View>
            <Text style={styles.masterProfileName}>{m.name} {m.surname || ''}</Text>
            <View style={styles.masterRatingRow}>{renderStars(m.rating, 16)}<Text style={styles.masterRatingText}>{m.rating} · {m.reviewsCount} отзывов</Text></View>
            <View style={[styles.rankPill, { backgroundColor: rank.color + '22', borderColor: rank.color }]}><Ionicons name={rank.icon} size={14} color={rank.color} /><Text style={[styles.rankPillText, { color: rank.color }]}>{rank.title}</Text></View>
            <View style={styles.masterDistanceCard}><Ionicons name="navigate" size={16} color="#3498db" /><Text style={styles.masterDistanceCardText}>До мастера: <Text style={styles.masterDistanceCardValue}>{formatDistance(masterDistance)}</Text></Text></View>
            {m.about ? <Text style={styles.masterAbout}>{m.about}</Text> : null}
            <View style={styles.masterStatsRow}><View style={styles.masterStat}><Text style={styles.masterStatValue}>{m.ordersDone}</Text><Text style={styles.masterStatLabel}>заказов</Text></View><View style={styles.statDivider} /><View style={styles.masterStat}><Text style={styles.masterStatValue}>{m.reviewsCount}</Text><Text style={styles.masterStatLabel}>отзывов</Text></View><View style={styles.statDivider} /><View style={styles.masterStat}><Text style={styles.masterStatValue}>{m.rating}</Text><Text style={styles.masterStatLabel}>рейтинг</Text></View></View>
          </View>
          <Text style={styles.sectionTitle}>Отзывы о мастере ({revs.length})</Text>
          {revs.length === 0 ? <Text style={styles.emptyReviews}>Пока нет отзывов</Text> : revs.map((r, i) => (
            <AnimatedCard key={r.id} index={i} style={styles.reviewCard}>
              <View style={styles.reviewHeader}><View style={styles.reviewAvatar}><Text style={styles.reviewAvatarText}>{r.client.charAt(0)}</Text></View><View style={{ flex: 1 }}><Text style={styles.reviewClient}>{r.client}</Text><View style={styles.reviewStarsRow}>{renderStars(r.rating)}<Text style={styles.reviewDate}>{r.date}</Text></View></View></View>
              <Text style={styles.reviewText}>{r.text}</Text>
            </AnimatedCard>
          ))}
        </ScrollView>
        <View style={styles.masterSelectFooter}><TouchableOpacity style={[styles.checkoutBtn, { backgroundColor: selectedMasterId === m.id ? '#27ae60' : '#3498db' }]} onPress={() => { setSelectedMasterId(m.id); setViewingMasterId(null); setView('main'); }}><Text style={styles.checkoutBtnText}>{selectedMasterId === m.id ? 'Мастер выбран ✓' : 'Выбрать этого мастера'}</Text></TouchableOpacity></View>
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
            {locationLoading ? (<Text style={{ color: '#3498db', fontSize: 11, marginTop: 2 }}>Определяем геолокацию…</Text>) : locationError ? (<Text style={{ color: '#e74c3c', fontSize: 11, marginTop: 2 }}>{locationError}</Text>) : (<Text style={{ color: '#27ae60', fontSize: 11, marginTop: 2 }} numberOfLines={1}>📍 {myLocation.text}</Text>)}
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
                <View style={{ flex: 1 }}><Text style={styles.masterSelectName}>{m.name} {m.surname || ''}</Text><View style={styles.masterRatingRow}>{renderStars(m.rating, 11)}<Text style={styles.masterSelectRating}>{m.rating} · {m.reviewsCount} отзывов</Text></View><View style={styles.masterDistanceRow}><Ionicons name="navigate" size={11} color="#3498db" /><Text style={styles.masterDistanceText}>{formatDistance(mDistance)} от вас</Text></View></View>
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
        <View style={styles.topBarDark}><TouchableOpacity onPress={() => setView('main')}><Ionicons name="arrow-back" size={26} color="#fff" /></TouchableOpacity><Text style={styles.titleLight}>Корзина</Text><View style={{ width: 26 }} /></View>
        {cart.length === 0 ? (<View style={styles.emptyCart}><Ionicons name="cart-outline" size={64} color="#333" /><Text style={styles.emptyCartText}>Корзина пуста</Text><TouchableOpacity style={styles.emptyCartBtn} onPress={() => setView('main')}><Text style={styles.emptyCartBtnText}>Выбрать услуги</Text></TouchableOpacity></View>) : (
          <>
            <FlatList data={cart} keyExtractor={i => i.id} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 260 }}
              ListFooterComponent={<View style={styles.masterSection}><Text style={styles.masterSectionTitle}>Мастер</Text>{selectedMaster ? (<TouchableOpacity style={styles.masterChosenRow} onPress={() => setView('masterSelect')}><View style={styles.masterAvatarSmall}><Ionicons name={selectedMaster.avatar} size={22} color="#3498db" /></View><View style={{ flex: 1 }}><Text style={styles.masterChosenName}>{selectedMaster.name}</Text><View style={{ flexDirection: 'row', alignItems: 'center' }}>{renderStars(selectedMaster.rating, 11)}<Text style={styles.masterSelectRating}>{selectedMaster.rating}</Text></View><View style={styles.masterDistanceRow}><Ionicons name="navigate" size={11} color="#3498db" /><Text style={styles.masterDistanceText}>{formatDistance(getDistanceMeters(myLocation.lat, myLocation.lng, selectedMaster.lat, selectedMaster.lng))} от вас</Text></View></View><Text style={styles.changeMasterText}>Изменить</Text></TouchableOpacity>) : (<><TouchableOpacity style={styles.selectMasterCta} onPress={() => setView('masterSelect')}><Ionicons name="person-add" size={20} color="#3498db" /><Text style={styles.selectMasterCtaText}>Выбрать мастера</Text></TouchableOpacity><Text style={{ color: '#888', fontSize: 12, textAlign: 'center', marginTop: 10 }}>Можно оформить и без мастера — мы назначим его автоматически.</Text></>)}</View>}
              renderItem={({ item }) => {
                return (
                  <View style={styles.cartItem}>
                    <View style={styles.clientIconWrap}><Ionicons name={item.icon} size={22} color="#3498db" /></View>
                    <View style={{ flex: 1 }}><Text style={styles.cartItemTitle}>{item.title}</Text><Text style={styles.cartItemPrice}>{(parsePrice(item.price) * item.qty).toLocaleString('ru-RU')} ₽</Text></View>
                    <View style={styles.qtyControls}><TouchableOpacity style={styles.qtyBtn} onPress={() => removeFromCart(item.id)}><Ionicons name="remove" size={18} color="#fff" /></TouchableOpacity><Text style={styles.qtyText}>{item.qty}</Text><TouchableOpacity style={styles.qtyBtn} onPress={() => addToCart(item)}><Ionicons name="add" size={18} color="#fff" /></TouchableOpacity></View>
                  </View>
                );
              }}
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
        {cartCount > 0 && (<TouchableOpacity style={styles.floatingCart} onPress={() => { softVibrate(12); setView('cart'); }} activeOpacity={0.9}><Ionicons name="cart" size={22} color="#fff" /><Text style={styles.floatingCartText}>Корзина · {cartTotal.toLocaleString('ru-RU')} ₽</Text></TouchableOpacity>)}
      </SafeAreaView>
    );
  }

  if (view === 'addServices' && addingServicesTo) {
    const order = history.find(o => o.id === addingServicesTo);
    if (!order) {
      setView('main'); setMainTab('history'); setAddingServicesTo(null);
      return null;
    }
    const q = orderAddQuery.trim().toLowerCase();
    const filtered = q
      ? SERVICES.filter(s => {
          const cat = CATEGORIES.find(c => c.id === s.category);
          return s.title.toLowerCase().includes(q) || (cat && cat.title.toLowerCase().includes(q));
        })
      : SERVICES;

    return (
      <SafeAreaView style={styles.clientContainer}>
        <StatusBar barStyle="light-content" />
        <View style={styles.clientHeader}>
          <TouchableOpacity onPress={() => { setView('main'); setMainTab('history'); setAddingServicesTo(null); setOrderAddQuery(''); }} hitSlop={12}>
            <Ionicons name="arrow-back" size={26} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.clientHeaderTitle}>Добавить услуги</Text>
            <Text style={styles.clientHeaderSubtitle}>К заказу от {order.date}</Text>
          </View>
          <TouchableOpacity onPress={() => { setView('main'); setMainTab('history'); setAddingServicesTo(null); setOrderAddQuery(''); }}>
            <Text style={{ color: '#27ae60', fontSize: 15, fontWeight: '700' }}>Готово</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color="#888" style={{ marginLeft: 12 }} />
          <TextInput style={styles.searchInput} placeholder="Поиск услуги..." placeholderTextColor="#666" value={orderAddQuery} onChangeText={setOrderAddQuery} />
          {orderAddQuery.length > 0 && (
            <TouchableOpacity onPress={() => setOrderAddQuery('')} hitSlop={8} style={{ paddingRight: 12 }}>
              <Ionicons name="close-circle" size={18} color="#888" />
            </TouchableOpacity>
          )}
        </View>

        <View style={{ paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: '#888', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>Текущий итог заказа</Text>
          <Text style={{ color: '#27ae60', fontSize: 16, fontWeight: '700' }}>{order.total.toLocaleString('ru-RU')} ₽</Text>
        </View>

        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 16, paddingTop: 4 }}
          ListEmptyComponent={<View style={styles.emptyCart}><Ionicons name="search-outline" size={56} color="#333" /><Text style={styles.emptyCartText}>Ничего не найдено</Text></View>}
          renderItem={({ item, index }) => {
            const cat = CATEGORIES.find(c => c.id === item.category);
            const color = cat ? cat.color : '#3498db';
            const inOrder = order.items.find(i => i.id === item.id);
            return (
              <AnimatedCard index={Math.min(index, 8)} style={styles.clientCardDark}>
                <View style={[styles.clientIconWrap, { backgroundColor: color + '22' }]}>
                  <Ionicons name={item.icon} size={26} color={color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.clientTitleLight}>{item.title}</Text>
                  <Text style={styles.clientPrice}>{item.price}</Text>
                  {inOrder && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                      <Ionicons name="checkmark-circle" size={12} color="#27ae60" />
                      <Text style={{ color: '#27ae60', fontSize: 11, fontWeight: '600' }}>В заказе ×{inOrder.qty}</Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity style={styles.orderBtn} onPress={() => addServiceToOrder(order.id, item)}>
                  <Ionicons name="add" size={20} color="#fff" />
                </TouchableOpacity>
              </AnimatedCard>
            );
          }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.clientContainer}>
      <StatusBar barStyle="light-content" />
      <View style={styles.clientHeader}>
        <View><Text style={styles.clientHeaderTitle}>Отопление и ремонт</Text><Text style={styles.clientHeaderSubtitle}>{mainTab === 'services' ? 'Выберите категорию' : mainTab === 'history' ? 'Ваши заказы' : 'Ваш профиль'}</Text></View>
        <TouchableOpacity onPress={onExit} hitSlop={12}><Text style={styles.clientExitText}>Выйти</Text></TouchableOpacity>
      </View>
      <View style={styles.segmentRow}>
        <TouchableOpacity style={[styles.segmentBtn, mainTab === 'services' && styles.segmentBtnActive]} onPress={() => setMainTab('services')}><Text style={[styles.segmentText, mainTab === 'services' && styles.segmentTextActive]}>Услуги</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.segmentBtn, mainTab === 'history' && styles.segmentBtnActive]} onPress={() => setMainTab('history')}><Text style={[styles.segmentText, mainTab === 'history' && styles.segmentTextActive]}>История{history.length > 0 ? ` (${history.length})` : ''}</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.segmentBtn, mainTab === 'profile' && styles.segmentBtnActive]} onPress={() => setMainTab('profile')}><Text style={[styles.segmentText, mainTab === 'profile' && styles.segmentTextActive]}>Профиль</Text></TouchableOpacity>
      </View>
      {mainTab === 'services' && (
        <ScrollView contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={18} color="#888" style={{ marginLeft: 12 }} />
            <TextInput style={styles.searchInput} placeholder="Поиск услуги..." placeholderTextColor="#666" value={searchQuery} onChangeText={setSearchQuery} returnKeyType="search" />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8} style={{ paddingRight: 12 }}>
                <Ionicons name="close-circle" size={18} color="#888" />
              </TouchableOpacity>
            )}
          </View>

          {normalizedQuery ? (
            searchResults.length === 0 ? (
              <View style={styles.emptyCart}>
                <Ionicons name="search-outline" size={56} color="#333" />
                <Text style={styles.emptyCartText}>Ничего не найдено</Text>
              </View>
            ) : (
              <>
                <Text style={styles.searchResultsLabel}>Найдено: {searchResults.length} {pluralServices(searchResults.length)}</Text>
                <View style={{ paddingHorizontal: 16 }}>
                  {searchResults.map((item, index) => {
                    const cat = CATEGORIES.find(c => c.id === item.category);
                    const color = cat ? cat.color : '#3498db';
                    return (
                      <AnimatedCard key={item.id} index={index} style={styles.clientCardDark}>
                        <View style={[styles.clientIconWrap, { backgroundColor: color + '22' }]}>
                          <Ionicons name={item.icon} size={26} color={color} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.clientTitleLight}>{item.title}</Text>
                          <Text style={styles.clientPrice}>{item.price}</Text>
                          {cat && (
                            <View style={styles.searchCategoryRow}>
                              <Ionicons name={cat.icon} size={10} color={color} />
                              <Text style={[styles.searchCategoryBadge, { color }]}>{cat.title}</Text>
                            </View>
                          )}
                        </View>
                        <TouchableOpacity style={styles.orderBtn} onPress={() => addToCart(item)}>
                          <Ionicons name="add" size={20} color="#fff" />
                        </TouchableOpacity>
                      </AnimatedCard>
                    );
                  })}
                </View>
              </>
            )
          ) : (
            <View style={styles.categoryGrid}>
              {CATEGORIES.map((cat, i) => (
                <CategoryCard key={cat.id} category={cat} count={SERVICES.filter(s => s.category === cat.id).length} index={i} onPress={() => { setActiveCategory(cat.id); setView('category'); }} />
              ))}
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
                {order.tip > 0 && (<View style={styles.tipBadge}><Ionicons name="heart" size={14} color="#e74c3c" /><Text style={styles.tipBadgeText}>Чаевые: {order.tip} ₽ (в итого)</Text></View>)}

                {!isDone && (
                  <View style={styles.orderManageRow}>
                    <TouchableOpacity style={styles.orderManageBtn} onPress={() => { setAddingServicesTo(order.id); setOrderAddQuery(''); setView('addServices'); }}>
                      <Ionicons name="add-circle-outline" size={16} color="#3498db" />
                      <Text style={styles.orderManageBtnText}>Добавить услуги</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.orderManageBtn, { borderColor: '#27ae60' }]} onPress={() => completeOrder(order.id)}>
                      <Ionicons name="checkmark-done-circle-outline" size={16} color="#27ae60" />
                      <Text style={[styles.orderManageBtnText, { color: '#27ae60' }]}>Завершить заказ</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {isDone && (
                  <View style={styles.orderActions}>
                    {!order.myReview && (<TouchableOpacity style={styles.orderActionBtn} onPress={() => openReviewForm(order)}><Ionicons name="star" size={14} color="#f39c12" /><Text style={styles.orderActionText}>Оставить отзыв</Text></TouchableOpacity>)}
                    <TouchableOpacity style={styles.orderActionBtn} onPress={() => { setTippingOrder(order); setView('tip'); }}><Ionicons name="heart" size={14} color="#e74c3c" /><Text style={styles.orderActionText}>Дать чаевые</Text></TouchableOpacity>
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
              <View style={styles.reviewHeader}><View style={[styles.reviewAvatar, { backgroundColor: '#9b59b6' }]}><Ionicons name="construct" size={16} color="#fff" /></View><View style={{ flex: 1 }}><Text style={styles.reviewClient}>{r.master}</Text><View style={styles.reviewStarsRow}>{renderStars(r.rating)}<Text style={styles.reviewDate}>{r.date}</Text></View></View></View>
              <Text style={styles.reviewText}>{r.text}</Text>
            </AnimatedCard>
          ))}
        </ScrollView>
      )}
      {cartCount > 0 && (<TouchableOpacity style={styles.floatingCart} onPress={() => { softVibrate(12); setView('cart'); }} activeOpacity={0.9}><Ionicons name="cart" size={22} color="#fff" /><Text style={styles.floatingCartText}>Корзина · {cartTotal.toLocaleString('ru-RU')} ₽</Text></TouchableOpacity>)}
    </SafeAreaView>
  );
}

function ChatWallpaper() {
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <View style={{ flex: 1, backgroundColor: WA_CHAT_BG }} />
      <View style={{ position: 'absolute', top: -90, left: -70, width: 280, height: 280, borderRadius: 140, backgroundColor: 'rgba(0,168,132,0.07)' }} />
      <View style={{ position: 'absolute', bottom: -120, right: -80, width: 320, height: 320, borderRadius: 160, backgroundColor: 'rgba(0,168,132,0.05)' }} />
    </View>
  );
}

function MasterScreen({ onExit, user }) {
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
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const addr = await reverseGeocodeToAddress(loc.coords.latitude, loc.coords.longitude);
        setMyLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude, text: addr || `${loc.coords.latitude.toFixed(4)}, ${loc.coords.longitude.toFixed(4)}` });
      } catch (e) {}
    })();
  }, []);

  // Загрузка заказов из БД
  const loadJobs = async () => {
    const { data } = await supabase
      .from('orders').select('*, client:profiles!client_id(name, phone, surname)')
      .eq('master_id', user.id).neq('status', 'done');
    if (data) setJobs(data.map(o => ({
      id: o.id,
      client: o.client ? `${o.client.name || ''} ${o.client.surname || ''}`.trim() || 'Клиент' : 'Клиент',
      phone: o.client?.phone || '',
      address: o.address || '',
      lat: Number(o.lat) || 55.7558,
      lng: Number(o.lng) || 37.6173,
      time: new Date(o.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      status: o.status,
      items: o.items || [],
      total: o.total,
      tip: o.tip || 0,
    })));
  };

  // Загрузка истории (завершённых) из БД
  const loadHistory = async () => {
    const { data } = await supabase
      .from('orders').select('*')
      .eq('master_id', user.id).eq('status', 'done')
      .order('created_at', { ascending: false });
    if (data) setOrdersHistory(data.map(o => ({
      id: o.id,
      client: 'Клиент',
      date: new Date(o.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }),
      amount: o.total,
      tip: o.tip || 0,
      items: (o.items || []).map(it => ({ title: it.title, qty: it.qty, price: parsePrice(it.price) })),
    })));
  };

  useEffect(() => {
    loadJobs();
    loadHistory();
    const ch = supabase.channel('master-jobs-' + user.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `master_id=eq.${user.id}` },
        () => { loadJobs(); loadHistory(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user.id]);

  useEffect(() => { const checkReset = () => { const current = getMonthKey(); if (monthKey !== current) { setEarningsToday(0); setEarningsMonth(0); setOrdersHistory([]); setMonthKey(current); } }; checkReset(); const interval = setInterval(checkReset, 60 * 60 * 1000); return () => clearInterval(interval); }, [monthKey]);
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
  const hideNotification = () => { if (notifHideRef.current) clearTimeout(notifHideRef.current); Animated.parallel([Animated.timing(notifOpacity, { toValue: 0, duration: 200, useNativeDriver: true }), Animated.timing(notifTranslate, { toValue: -120, duration: 200, useNativeDriver: true })]).start(() => setNotification(null)); };

  const updateStatus = async (id, newStatus) => {
    const job = jobs.find(j => j.id === id); if (!job) return;
    const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', id);
    if (error) { Alert.alert('Ошибка', error.message); return; }
    if (newStatus === 'done') {
      const earned = job.total + (job.tip || 0);
      setProfile(p => ({ ...p, ordersDone: p.ordersDone + 1, balance: p.balance + earned }));
      setEarningsToday(p => p + earned);
      setEarningsMonth(p => p + earned);
      setJobs(prev => prev.filter(j => j.id !== id));
      loadHistory();
      return;
    }
    setJobs(prev => prev.map(j => (j.id === id ? { ...j, status: newStatus } : j)));
  };

  const callClient = (phone) => Linking.openURL(`tel:${phone}`).catch(() => Alert.alert('Ошибка', 'Не удалось открыть звонилку'));
  const openMap = (address) => Linking.openURL(`https://yandex.ru/maps/?text=${encodeURIComponent(address)}`).catch(() => Alert.alert('Ошибка', 'Не удалось открыть карты'));

  const addMessage = (payload) => { const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }); setMessages(prev => [...prev, { id: `m${Date.now()}-${Math.random()}`, author: 'Вы', time, mine: true, read: false, ...payload }]); };
  const sendMessage = () => { const text = draft.trim(); if (!text) return; addMessage({ type: 'text', text }); setDraft(''); };
  const pickPhoto = async () => { setShowAttach(false); const perm = await ImagePicker.requestMediaLibraryPermissionsAsync(); if (!perm.granted) return Alert.alert('Нужно разрешение', 'Разрешите доступ к галерее'); const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 }); if (!result.canceled) addMessage({ type: 'image', uri: result.assets[0].uri }); };
  const pickVideo = async () => { setShowAttach(false); const perm = await ImagePicker.requestMediaLibraryPermissionsAsync(); if (!perm.granted) return Alert.alert('Нужно разрешение', 'Разрешите доступ к галерее'); const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'] }); if (!result.canceled) addMessage({ type: 'video', uri: result.assets[0].uri }); };
  const startRecording = async () => { setShowAttach(false); const perm = await AudioModule.requestRecordingPermissionsAsync(); if (!perm.granted) return Alert.alert('Нужно разрешение', 'Разрешите доступ к микрофону'); try { await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true }); await audioRecorder.prepareToRecordAsync(); audioRecorder.record(); setIsRecording(true); setRecordingTime(0); timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000); } catch (e) { Alert.alert('Ошибка записи', String(e.message || e)); } };
  const stopRecordingAndSend = async () => { if (timerRef.current) clearInterval(timerRef.current); try { await audioRecorder.stop(); const rawUri = audioRecorder.uri; const dur = recordingTime; setIsRecording(false); setRecordingTime(0); if (!rawUri || dur <= 0) return Alert.alert('Ошибка', 'Запись слишком короткая.'); try { const info = await FileSystem.getInfoAsync(rawUri); if (!info.exists || info.size === 0) return Alert.alert('Ошибка', 'Аудиофайл пустой.'); } catch (e) {} addMessage({ type: 'voice', uri: rawUri, duration: dur }); } catch (e) { Alert.alert('Ошибка', String(e.message || e)); } };
  const cancelRecording = async () => { if (timerRef.current) clearInterval(timerRef.current); try { await audioRecorder.stop(); } catch {} setIsRecording(false); setRecordingTime(0); };

  const renderJob = ({ item, index }) => {
    const services = item.total; const tip = item.tip || 0; const grandTotal = services + tip;
    const distance = (item.lat && item.lng) ? getDistanceMeters(myLocation.lat, myLocation.lng, item.lat, item.lng) : null;
    return (
      <AnimatedCard index={index} style={styles.jobCardDark}>
        <View style={styles.jobHeaderRow}>
          <View style={styles.clientBlock}>
            <View style={styles.clientAvatarSmall}><Text style={styles.clientAvatarText}>{(item.client || 'К').charAt(0)}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.jobClientLabel}>КЛИЕНТ</Text>
              <Text style={styles.jobClient}>{item.client}</Text>
              <View style={styles.clientPhoneRow}>
                <Ionicons name="call" size={11} color="#3498db" />
                <Text style={styles.clientPhone}>{item.phone}</Text>
              </View>
            </View>
          </View>
          <View style={[styles.badge, statusColor(item.status)]}>
            <Text style={styles.badgeText}>{STATUS_LABELS[item.status]}</Text>
          </View>
        </View>
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={14} color="#888" />
            <Text style={styles.metaText}>{item.time}</Text>
          </View>
          <View style={[styles.metaItem, { flex: 1 }]}>
            <Ionicons name="location-outline" size={14} color="#888" />
            <Text style={styles.metaText} numberOfLines={1}>{item.address || 'Адрес не указан'}</Text>
          </View>
        </View>
        {distance !== null && (
          <View style={styles.distanceRow}>
            <Ionicons name="navigate" size={14} color="#3498db" />
            <Text style={styles.distanceText}>До клиента: <Text style={styles.distanceValue}>{formatDistance(distance)}</Text> от вас</Text>
          </View>
        )}
        <View style={styles.itemsBlock}>
          <Text style={styles.itemsBlockTitle}>Что заказано:</Text>
          {item.items && item.items.map((it, i) => {
            const unit = parsePrice(it.price);
            const lineSum = unit * it.qty;
            return (
              <View key={i} style={styles.itemLine}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemLineName}>{it.title}{it.qty > 1 ? ` ×${it.qty}` : ''}</Text>
                  <Text style={styles.itemLineUnit}>{unit.toLocaleString('ru-RU')} ₽ за шт{it.qty > 1 ? ` × ${it.qty}` : ''}</Text>
                </View>
                <Text style={styles.itemLineSum}>{lineSum.toLocaleString('ru-RU')} ₽</Text>
              </View>
            );
          })}
        </View>
        <View style={styles.priceBlock}>
          <View style={styles.priceRow}>
            <Text style={styles.priceRowLabel}>Услуги</Text>
            <Text style={styles.priceRowValue}>{services.toLocaleString('ru-RU')} ₽</Text>
          </View>
          {tip > 0 && (
            <View style={styles.priceRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="heart" size={12} color="#e74c3c" />
                <Text style={styles.priceRowLabel}>Чаевые</Text>
              </View>
              <Text style={[styles.priceRowValue, { color: '#e74c3c' }]}>+{tip.toLocaleString('ru-RU')} ₽</Text>
            </View>
          )}
          <View style={styles.priceDivider} />
          <View style={styles.priceTotalRow}>
            <Text style={styles.priceTotalLabel}>К оплате</Text>
            <Text style={styles.priceTotalValue}>{grandTotal.toLocaleString('ru-RU')} ₽</Text>
          </View>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.btnDark} onPress={() => callClient(item.phone)}>
            <Ionicons name="call-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.btnDarkText}>Позвонить</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnDark} onPress={() => openMap(item.address)}>
            <Ionicons name="navigate-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.btnDarkText}>Маршрут</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.statusRow}>
          {item.status === 'new' && (
            <TouchableOpacity style={[styles.statusBtn, { backgroundColor: '#f39c12' }]} onPress={() => updateStatus(item.id, 'on_way')}>
              <Text style={styles.statusBtnText}>Я в пути</Text>
            </TouchableOpacity>
          )}
          {item.status === 'on_way' && (
            <TouchableOpacity style={[styles.statusBtn, { backgroundColor: '#3498db' }]} onPress={() => updateStatus(item.id, 'on_site')}>
              <Text style={styles.statusBtnText}>На объекте</Text>
            </TouchableOpacity>
          )}
          {item.status === 'on_site' && (
            <TouchableOpacity style={[styles.statusBtn, { backgroundColor: '#27ae60' }]} onPress={() => updateStatus(item.id, 'done')}>
              <Text style={styles.statusBtnText}>Завершить</Text>
            </TouchableOpacity>
          )}
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
      {notification && (<Animated.View style={[styles.notificationBanner, { opacity: notifOpacity, transform: [{ translateY: notifTranslate }] }]}><View style={styles.notificationIcon}><Ionicons name="notifications" size={22} color="#fff" /></View><View style={{ flex: 1 }}><Text style={styles.notificationTitle}>Новый заказ!</Text><Text style={styles.notificationText} numberOfLines={2}>{notification.client} · {(notification.total + (notification.tip || 0)).toLocaleString('ru-RU')} ₽</Text></View><TouchableOpacity onPress={() => { setTab('jobs'); hideNotification(); }} hitSlop={8}><Ionicons name="chevron-forward" size={22} color="#fff" /></TouchableOpacity><TouchableOpacity onPress={hideNotification} hitSlop={8} style={{ marginLeft: 10 }}><Ionicons name="close" size={20} color="rgba(255,255,255,0.7)" /></TouchableOpacity></Animated.View>)}
      <View style={styles.topBarDark}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}><Text style={styles.titleLight}>{tab === 'jobs' ? 'Мои заявки' : tab === 'chat' ? 'Чат мастеров' : 'Мой профиль'}</Text>{tab === 'profile' && (<View style={[styles.headerRankBadge, { backgroundColor: rank.color }]}><Ionicons name={rank.icon} size={12} color="#fff" /></View>)}</View>
        <TouchableOpacity onPress={onExit}><Ionicons name="exit-outline" size={24} color="#e74c3c" /></TouchableOpacity>
      </View>
      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tabBtn, tab === 'jobs' && styles.tabBtnActive]} onPress={() => setTab('jobs')}><View style={{ flexDirection: 'row', alignItems: 'center' }}><Text style={[styles.tabText, tab === 'jobs' && styles.tabTextActive]}>Заявки</Text>{unseenCount > 0 && tab !== 'jobs' && (<View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{unseenCount}</Text></View>)}</View></TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, tab === 'chat' && styles.tabBtnActive]} onPress={() => setTab('chat')}><Text style={[styles.tabText, tab === 'chat' && styles.tabTextActive]}>Чат</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, tab === 'profile' && styles.tabBtnActive]} onPress={() => setTab('profile')}><Text style={[styles.tabText, tab === 'profile' && styles.tabTextActive]}>Профиль</Text></TouchableOpacity>
      </View>
      {tab === 'jobs' ? (<FlatList data={jobs} keyExtractor={item => item.id} renderItem={renderJob} contentContainerStyle={{ paddingBottom: 20, paddingHorizontal: 16 }} ListEmptyComponent={<View style={styles.emptyCart}><Ionicons name="briefcase-outline" size={64} color="#333" /><Text style={styles.emptyCartText}>Нет активных заявок</Text></View>} />)
       : tab === 'profile' ? (
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
              <View style={styles.earningsRow}><View style={styles.earningsBlock}><Text style={styles.earningsLabel}>Сегодня</Text><Text style={styles.earningsValue}>{earningsToday.toLocaleString('ru-RU')} ₽</Text></View><View style={styles.earningsDivider} /><View style={styles.earningsBlock}><Text style={styles.earningsLabel}>За месяц</Text><Text style={[styles.earningsValue, { color: '#27ae60' }]}>{earningsMonth.toLocaleString('ru-RU')} ₽</Text></View></View>
              <View style={styles.commissionBox}>
                <View style={styles.commissionRow}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}><Ionicons name="wallet-outline" size={15} color="#f39c12" /><Text style={styles.commissionLabel}>Комиссия сервиса</Text></View><Text style={styles.commissionValue}>−{monthCommission.toLocaleString('ru-RU')} ₽</Text></View>
                <View style={styles.commissionDivider} />
                <View style={styles.commissionRow}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}><Ionicons name="checkmark-circle" size={15} color="#27ae60" /><Text style={[styles.commissionLabel, { color: '#fff', fontWeight: '700' }]}>К выплате вам</Text></View><Text style={[styles.commissionValue, { color: '#27ae60', fontSize: 17 }]}>{monthNet.toLocaleString('ru-RU')} ₽</Text></View>
              </View>
              <View style={styles.earningsHintRow}><Ionicons name="information-circle-outline" size={12} color="#f39c12" /><Text style={[styles.earningsHint, { color: '#f39c12' }]}>До 6000 ₽ — 7% • свыше 6000 ₽ — 5%</Text></View>
              <View style={styles.earningsHintRow}><Ionicons name="calendar-outline" size={12} color="#888" /><Text style={styles.earningsHint}>Месячная статистика обнуляется 1-го числа</Text></View>
            </View>
            <Text style={styles.sectionTitle}>История заказов ({ordersHistory.length})</Text>
            {ordersHistory.length === 0 ? (<Text style={styles.emptyReviews}>Пока нет завершённых заказов</Text>) : ordersHistory.map((order, i) => {
              const orderCommission = getCommissionAmount(order.amount);
              const orderNet = order.amount - orderCommission + (order.tip || 0);
              return (
                <AnimatedCard key={order.id} index={i} style={styles.masterHistoryCard}>
                  <View style={styles.masterHistoryHeader}><Text style={styles.masterHistoryClient}>{order.client}</Text><Text style={styles.masterHistoryAmount}>{order.amount.toLocaleString('ru-RU')} ₽</Text></View>
                  <Text style={styles.masterHistoryDate}>{order.date}</Text>
                  {order.items && order.items.length > 0 && (<View style={styles.masterHistoryItems}><Text style={styles.masterHistoryItemsTitle}>Что сделано:</Text>{order.items.map((it, idx) => (<View key={idx} style={styles.masterHistoryItemRow}><Ionicons name="checkmark-circle" size={12} color="#27ae60" /><Text style={styles.masterHistoryItemName}>{it.title}{it.qty > 1 ? ` ×${it.qty}` : ''}</Text><Text style={styles.masterHistoryItemPrice}>{(it.price * it.qty).toLocaleString('ru-RU')} ₽</Text></View>))}</View>)}
                  {order.tip > 0 && (<View style={styles.masterHistoryTipBadge}><Ionicons name="heart" size={10} color="#e74c3c" /><Text style={styles.masterHistoryTipText}>+{order.tip.toLocaleString('ru-RU')} ₽ чаевые</Text></View>)}
                  <View style={styles.masterHistoryCommissionRow}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Ionicons name="wallet-outline" size={11} color="#f39c12" /><Text style={styles.masterHistoryCommissionLabel}>Комиссия {formatCommissionPct(order.amount)}</Text></View><Text style={styles.masterHistoryCommissionValue}>−{orderCommission.toLocaleString('ru-RU')} ₽</Text></View>
                  <View style={styles.masterHistoryNetRow}><Text style={styles.masterHistoryNetLabel}>💵 На руки:</Text><Text style={styles.masterHistoryNetValue}>{orderNet.toLocaleString('ru-RU')} ₽</Text></View>
                </AnimatedCard>
              );
            })}
            <Text style={styles.sectionTitle}>Отзывы клиентов ({reviews.length})</Text>
            {reviews.map((r, i) => (
              <AnimatedCard key={r.id} index={i} style={styles.reviewCard}>
                <View style={styles.reviewHeader}><View style={styles.reviewAvatar}><Text style={styles.reviewAvatarText}>{r.client.charAt(0)}</Text></View><View style={{ flex: 1 }}><Text style={styles.reviewClient}>{r.client}</Text><View style={styles.reviewStarsRow}>{renderStars(r.rating)}<Text style={styles.reviewDate}>{r.date}</Text></View></View></View>
                <Text style={styles.reviewText}>{r.text}</Text>
              </AnimatedCard>
            ))}
          </View>
        </ScrollView>
      ) : (
        <KeyboardAvoidingView style={styles.waChatContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
          <ChatWallpaper />
          <FlatList
            ref={chatListRef}
            data={messages}
            keyExtractor={item => item.id}
            renderItem={renderMessage}
            contentContainerStyle={{ paddingHorizontal: 6, paddingVertical: 12, flexGrow: 1, justifyContent: 'flex-end' }}
            onContentSizeChange={() => chatListRef.current?.scrollToEnd({ animated: true })}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          />
          {isRecording ? (
            <View style={styles.recordingPanel}><View style={styles.recordingDot} /><Text style={styles.recordingText}>Запись {formatSec(recordingTime)}</Text><View style={{ flex: 1 }} /><TouchableOpacity style={styles.recordActionBtn} onPress={cancelRecording}><Ionicons name="close" size={20} color="#fff" /></TouchableOpacity><TouchableOpacity style={[styles.recordActionBtn, { backgroundColor: WA_GREEN }]} onPress={stopRecordingAndSend}><Ionicons name="send" size={18} color="#fff" /></TouchableOpacity></View>
          ) : (
            <View style={styles.waInputRow}>
              <View style={styles.waInputWrap}>
                <TouchableOpacity
                  style={styles.waInputIcon}
                  onPress={() => {
                    Keyboard.dismiss();
                    setShowAttach(s => !s);
                  }}
                >
                  <Ionicons name={showAttach ? 'close' : 'add'} size={24} color="#8696a0" />
                </TouchableOpacity>
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

const statusColor = (status) => {
  switch (status) {
    case 'new': return { backgroundColor: '#e74c3c' };
    case 'on_way': return { backgroundColor: '#f39c12' };
    case 'on_site': return { backgroundColor: '#3498db' };
    case 'done': return { backgroundColor: '#27ae60' };
    default: return { backgroundColor: '#95a5a6' };
  }
};

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
  authRoleLabel: { color: '#888', fontSize: 13, fontWeight: '600', marginTop: 4, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  authRoleRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  authRoleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, backgroundColor: '#1a1a1a', borderWidth: 1.5, borderColor: '#2a2a2a' },
  authRoleBtnClient: { backgroundColor: '#3498db', borderColor: '#3498db' },
  authRoleBtnMaster: { backgroundColor: '#e74c3c', borderColor: '#e74c3c' },
  authRoleBtnText: { color: '#aaa', fontSize: 15, fontWeight: '700' },
  authSubmitBtn: { backgroundColor: '#27ae60', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  authSubmitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  roleFooter: { position: 'absolute', bottom: 30, alignItems: 'center', width: '100%' },
  topBarDark: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 16, paddingHorizontal: 16 },
  titleLight: { fontSize: 24, fontWeight: '700', color: '#fff' },
  headerRankBadge: { marginLeft: 10, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
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
  categoryCard: { width: '48%', minHeight: 160, borderRadius: 20, marginBottom: 14, borderWidth: 1, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, elevation: 3 },
  categoryCardInner: { flex: 1, padding: 16, justifyContent: 'space-between' },
  categoryIconCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  categoryCardTitle: { color: '#fff', fontSize: 17, fontWeight: '700', marginTop: 14 },
  categoryCardCount: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  clientCardDark: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 0.5, borderColor: '#2a2a2a' },
  clientIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(52,152,219,0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  clientTitleLight: { fontSize: 15, fontWeight: '600', color: '#fff' },
  clientPrice: { fontSize: 14, fontWeight: '700', color: '#27ae60', marginTop: 2 },
  orderBtn: { backgroundColor: '#3498db', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  floatingCart: { position: 'absolute', bottom: 20, left: 16, right: 16, backgroundColor: '#27ae60', borderRadius: 30, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 10, elevation: 6 },
  floatingCartText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cartItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 0.5, borderColor: '#2a2a2a' },
  cartItemTitle: { fontSize: 15, fontWeight: '600', color: '#fff' },
  cartItemPrice: { fontSize: 14, fontWeight: '700', color: '#27ae60', marginTop: 2 },
  autoLabel: { fontSize: 11, color: '#888', fontWeight: '400' },
  qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#2a2a2a', alignItems: 'center', justifyContent: 'center' },
  qtyText: { color: '#fff', fontSize: 15, fontWeight: '600', minWidth: 20, textAlign: 'center' },
  masterSection: { marginTop: 16, padding: 14, backgroundColor: '#1a1a1a', borderRadius: 14, borderWidth: 0.5, borderColor: '#2a2a2a' },
  masterSectionTitle: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 10 },
  selectMasterCta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#3498db' },
  selectMasterCtaText: { color: '#3498db', fontSize: 15, fontWeight: '700' },
  masterChosenRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  masterChosenName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  changeMasterText: { color: '#3498db', fontSize: 13, fontWeight: '600' },
  cartFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#0d0d0d', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 28, borderTopWidth: 0.5, borderTopColor: '#2a2a2a' },
  cartTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cartTotalLabel: { color: '#aaa', fontSize: 16, fontWeight: '600' },
  cartTotalValue: { color: '#27ae60', fontSize: 22, fontWeight: '700' },
  checkoutBtn: { backgroundColor: '#27ae60', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  checkoutBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  emptyCart: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 60 },
  emptyCartText: { color: '#888', fontSize: 16, marginTop: 16, marginBottom: 24 },
  emptyCartBtn: { backgroundColor: '#3498db', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24 },
  emptyCartBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  historyCard: { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 0.5, borderColor: '#2a2a2a' },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyDate: { color: '#aaa', fontSize: 13 },
  historyTotal: { color: '#27ae60', fontSize: 16, fontWeight: '700' },
  historyMaster: { color: '#3498db', fontSize: 13, fontWeight: '600', marginTop: 6 },
  historyDivider: { height: 0.5, backgroundColor: '#2a2a2a', marginVertical: 10 },
  historyItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  historyItemName: { color: '#fff', fontSize: 14, flex: 1 },
  historyItemSum: { color: '#ccc', fontSize: 14, fontWeight: '600' },
  myReviewBox: { marginTop: 10, padding: 10, backgroundColor: '#0d0d0d', borderRadius: 8, borderLeftWidth: 3, borderLeftColor: '#f39c12' },
  myReviewTitle: { color: '#f39c12', fontSize: 12, fontWeight: '700' },
  myReviewText: { color: '#ccc', fontSize: 12, flex: 1 },
  tipBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, backgroundColor: 'rgba(231,76,60,0.15)', borderRadius: 12 },
  tipBadgeText: { color: '#e74c3c', fontSize: 12, fontWeight: '600' },
  orderActions: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  orderActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, backgroundColor: '#2a2a2a' },
  orderActionText: { color: '#fff', fontSize: 13, fontWeight: '500' },
  orderStatusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  orderStatusText: { fontSize: 11, fontWeight: '700' },
  orderManageRow: { flexDirection: 'row', gap: 8, marginTop: 12, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: '#2a2a2a' },
  orderManageBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 10, backgroundColor: '#0d0d0d', borderWidth: 1, borderColor: '#3498db' },
  orderManageBtnText: { color: '#3498db', fontSize: 12, fontWeight: '700' },
  masterSelectCard: { flexDirection: 'row', alignItems: 'center', padding: 12, marginBottom: 10, backgroundColor: '#1a1a1a', borderRadius: 14, borderWidth: 1, borderColor: '#2a2a2a', gap: 10 },
  masterAvatarSmall: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(52,152,219,0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  masterSelectName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  masterSelectRating: { color: '#aaa', fontSize: 11, marginLeft: 6 },
  selectMasterBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#3498db', alignItems: 'center', justifyContent: 'center' },
  masterDistanceRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  masterDistanceText: { color: '#3498db', fontSize: 11, fontWeight: '600' },
  masterDistanceCard: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: 'rgba(52,152,219,0.12)', marginTop: 6, marginBottom: 6 },
  masterDistanceCardText: { color: '#999', fontSize: 13 },
  masterDistanceCardValue: { color: '#3498db', fontWeight: '700' },
  masterProfileCard: { alignItems: 'center', padding: 20, backgroundColor: '#1a1a1a', borderRadius: 20, borderWidth: 0.5, borderColor: '#2a2a2a', marginBottom: 16 },
  masterAvatarLarge: { width: 88, height: 88, borderRadius: 44, borderWidth: 3, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0d0d0d', marginBottom: 12 },
  masterProfileName: { color: '#fff', fontSize: 20, fontWeight: '700' },
  masterRatingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  masterRatingText: { color: '#aaa', fontSize: 12, marginLeft: 6 },
  masterAbout: { color: '#ccc', fontSize: 13, textAlign: 'center', marginTop: 12, lineHeight: 19 },
  masterStatsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, paddingHorizontal: 10, width: '100%' },
  masterStat: { flex: 1, alignItems: 'center' },
  masterStatValue: { color: '#fff', fontSize: 18, fontWeight: '700' },
  masterStatLabel: { color: '#888', fontSize: 11, marginTop: 2 },
  masterSelectFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: 28, backgroundColor: '#0d0d0d', borderTopWidth: 0.5, borderTopColor: '#2a2a2a' },
  emptyReviews: { color: '#666', fontSize: 14, textAlign: 'center', paddingVertical: 24 },
  profileCard: { alignItems: 'center', paddingVertical: 20, marginBottom: 14, backgroundColor: '#1a1a1a', borderRadius: 20, borderWidth: 0.5, borderColor: '#2a2a2a' },
  profileAvatar: { width: 84, height: 84, borderRadius: 42, borderWidth: 3, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0d0d0d', marginBottom: 10, overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%', borderRadius: 42 },
  avatarEditBadge: { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: '#3498db', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#0d0d0d' },
  rankBadge: { position: 'absolute', bottom: -2, right: -2, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#0d0d0d' },
  profileName: { color: '#fff', fontSize: 20, fontWeight: '700' },
  profilePhone: { color: '#888', fontSize: 13, marginTop: 2, marginBottom: 12 },
  rankPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, marginBottom: 16 },
  rankPillText: { fontSize: 13, fontWeight: '700' },
  editProfileBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: 'rgba(52,152,219,0.15)', marginTop: 6, marginBottom: 12 },
  editProfileBtnText: { color: '#3498db', fontSize: 13, fontWeight: '600' },
  profileInput: { width: '100%', backgroundColor: '#0d0d0d', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: '#fff', fontSize: 15, marginBottom: 10, borderWidth: 0.5, borderColor: '#2a2a2a' },
  profileEditActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  profileEditBtnCancel: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#2a2a2a', alignItems: 'center' },
  profileEditBtnCancelText: { color: '#aaa', fontSize: 14, fontWeight: '600' },
  profileEditBtnSave: { flex: 1, flexDirection: 'row', paddingVertical: 12, borderRadius: 10, backgroundColor: '#27ae60', alignItems: 'center', justifyContent: 'center' },
  profileEditBtnSaveText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  statsRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, width: '100%' },
  statBlock: { flex: 1, alignItems: 'center' },
  statValue: { color: '#fff', fontSize: 18, fontWeight: '700' },
  statLabel: { color: '#888', fontSize: 11, marginTop: 2 },
  statDivider: { width: 0.5, height: 30, backgroundColor: '#2a2a2a' },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12, marginTop: 12 },
  reviewCard: { padding: 12, marginBottom: 10, backgroundColor: '#1a1a1a', borderRadius: 14, borderWidth: 0.5, borderColor: '#2a2a2a' },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  reviewAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#3498db', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  reviewAvatarText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  reviewClient: { color: '#fff', fontSize: 14, fontWeight: '600' },
  reviewStarsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  reviewDate: { color: '#888', fontSize: 11, marginLeft: 8 },
  reviewText: { color: '#ccc', fontSize: 13, lineHeight: 19 },
  reviewFormCard: { padding: 20, backgroundColor: '#1a1a1a', borderRadius: 20, borderWidth: 0.5, borderColor: '#2a2a2a' },
  reviewFormTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  reviewFormSub: { color: '#aaa', fontSize: 13, marginTop: 4, marginBottom: 16 },
  starsPicker: { flexDirection: 'row', justifyContent: 'center', marginBottom: 20 },
  reviewInput: { backgroundColor: '#0d0d0d', borderRadius: 12, padding: 14, color: '#fff', fontSize: 14, minHeight: 120, textAlignVertical: 'top', borderWidth: 0.5, borderColor: '#2a2a2a' },
  submitReviewBtn: { backgroundColor: '#27ae60', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  submitReviewBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  tipOptionsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 12 },
  tipOption: { flex: 1, paddingVertical: 16, backgroundColor: '#0d0d0d', borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#2a2a2a' },
  tipOptionText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  tipCustom: { flex: 0, paddingVertical: 14 },
  availabilityCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: '#1a1a1a', borderRadius: 14, borderWidth: 1.5, marginTop: 4, marginBottom: 12 },
  availabilityActive: { borderColor: '#27ae60' },
  availabilityBusy: { borderColor: '#f39c12' },
  availabilityIconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  availabilityTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  availabilitySub: { color: '#888', fontSize: 12, marginTop: 2 },
  availabilityToggle: { width: 50, height: 28, borderRadius: 14, backgroundColor: '#333', padding: 2, justifyContent: 'center' },
  availabilityToggleOn: { backgroundColor: '#27ae60' },
  availabilityKnob: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff' },
  availabilityKnobOn: { alignSelf: 'flex-end' },
  locationCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: '#1a1a1a', borderRadius: 14, borderWidth: 0.5, borderColor: '#2a2a2a', marginBottom: 12 },
  locationLabel: { color: '#888', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  locationValue: { color: '#fff', fontSize: 14, fontWeight: '600', marginTop: 2 },
  earningsCard: { padding: 16, backgroundColor: '#1a1a1a', borderRadius: 16, borderWidth: 0.5, borderColor: '#2a2a2a', marginBottom: 8 },
  earningsTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  earningsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  earningsBlock: { flex: 1, alignItems: 'center' },
  earningsDivider: { width: 0.5, height: 36, backgroundColor: '#2a2a2a' },
  earningsLabel: { color: '#888', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  earningsValue: { color: '#fff', fontSize: 20, fontWeight: '700' },
  earningsHintRow: { flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'center', marginTop: 4 },
  earningsHint: { color: '#666', fontSize: 10, fontStyle: 'italic' },
  masterHistoryCard: { padding: 12, marginBottom: 8, backgroundColor: '#1a1a1a', borderRadius: 12, borderWidth: 0.5, borderColor: '#2a2a2a' },
  masterHistoryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  masterHistoryClient: { color: '#fff', fontSize: 14, fontWeight: '600' },
  masterHistoryAmount: { color: '#27ae60', fontSize: 15, fontWeight: '700' },
  masterHistoryDate: { color: '#888', fontSize: 11, marginTop: 2 },
  masterHistoryTipBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 6, alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, backgroundColor: 'rgba(231,76,60,0.15)' },
  masterHistoryTipText: { color: '#e74c3c', fontSize: 10, fontWeight: '600' },
  masterHistoryItems: { marginTop: 8, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: '#2a2a2a' },
  masterHistoryItemsTitle: { color: '#888', fontSize: 10, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 },
  masterHistoryItemRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 3 },
  masterHistoryItemName: { color: '#ddd', fontSize: 13, flex: 1 },
  masterHistoryItemPrice: { color: '#fff', fontSize: 12, fontWeight: '600' },
  distanceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: 'rgba(52,152,219,0.1)', borderRadius: 8, marginBottom: 8, alignSelf: 'flex-start' },
  distanceText: { color: '#999', fontSize: 12 },
  distanceValue: { color: '#3498db', fontWeight: '700' },
  attachOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 100, justifyContent: 'flex-end' },
  attachSheet: { backgroundColor: '#1f2c34', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8, paddingBottom: 22, paddingHorizontal: 22, shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 16, elevation: 12 },
  attachGrabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', marginBottom: 10 },
  attachSheetTitle: { color: '#e9edef', fontSize: 14, fontWeight: '700', marginBottom: 14, alignSelf: 'flex-start' },
  attachTilesRow: { flexDirection: 'row', gap: 18, paddingBottom: 2 },
  attachTileWrap: { alignItems: 'center' },
  attachTile: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 6, elevation: 5 },
  attachTileLabel: { color: '#e9edef', fontSize: 11, fontWeight: '600', marginTop: 6 },
  videoPreview: { width: 230, height: 150, borderRadius: 8, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  videoPreviewPlay: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  videoPreviewLabel: { position: 'absolute', top: 6, right: 6, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  videoPreviewLabelText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  videoModal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center' },
  videoModalClose: { position: 'absolute', top: 50, right: 20, zIndex: 10, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  videoFull: { width: '100%', height: '70%' },
  recordingPanel: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#0b141a', gap: 10 },
  recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#e74c3c' },
  recordingText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  recordActionBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#e74c3c', alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  masterContainer: { flex: 1, backgroundColor: '#000' },
  tabRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 10, gap: 8 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: '#1a1a1a', alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: '#2a2a2a' },
  tabBtnActive: { backgroundColor: MASTER_ACCENT, borderColor: MASTER_ACCENT },
  tabText: { color: '#aaa', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#000' },
  tabBadge: { marginLeft: 6, minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9, backgroundColor: '#e74c3c', alignItems: 'center', justifyContent: 'center' },
  tabBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  notificationBanner: { position: 'absolute', top: 8, left: 12, right: 12, zIndex: 100, flexDirection: 'row', alignItems: 'center', backgroundColor: '#e74c3c', borderRadius: 14, padding: 12, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 12, elevation: 8 },
  notificationIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  notificationTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  notificationText: { color: 'rgba(255,255,255,0.9)', fontSize: 12, marginTop: 1 },
  jobCardDark: { backgroundColor: '#1a1a1a', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 0.5, borderColor: '#2a2a2a' },
  jobHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  clientBlock: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  clientAvatarSmall: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(52,152,219,0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  clientAvatarText: { color: '#3498db', fontSize: 16, fontWeight: '700' },
  jobClientLabel: { color: '#888', fontSize: 10, fontWeight: '600', letterSpacing: 0.5, marginBottom: 1 },
  jobClient: { fontSize: 16, fontWeight: '700', color: '#fff' },
  clientPhoneRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  clientPhone: { color: '#3498db', fontSize: 12, fontWeight: '600' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  metaRow: { flexDirection: 'row', gap: 12, marginBottom: 10, paddingTop: 6, borderTopWidth: 0.5, borderTopColor: '#2a2a2a' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: '#999', fontSize: 12 },
  itemsBlock: { backgroundColor: '#0d0d0d', borderRadius: 10, padding: 10, marginTop: 4 },
  itemsBlockTitle: { color: '#888', fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase' },
  itemLine: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: '#1a1a1a' },
  itemLineName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  itemLineUnit: { color: '#888', fontSize: 11, marginTop: 1 },
  itemLineSum: { color: '#fff', fontSize: 14, fontWeight: '700' },
  priceBlock: { marginTop: 12, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: '#2a2a2a' },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
  priceRowLabel: { color: '#aaa', fontSize: 13 },
  priceRowValue: { color: '#fff', fontSize: 14, fontWeight: '600' },
  priceDivider: { height: 0.5, backgroundColor: '#2a2a2a', marginVertical: 8 },
  priceTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceTotalLabel: { color: '#fff', fontSize: 16, fontWeight: '700' },
  priceTotalValue: { color: '#27ae60', fontSize: 24, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10, marginBottom: 10, marginTop: 12 },
  btnDark: { flex: 1, flexDirection: 'row', backgroundColor: '#222', borderRadius: 8, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: '#ffffff44' },
  btnDarkText: { fontSize: 14, fontWeight: '500', color: '#fff' },
  statusRow: { flexDirection: 'row' },
  statusBtn: { flex: 1, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  statusBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  waChatContainer: { flex: 1, backgroundColor: WA_CHAT_BG },
  dateSeparatorWrap: { alignItems: 'center', marginVertical: 12 },
  dateSeparator: { backgroundColor: 'rgba(24,34,41,0.92)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12 },
  dateSeparatorText: { color: '#8696a0', fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
  waMessageRow: { flexDirection: 'row', marginBottom: 3, paddingHorizontal: 6 },
  waBubble: { maxWidth: '80%', borderRadius: 18, paddingHorizontal: 11, paddingTop: 7, paddingBottom: 5, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 1.5, elevation: 2 },
  waBubbleMine: { backgroundColor: WA_BUBBLE_MINE, borderTopRightRadius: 5 },
  waBubbleOther: { backgroundColor: WA_BUBBLE_OTHER, borderTopLeftRadius: 5 },
  waAuthor: { color: WA_GREEN, fontSize: 12.5, fontWeight: '700', marginBottom: 2, marginHorizontal: 2 },
  waText: { color: '#e9edef', fontSize: 15, lineHeight: 20, marginHorizontal: 2 },
  waMediaBubble: { maxWidth: '80%', borderRadius: 18, padding: 3, backgroundColor: WA_BUBBLE_OTHER, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 1.5, elevation: 2 },
  waMediaBubbleMine: { backgroundColor: WA_BUBBLE_MINE, borderTopRightRadius: 5 },
  waMediaBubbleOther: { borderTopLeftRadius: 5 },
  waMediaImage: { width: 230, height: 230, borderRadius: 15, backgroundColor: '#000' },
  waMediaFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: 6, paddingVertical: 3 },
  waBubbleFooterInline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 2, marginHorizontal: 2 },
  waTime: { color: 'rgba(255,255,255,0.55)', fontSize: 11 },
  voiceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, minWidth: 200 },
  voicePlayBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  voiceWaveWrap: { flexDirection: 'row', alignItems: 'center', flex: 1, height: 26, gap: 2 },
  voiceWaveBar: { width: 2.5, borderRadius: 1.5 },
  voiceDuration: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginLeft: 8 },
  waInputRow: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 6, paddingTop: 6, paddingBottom: 10, backgroundColor: '#0b141a' },
  waInputWrap: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', backgroundColor: '#1f2c34', borderRadius: 26, paddingHorizontal: 4, paddingVertical: 4, minHeight: 48 },
  waInputIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  waInput: { flex: 1, color: '#e9edef', fontSize: 15.5, maxHeight: 120, paddingHorizontal: 4, paddingVertical: 10 },
  waSendBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: WA_GREEN, alignItems: 'center', justifyContent: 'center', marginLeft: 6, shadowColor: WA_GREEN, shadowOpacity: 0.35, shadowRadius: 8, elevation: 4 },
  commissionBox: { marginTop: 14, paddingTop: 14, borderTopWidth: 0.5, borderTopColor: '#2a2a2a' },
  commissionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  commissionLabel: { color: '#aaa', fontSize: 13, fontWeight: '600' },
  commissionValue: { color: '#f39c12', fontSize: 14, fontWeight: '700' },
  commissionDivider: { height: 0.5, backgroundColor: '#2a2a2a', marginVertical: 4 },
  masterHistoryCommissionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, marginTop: 8, borderTopWidth: 0.5, borderTopColor: '#2a2a2a' },
  masterHistoryCommissionLabel: { color: '#f39c12', fontSize: 11, fontWeight: '600' },
  masterHistoryCommissionValue: { color: '#f39c12', fontSize: 12, fontWeight: '700' },
  masterHistoryNetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 },
  masterHistoryNetLabel: { color: '#27ae60', fontSize: 12, fontWeight: '700' },
  masterHistoryNetValue: { color: '#27ae60', fontSize: 15, fontWeight: '700' },
  profileCommissionNotice: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: 'rgba(243,156,18,0.12)', borderRadius: 20, borderWidth: 0.5, borderColor: 'rgba(243,156,18,0.4)' },
  profileCommissionText: { color: '#ddd', fontSize: 12, fontWeight: '500' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', borderRadius: 12, marginHorizontal: 16, marginBottom: 14, borderWidth: 0.5, borderColor: '#2a2a2a' },
  searchInput: { flex: 1, color: '#fff', fontSize: 15, paddingVertical: 12, paddingHorizontal: 8 },
  searchResultsLabel: { color: '#888', fontSize: 12, fontWeight: '600', paddingHorizontal: 16, paddingBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  searchCategoryRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  searchCategoryBadge: { fontSize: 11, fontWeight: '600' },
});