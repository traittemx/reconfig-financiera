import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from 'tamagui';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
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
      const { data: members } = await supabase
        .from('org_members')
        .select('user_id')
        .eq('org_id', profile.org_id)
        .eq('status', 'active');
      if (!members?.length) {
        setRows([]);
        return;
      }
      const userIds = members.map((m: { user_id: string }) => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, start_date')
        .in('id', userIds);
      const { data: progress } = await supabase
        .from('user_lesson_progress')
        .select('user_id, day, completed_at')
        .eq('org_id', profile.org_id)
        .not('completed_at', 'is', null);
      const progressByUser = new Map<string, { days: number[]; last: string | null }>();
      (progress ?? []).forEach((p: { user_id: string; day: number; completed_at: string }) => {
        if (!progressByUser.has(p.user_id)) {
          progressByUser.set(p.user_id, { days: [], last: null });
        }
        const entry = progressByUser.get(p.user_id)!;
        entry.days.push(p.day);
        if (!entry.last || p.completed_at > entry.last) entry.last = p.completed_at;
      });
      const list: ProgressRow[] = (profiles ?? []).map((p: { id: string; full_name: string | null; start_date: string | null }) => {
        const entry = progressByUser.get(p.id) ?? { days: [], last: null };
        const dayUnlocked = p.start_date ? getDayUnlocked(new Date(p.start_date)) : 0;
        return {
          user_id: p.id,
          full_name: p.full_name,
          start_date: p.start_date,
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
