import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from 'tamagui';
import { useAuth } from '@/contexts/auth-context';
import { listDocuments, COLLECTIONS, Query, type AppwriteDocument } from '@/lib/appwrite';

type LeaderboardRow = { user_id: string; full_name: string | null; total_points: number };

function getInitials(name: string | null): string {
  if (!name || !name.trim()) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function OrgLeaderboardScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [rows, setRows] = useState<LeaderboardRow[]>([]);

  useEffect(() => {
    if (!profile?.org_id) return;
    (async () => {
      const { data } = await listDocuments<AppwriteDocument>(COLLECTIONS.points_totals, [
        Query.equal('org_id', [profile.org_id!]),
        Query.orderDesc('total_points'),
        Query.limit(50),
      ]);
      if (!data?.length) {
        setRows([]);
        return;
      }
      const userIds = data.map((d) => (d as AppwriteDocument).user_id as string);
      const { data: profiles } = await listDocuments<AppwriteDocument>(COLLECTIONS.profiles, [
        Query.equal('org_id', [profile.org_id!]),
        Query.limit(200),
      ]);
      const profileMap = new Map(
        profiles.map((p) => [
          (p as AppwriteDocument).$id ?? (p as { id?: string }).id,
          (p as AppwriteDocument).full_name as string | null,
        ])
      );
      const list: LeaderboardRow[] = data.map((d) => {
        const doc = d as AppwriteDocument;
        const userId = doc.user_id as string;
        return {
          user_id: userId,
          full_name: profileMap.get(userId) ?? null,
          total_points: (doc.total_points as number) ?? 0,
        };
      });
      setRows(list);
    })();
  }, [profile?.org_id]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Leaderboard del equipo</Text>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.user_id}
        style={styles.list}
        renderItem={({ item, index }) => (
          <View style={styles.row}>
            <Text style={styles.rank}>{index + 1}</Text>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(item.full_name)}</Text>
            </View>
            <Text style={styles.name}>{item.full_name || item.user_id}</Text>
            <Text style={styles.points}>{item.total_points} pts</Text>
          </View>
        )}
      />
      <Button onPress={() => router.back()} theme="gray" size="$3">
        Volver
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  list: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    gap: 12,
  },
  rank: { width: 28, fontWeight: 'bold' },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  name: { flex: 1, fontWeight: '600' },
  points: { fontWeight: '600', color: '#666' },
});
