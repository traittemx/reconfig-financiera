import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, Platform } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Button } from 'tamagui';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';

export default function SignupScreen() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [orgName, setOrgName] = useState('');
  const [slug, setSlug] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function signUp() {
    if (!orgName.trim() || !slug.trim() || !fullName.trim() || !email.trim() || !password) {
      Alert.alert('Error', 'Completa todos los campos');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setLoading(true);
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim() } },
    });
    if (authError) {
      setLoading(false);
      Alert.alert('Error', authError.message);
      return;
    }
    if (!authData.user) {
      setLoading(false);
      return;
    }
    const orgSlug = slug.trim().toLowerCase().replace(/\s+/g, '-') || orgName.trim().toLowerCase().replace(/\s+/g, '-');
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({ name: orgName.trim(), slug: orgSlug })
      .select('id')
      .single();
    if (orgError) {
      setLoading(false);
      Alert.alert('Error', 'No se pudo crear la organización: ' + orgError.message);
      return;
    }
    const orgId = org.id;
    await supabase.from('org_members').insert({
      org_id: orgId,
      user_id: authData.user.id,
      role_in_org: 'ORG_ADMIN',
      status: 'active',
    });
    await supabase.from('org_subscriptions').insert({
      org_id: orgId,
      status: 'trial',
      seats_total: 10,
      seats_used: 1,
      period_start: new Date().toISOString().slice(0, 10),
      period_end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    });
    await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim(),
        org_id: orgId,
        role: 'ORG_ADMIN',
        start_date: new Date().toISOString().slice(0, 10),
        updated_at: new Date().toISOString(),
      })
      .eq('id', authData.user.id);
    await refresh();
    setLoading(false);
    router.replace('/(tabs)');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Registrar empresa</Text>
      <TextInput
        style={styles.input}
        placeholder="Nombre de la empresa"
        value={orgName}
        onChangeText={(t) => {
          setOrgName(t);
          if (!slug) setSlug(t.toLowerCase().replace(/\s+/g, '-'));
        }}
        editable={!loading}
      />
      <TextInput
        style={styles.input}
        placeholder="Slug (ej: mi-empresa)"
        value={slug}
        onChangeText={setSlug}
        autoCapitalize="none"
        editable={!loading}
      />
      <TextInput
        style={styles.input}
        placeholder="Tu nombre completo"
        value={fullName}
        onChangeText={setFullName}
        editable={!loading}
      />
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
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
      <Button theme="blue" size="$4" onPress={signUp} disabled={loading}>
        {loading ? 'Creando...' : 'Crear cuenta'}
      </Button>
      <Link href="/(public)/auth" asChild style={{ marginTop: 16 }}>
        <Button theme="gray" size="$3" variant="outlined">
          Ya tengo cuenta
        </Button>
      </Link>
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
    ...(Platform.OS === 'web' && { outlineStyle: 'none' }),
  },
});
