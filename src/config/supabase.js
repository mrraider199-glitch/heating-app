import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
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