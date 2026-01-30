import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';

type Variant = 'signin' | 'signup' | 'forgot';

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    minHeight: 56,
  },
  logo: {
    width: 180,
    height: 48,
    resizeMode: 'contain',
  },
});

export function AuthIllustration({ variant }: { variant: Variant }) {
  return (
    <View style={styles.wrap}>
      <Image
        source={require('@/assets/images/finaria-logo.png')}
        style={styles.logo}
        contentFit="contain"
      />
    </View>
  );
}
