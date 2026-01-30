import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { saveEmotionalCheckin } from '@/lib/pilot';

const OPTIONS = [
  { value: 'bien', label: 'Bien' },
  { value: 'tranquilo', label: 'Tranquilo' },
  { value: 'estresado', label: 'Estresado' },
  { value: 'ansioso', label: 'Ansioso' },
] as const;

interface EmotionalCheckinProps {
  userId: string;
  date?: Date;
  compact?: boolean;
}

export function EmotionalCheckin({ userId, date = new Date(), compact = false }: EmotionalCheckinProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const dateStr = format(date, 'yyyy-MM-dd');
    supabase
      .from('pilot_emotional_checkins')
      .select('value')
      .eq('user_id', userId)
      .eq('checkin_date', dateStr)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) setSelected((data as { value: string }).value);
      });
  }, [userId, date]);

  async function handleSelect(value: string) {
    setSelected(value);
    setLoading(true);
    setSaved(false);
    const ok = await saveEmotionalCheckin(userId, date, value);
    setLoading(false);
    if (ok) setSaved(true);
  }

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <Text style={[styles.label, compact && styles.labelCompact]}>¿Cómo te sientes hoy?</Text>
      <View style={styles.row}>
        {OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[
              styles.option,
              selected === opt.value && styles.optionSelected,
              compact && styles.optionCompact,
            ]}
            onPress={() => handleSelect(opt.value)}
            disabled={loading}
          >
            <Text
              style={[
                styles.optionText,
                selected === opt.value && styles.optionTextSelected,
                compact && styles.optionTextCompact,
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {saved && <Text style={styles.saved}>Guardado</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 20,
  },
  wrapCompact: {
    marginBottom: 16,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 10,
  },
  labelCompact: {
    fontSize: 14,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  option: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  optionCompact: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  optionSelected: {
    backgroundColor: '#2563eb',
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  optionTextCompact: {
    fontSize: 13,
  },
  optionTextSelected: {
    color: '#fff',
  },
  saved: {
    fontSize: 12,
    color: '#16a34a',
    marginTop: 8,
  },
});
