import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';

type LeaderboardRow = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  total_points: number;
};

function getInitials(name: string | null): string {
  if (!name || !name.trim()) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function LeaderboardScreen() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<LeaderboardRow[]>([]);

  useEffect(() => {
    if (!profile?.org_id) return;
    (async () => {
      const { data } = await supabase
        .from('points_totals')
        .select('user_id, total_points')
        .eq('org_id', profile.org_id)
        .order('total_points', { ascending: false })
        .limit(50);
      if (!data?.length) {
        setRows([]);
        return;
      }
      const userIds = data.map((r: { user_id: string }) => r.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds);
      const profileMap = new Map((profiles ?? []).map((p: { id: string; full_name: string | null; avatar_url: string | null }) => [p.id, p]));
      const list: LeaderboardRow[] = data.map((r: { user_id: string; total_points: number }) => {
        const p = profileMap.get(r.user_id);
        return {
          user_id: r.user_id,
          full_name: p?.full_name ?? null,
          avatar_url: p?.avatar_url ?? null,
          total_points: r.total_points,
        };
      });
      setRows(list);
    })();
  }, [profile?.org_id]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ranking por puntos</Text>
      {rows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Aún no hay puntos en el ranking.</Text>
          <Text style={styles.emptySub}>Completa lecciones y registra transacciones para sumar puntos.</Text>
        </View>
      ) : (
      <FlatList
        data={rows}
        keyExtractor={(item) => item.user_id}
        style={styles.list}
        renderItem={({ item, index }) => (
          <View style={styles.row}>
            <View style={styles.rank}>
              <Text style={styles.rankText}>{index + 1}</Text>
            </View>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(item.full_name)}</Text>
            </View>
            <View style={styles.info}>
              <Text style={styles.name}>{item.full_name || 'Sin nombre'}</Text>
              <Text style={styles.points}>{item.total_points} pts</Text>
            </View>
          </View>
        )}
      />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  empty: { flex: 1, justifyContent: 'center', padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#666', textAlign: 'center' },
  emptySub: { fontSize: 14, color: '#999', marginTop: 8, textAlign: 'center' },
  list: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    gap: 12,
  },
  rank: { width: 32, alignItems: 'center' },
  rankText: { fontWeight: 'bold', fontSize: 18 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  info: { flex: 1 },
  name: { fontWeight: '600', fontSize: 16 },
  points: { fontSize: 14, color: '#666', marginTop: 2 },
});
