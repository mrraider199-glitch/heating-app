import React, { useState } from 'react';
import { SafeAreaView, StatusBar, KeyboardAvoidingView, ScrollView, Platform, Text, View, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../config/supabase';
import { cleanPhone } from '../utils';
import { HeatingBackground, FlameLogoGlow, AnimatedRoleFooter } from '../components/Backgrounds';
import styles from '../styles';

export default function AuthScreen({ onAuth }) {
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
          <View style={styles.authLogoWrap}>
            <View style={{ width: 90, height: 90, alignItems: 'center', justifyContent: 'center' }}>
              <FlameLogoGlow />
              <Ionicons name="flame" size={48} color="#ff8c42" />
            </View>
          </View>
          <Text style={styles.authTitle}>Отопление и ремонт</Text>
          <Text style={styles.authSubtitle}>{mode === 'login' ? 'Войдите в аккаунт' : 'Создайте аккаунт'}</Text>
          
          <View style={styles.authTabsRow}>
            <TouchableOpacity style={[styles.authTab, mode === 'login' && styles.authTabActive]} onPress={() => setMode('login')}>
              <Text style={[styles.authTabText, mode === 'login' && styles.authTabTextActive]}>Вход</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.authTab, mode === 'register' && styles.authTabActive]} onPress={() => setMode('register')}>
              <Text style={[styles.authTabText, mode === 'register' && styles.authTabTextActive]}>Регистрация</Text>
            </TouchableOpacity>
          </View>

          {mode === 'register' && (
            <>
              <View style={styles.authInputWrap}>
                <Ionicons name="person-outline" size={20} color="#666" style={styles.authInputIcon} />
                <TextInput style={styles.authInput} placeholder="Имя" placeholderTextColor="#666" value={name} onChangeText={setName} autoCapitalize="words" />
              </View>
              <View style={styles.authInputWrap}>
                <Ionicons name="id-card-outline" size={20} color="#666" style={styles.authInputIcon} />
                <TextInput style={styles.authInput} placeholder="Фамилия" placeholderTextColor="#666" value={surname} onChangeText={setSurname} autoCapitalize="words" />
              </View>
            </>
          )}

          <View style={styles.authInputWrap}>
            <Ionicons name="call-outline" size={20} color="#666" style={styles.authInputIcon} />
            <TextInput style={styles.authInput} placeholder="+7 (900) 000-00-00" placeholderTextColor="#666" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          </View>
          <View style={styles.authInputWrap}>
            <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.authInputIcon} />
            <TextInput style={styles.authInput} placeholder="Пароль (мин. 6 символов)" placeholderTextColor="#666" value={password} onChangeText={setPassword} secureTextEntry />
          </View>

          {mode === 'register' && (
            <>
              <Text style={styles.authRoleLabel}>Выберите роль</Text>
              <View style={styles.authRoleRow}>
                <TouchableOpacity style={[styles.authRoleBtn, role === 'client' && styles.authRoleBtnClient]} onPress={() => setRole('client')}>
                  <Ionicons name="person" size={20} color={role === 'client' ? '#fff' : '#3498db'} />
                  <Text style={[styles.authRoleBtnText, role === 'client' && { color: '#fff' }]}>Клиент</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.authRoleBtn, role === 'master' && styles.authRoleBtnMaster]} onPress={() => setRole('master')}>
                  <Ionicons name="construct" size={20} color={role === 'master' ? '#fff' : '#e74c3c'} />
                  <Text style={[styles.authRoleBtnText, role === 'master' && { color: '#fff' }]}>Мастер</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          <TouchableOpacity style={styles.authSubmitBtn} onPress={handleSubmit} disabled={loading} activeOpacity={0.85}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.authSubmitBtnText}>{mode === 'login' ? 'Войти' : 'Зарегистрироваться'}</Text>}
          </TouchableOpacity>
          <AnimatedRoleFooter />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}