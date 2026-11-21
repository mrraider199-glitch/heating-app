import React, { useState } from 'react';
import { 
  SafeAreaView, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  ScrollView,
  ActivityIndicator 
} from 'react-native';
import { supabase } from '../config/supabase';

export default function AuthScreen({ onAuth }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [phone, setPhone] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [role, setRole] = useState('client');
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Ошибка', 'Введите email и пароль');
      return;
    }

    if (isSignUp && !name) {
      Alert.alert('Ошибка', 'Введите имя');
      return;
    }

    setLoading(true);

    try {
      if (isSignUp) {
        // Регистрация
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        
        if (error) throw error;
        
        // Создаем профиль
        const { error: profileError } = await supabase.from('profiles').insert({
          id: data.user.id,
          role,
          name,
          surname,
          phone,
          email,
        });
        
        if (profileError) throw profileError;
        
        Alert.alert(
          'Успех', 
          'Регистрация успешна! Теперь войдите.',
          [{ text: 'OK', onPress: () => setIsSignUp(false) }]
        );
      } else {
        // Вход
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (error) throw error;
        
        // Загружаем профиль
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();
        
        if (profileError) throw profileError;
        
        onAuth({ id: data.user.id, ...profile });
      }
    } catch (error) {
      Alert.alert('Ошибка', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
      <ScrollView contentContainerStyle={{ padding: 20, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={{ marginTop: 40, marginBottom: 30 }}>
          <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#fff', textAlign: 'center' }}>
            {isSignUp ? 'Регистрация' : 'Вход'}
          </Text>
          <Text style={{ color: '#888', textAlign: 'center', marginTop: 8, fontSize: 16 }}>
            {isSignUp ? 'Создайте аккаунт' : 'Войдите в свой аккаунт'}
          </Text>
        </View>
        
        <TextInput
          style={{ 
            backgroundColor: '#1a1a1a', 
            borderWidth: 1, 
            borderColor: '#333', 
            borderRadius: 12, 
            padding: 15, 
            marginBottom: 12,
            color: '#fff',
            fontSize: 16
          }}
          placeholder="Email"
          placeholderTextColor="#666"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        
        <TextInput
          style={{ 
            backgroundColor: '#1a1a1a', 
            borderWidth: 1, 
            borderColor: '#333', 
            borderRadius: 12, 
            padding: 15, 
            marginBottom: 12,
            color: '#fff',
            fontSize: 16
          }}
          placeholder="Пароль"
          placeholderTextColor="#666"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        
        {isSignUp && (
          <>
            <TextInput
              style={{ 
                backgroundColor: '#1a1a1a', 
                borderWidth: 1, 
                borderColor: '#333', 
                borderRadius: 12, 
                padding: 15, 
                marginBottom: 12,
                color: '#fff',
                fontSize: 16
              }}
              placeholder="Имя"
              placeholderTextColor="#666"
              value={name}
              onChangeText={setName}
            />
            
            <TextInput
              style={{ 
                backgroundColor: '#1a1a1a', 
                borderWidth: 1, 
                borderColor: '#333', 
                borderRadius: 12, 
                padding: 15, 
                marginBottom: 12,
                color: '#fff',
                fontSize: 16
              }}
              placeholder="Фамилия"
              placeholderTextColor="#666"
              value={surname}
              onChangeText={setSurname}
            />
            
            <TextInput
              style={{ 
                backgroundColor: '#1a1a1a', 
                borderWidth: 1, 
                borderColor: '#333', 
                borderRadius: 12, 
                padding: 15, 
                marginBottom: 12,
                color: '#fff',
                fontSize: 16
              }}
              placeholder="Телефон"
              placeholderTextColor="#666"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
            
            <Text style={{ color: '#fff', marginBottom: 10, fontSize: 16, fontWeight: '600' }}>
              Выберите роль:
            </Text>
            
            <View style={{ flexDirection: 'row', marginBottom: 15 }}>
              <TouchableOpacity 
                style={{ 
                  flex: 1, 
                  padding: 15, 
                  backgroundColor: role === 'client' ? '#3498db' : '#1a1a1a', 
                  marginRight: 8, 
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: role === 'client' ? '#3498db' : '#333'
                }}
                onPress={() => setRole('client')}
              >
                <Text style={{ 
                  textAlign: 'center', 
                  color: role === 'client' ? '#fff' : '#888',
                  fontWeight: '600'
                }}>
                  👤 Клиент
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={{ 
                  flex: 1, 
                  padding: 15, 
                  backgroundColor: role === 'master' ? '#3498db' : '#1a1a1a', 
                  marginLeft: 8, 
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: role === 'master' ? '#3498db' : '#333'
                }}
                onPress={() => setRole('master')}
              >
                <Text style={{ 
                  textAlign: 'center', 
                  color: role === 'master' ? '#fff' : '#888',
                  fontWeight: '600'
                }}>
                  🔧 Мастер
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
        
        <TouchableOpacity 
          style={{ 
            backgroundColor: '#3498db', 
            padding: 16, 
            borderRadius: 12, 
            marginTop: 10,
            opacity: loading ? 0.6 : 1
          }}
          onPress={handleAuth}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ 
              color: '#fff', 
              textAlign: 'center', 
              fontWeight: 'bold',
              fontSize: 16
            }}>
              {isSignUp ? 'Зарегистрироваться' : 'Войти'}
            </Text>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={{ marginTop: 20 }}
          onPress={() => setIsSignUp(!isSignUp)}
        >
          <Text style={{ 
            textAlign: 'center', 
            color: '#3498db',
            fontSize: 15
          }}>
            {isSignUp ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Регистрация'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}