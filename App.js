import React, { useState, useEffect } from 'react';
import { SafeAreaView, ActivityIndicator } from 'react-native';
import { supabase } from './src/config/supabase';
import AuthScreen from './src/screens/AuthScreen';
import ClientScreen from './src/screens/ClientScreen';
import MasterScreen from './src/screens/MasterScreen';
import { FadeInScreen } from './src/components/AnimatedUI';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          if (profile) setUser({ id: session.user.id, ...profile });
        }
      } catch (e) { 
        console.log('Auth error:', e); 
      } finally { 
        setLoading(false); 
      }
    })();
  }, []);

  const handleAuth = async (u) => { setUser(u); };
  const handleLogout = async () => { 
    await supabase.auth.signOut(); 
    setUser(null); 
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#3498db" size="large" />
      </SafeAreaView>
    );
  }

  if (!user) return <AuthScreen onAuth={handleAuth} />;
  
  if (user.role === 'client') {
    return <FadeInScreen><ClientScreen user={user} onExit={handleLogout} /></FadeInScreen>;
  }
  
  return <FadeInScreen><MasterScreen user={user} onExit={handleLogout} /></FadeInScreen>;
}