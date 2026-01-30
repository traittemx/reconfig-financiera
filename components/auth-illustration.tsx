import { View, StyleSheet } from 'react-native';

type Variant = 'signin' | 'signup' | 'forgot';

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    minHeight: 72,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  circle: { borderRadius: 9999 },
  circleLg: { width: 48, height: 48 },
  circleMd: { width: 32, height: 32 },
  circleSm: { width: 18, height: 18 },
  bar: { width: 36, height: 6, borderRadius: 3 },
  plus: { width: 16, height: 16, borderRadius: 3 },
});

export function AuthIllustration({ variant }: { variant: Variant }) {
  const blue = '#2563eb';
  const blueLight = '#93c5fd';
  const yellow = '#fbbf24';
  const gray = '#e5e7eb';

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={[styles.circle, styles.circleLg, { backgroundColor: blueLight }]} />
        <View style={[styles.bar, { backgroundColor: blue }]} />
        <View style={[styles.circle, styles.circleMd, { backgroundColor: yellow }]} />
      </View>
      <View style={[styles.row, { marginTop: 8, gap: 6 }]}>
        <View style={[styles.plus, { backgroundColor: blue }]} />
        <View style={[styles.circle, styles.circleSm, { backgroundColor: gray }]} />
        <View style={[styles.plus, { backgroundColor: yellow }]} />
      </View>
    </View>
  );
}
