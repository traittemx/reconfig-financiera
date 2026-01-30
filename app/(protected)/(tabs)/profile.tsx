import { View, Text, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from 'tamagui';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { EmotionalCheckin } from '@/components/pilot/EmotionalCheckin';

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, subscription, refresh } = useAuth();

  async function signOut() {
    await supabase.auth.signOut();
    await refresh();
    router.replace('/(public)/auth');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.name}>{profile?.full_name || 'Usuario'}</Text>
      {profile?.id ? (
        <View style={styles.checkinWrap}>
          <EmotionalCheckin userId={profile.id} date={new Date()} compact />
        </View>
      ) : null}
      <Text style={styles.role}>Rol: {profile?.role}</Text>
      {subscription && (
        <Text style={styles.sub}>
          Suscripción: {subscription.status} · {subscription.seats_used}/{subscription.seats_total} plazas
        </Text>
      )}
      {(profile?.role === 'ORG_ADMIN' || profile?.role === 'SUPER_ADMIN') && (
        <Button
          theme="blue"
          size="$4"
          onPress={() => router.push('/org')}
          style={{ marginTop: 24 }}
        >
          Admin empresa
        </Button>
      )}
      {profile?.role === 'SUPER_ADMIN' && (
        <Button
          theme="red"
          size="$4"
          onPress={() => router.push('/superadmin')}
          style={{ marginTop: 16 }}
        >
          Super Admin
        </Button>
      )}
      <Button theme="gray" size="$4" onPress={signOut} style={{ marginTop: 32 }}>
        Cerrar sesión
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#fff',
    ...(Platform.OS === 'web' && { minHeight: '100%' }),
  },
  name: { fontSize: 22, fontWeight: 'bold', marginBottom: 8 },
  role: { fontSize: 16, color: '#666', marginBottom: 4 },
  sub: { fontSize: 14, color: '#888', marginBottom: 16 },
  checkinWrap: { marginBottom: 20 },
});
