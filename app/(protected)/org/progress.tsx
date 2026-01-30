import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from 'tamagui';
import { useAuth } from '@/contexts/auth-context';
import { listDocuments, COLLECTIONS, Query, type AppwriteDocument } from '@/lib/appwrite';
import { getDayUnlocked } from '@/lib/business-days';
import { format } from 'date-fns';

type ProgressRow = {
  user_id: string;
  full_name: string | null;
  start_date: string | null;
  completed_count: number;
  completed_days: number[];
  last_completed: string | null;
};

export default function OrgProgressScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [rows, setRows] = useState<ProgressRow[]>([]);

  useEffect(() => {
    if (!profile?.org_id) return;
    (async () => {
      const { data: members } = await listDocuments<AppwriteDocument>(COLLECTIONS.org_members, [
        Query.equal('org_id', [profile.org_id!]),
        Query.equal('status', ['active']),
        Query.limit(200),
      ]);
      if (!members?.length) {
        setRows([]);
        return;
      }
      const userIds = members.map((m) => (m as AppwriteDocument).user_id as string);
      const { data: profiles } = await listDocuments<AppwriteDocument>(COLLECTIONS.profiles, [
        Query.equal('org_id', [profile.org_id!]),
        Query.limit(200),
      ]);
      const { data: progress } = await listDocuments<AppwriteDocument>(COLLECTIONS.user_lesson_progress, [
        Query.equal('org_id', [profile.org_id!]),
        Query.limit(500),
      ]);
      const progressByUser = new Map<string, { days: number[]; last: string | null }>();
      progress.forEach((p) => {
        const doc = p as AppwriteDocument;
        const userId = doc.user_id as string;
        const completedAt = doc.completed_at as string | null;
        if (!completedAt) return;
        if (!progressByUser.has(userId)) progressByUser.set(userId, { days: [], last: null });
        const entry = progressByUser.get(userId)!;
        const dayNum = Number(doc.day ?? 0);
        entry.days.push(dayNum);
        if (!entry.last || completedAt > entry.last) entry.last = completedAt;
      });
      const profileById = new Map(profiles.map((p) => [(p as AppwriteDocument).$id ?? (p as { id?: string }).id, p as AppwriteDocument]));
      const list: ProgressRow[] = userIds.map((userId) => {
        const p = profileById.get(userId);
        const entry = progressByUser.get(userId) ?? { days: [], last: null };
        const startDate = p?.start_date as string | null ?? null;
        return {
          user_id: userId,
          full_name: (p?.full_name as string | null) ?? null,
          start_date: startDate,
          completed_count: entry.days.length,
          completed_days: entry.days.sort((a, b) => a - b),
          last_completed: entry.last,
        };
      });
      setRows(list);
    })();
  }, [profile?.org_id]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Progreso del curso por empleado</Text>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.user_id}
        style={styles.list}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.name}>{item.full_name || item.user_id}</Text>
            <Text style={styles.percent}>
              {item.completed_count} / 23 ({(item.completed_count / 23 * 100).toFixed(0)}%)
            </Text>
            {item.last_completed && (
              <Text style={styles.date}>
                Última: {format(new Date(item.last_completed), 'dd/MM/yyyy')}
              </Text>
            )}
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
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  name: { fontWeight: '600', fontSize: 16 },
  percent: { color: '#666', marginTop: 4 },
  date: { fontSize: 12, color: '#888', marginTop: 2 },
});
