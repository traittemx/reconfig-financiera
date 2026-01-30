import { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from 'tamagui';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';

export default function InviteAcceptScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const { refresh } = useAuth();
  const [invite, setInvite] = useState<{
    id: string;
    org_id: string;
    email: string;
    role: string;
    expires_at: string;
    accepted_at: string | null;
  } | null>(null);
  const [subscription, setSubscription] = useState<{ seats_used: number; seats_total: number } | null>(null);
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Token inválido');
      return;
    }
    (async () => {
      const { data: inv, error: invErr } = await supabase
        .from('org_invites')
        .select('id, org_id, email, role, expires_at, accepted_at')
        .eq('token', token)
        .single();
      if (invErr || !inv) {
        setError('Invitación no encontrada o expirada');
        return;
      }
      if (inv.accepted_at) {
        setError('Esta invitación ya fue aceptada');
        return;
      }
      if (new Date(inv.expires_at) < new Date()) {
        setError('Esta invitación ha expirado');
        return;
      }
      setInvite(inv);
      const { data: sub } = await supabase
        .from('org_subscriptions')
        .select('seats_used, seats_total')
        .eq('org_id', inv.org_id)
        .single();
      setSubscription(sub ?? null);
    })();
  }, [token]);

  async function acceptInvite() {
    if (!invite || !subscription || !fullName.trim() || !password) {
      Alert.alert('Error', 'Completa nombre y contraseña');
      return;
    }
    if (subscription.seats_used >= subscription.seats_total) {
      Alert.alert('Error', 'No hay plazas disponibles. Contacta al administrador.');
      return;
    }
    setLoading(true);
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: invite.email,
      password,
      options: { data: { full_name: fullName.trim() } },
    });
    if (authError) {
      if (authError.message.includes('already registered')) {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: invite.email,
          password,
        });
        if (signInErr) {
          setLoading(false);
          Alert.alert('Error', 'Ya existe una cuenta con este email. Usa "Iniciar sesión".');
          return;
        }
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }
        await supabase.from('org_members').insert({
          org_id: invite.org_id,
          user_id: user.id,
          role_in_org: invite.role,
          status: 'active',
        });
        await supabase
          .from('profiles')
          .update({
            full_name: fullName.trim(),
            org_id: invite.org_id,
            role: invite.role,
            start_date: new Date().toISOString().slice(0, 10),
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id);
        await supabase
          .from('org_invites')
          .update({ accepted_at: new Date().toISOString() })
          .eq('id', invite.id);
        await refresh();
        setLoading(false);
        router.replace('/(protected)/hoy');
        return;
      }
      setLoading(false);
      Alert.alert('Error', authError.message);
      return;
    }
    if (!authData.user) {
      setLoading(false);
      return;
    }
    await supabase.from('org_members').insert({
      org_id: invite.org_id,
      user_id: authData.user.id,
      role_in_org: invite.role,
      status: 'active',
    });
    await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim(),
        org_id: invite.org_id,
        role: invite.role,
        start_date: new Date().toISOString().slice(0, 10),
        updated_at: new Date().toISOString(),
      })
      .eq('id', authData.user.id);
    await supabase
      .from('org_invites')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invite.id);
    await refresh();
    setLoading(false);
    router.replace('/(protected)/hoy');
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>{error}</Text>
        <Button onPress={() => router.replace('/(public)')}>Volver</Button>
      </View>
    );
  }
  if (!invite) {
    return (
      <View style={styles.container}>
        <Text>Cargando invitación...</Text>
      </View>
    );
  }
  if (subscription && subscription.seats_used >= subscription.seats_total) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>No hay plazas disponibles en esta empresa.</Text>
        <Button onPress={() => router.replace('/(public)')}>Volver</Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Unirte a la empresa</Text>
      <Text style={styles.subtitle}>Email: {invite.email}</Text>
      <TextInput
        style={styles.input}
        placeholder="Tu nombre completo"
        value={fullName}
        onChangeText={setFullName}
        editable={!loading}
      />
      <TextInput
        style={styles.input}
        placeholder="Contraseña (mín. 6)"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        editable={!loading}
      />
      <Button theme="blue" size="$4" onPress={acceptInvite} disabled={loading}>
        {loading ? 'Uniendo...' : 'Aceptar invitación'}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  subtitle: { marginBottom: 24, textAlign: 'center', color: '#666' },
  input: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
    ...(Platform.OS === 'web' && { outlineStyle: 'none' }),
  },
  error: { color: '#b91c1c', marginBottom: 16, textAlign: 'center' },
});
