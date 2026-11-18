import * as Location from 'expo-location';
import { Vibration } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { COMMISSION_THRESHOLD, RANKS } from './constants';

export const getCommissionRate = (amount) => (amount <= COMMISSION_THRESHOLD ? 0.07 : 0.05);
export const getCommissionAmount = (amount) => Math.round(amount * getCommissionRate(amount));
export const formatCommissionPct = (amount) => `${Math.round(getCommissionRate(amount) * 100)}%`;

export const getRank = (orders) => RANKS.find(r => orders >= r.minOrders && orders < r.maxOrders) || RANKS[RANKS.length - 1];
export const getMonthKey = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth()}`; };

export const getDistanceMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371000;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

export const formatDistance = (m) => (m < 1000 ? `${m} м` : `${(m / 1000).toFixed(1)} км`);

export const parsePrice = (str) => {
  if (!str) return 0;
  if (typeof str === 'number') return str;
  const cleaned = String(str).replace(/\s/g, '');
  const match = cleaned.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
};

export const reverseGeocodeToAddress = async (latitude, longitude) => {
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

export const pluralServices = (n) => {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'услуга';
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return 'услуги';
  return 'услуг';
};

export const renderStars = (rating, size = 14) => {
  const arr = [];
  for (let i = 1; i <= 5; i++) {
    arr.push(<Ionicons key={i} name={i <= Math.round(rating) ? 'star' : 'star-outline'} size={size} color="#f39c12" style={{ marginRight: 2 }} />);
  }
  return arr;
};

export const formatSec = (sec) => {
  const s = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
};

export const cleanPhone = (p) => String(p).replace(/[^\d+]/g, '');
export const softVibrate = (ms = 12) => { try { Vibration.vibrate(ms); } catch (e) {} };

export const statusColor = (status) => {
  switch (status) {
    case 'new': return { backgroundColor: '#e74c3c' };
    case 'on_way': return { backgroundColor: '#f39c12' };
    case 'on_site': return { backgroundColor: '#3498db' };
    case 'done': return { backgroundColor: '#27ae60' };
    default: return { backgroundColor: '#95a5a6' };
  }
};