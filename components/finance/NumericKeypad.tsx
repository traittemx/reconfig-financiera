import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { X } from '@tamagui/lucide-icons';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'backspace'];

export interface NumericKeypadProps {
  value: string;
  onChange: (value: string) => void;
  maxDecimals?: number;
}

export function NumericKeypad({ value, onChange, maxDecimals = 2 }: NumericKeypadProps) {
  function handlePress(key: string) {
    if (key === 'backspace') {
      onChange(value.slice(0, -1));
      return;
    }
    if (key === '.') {
      if (value.includes('.')) return;
      onChange(value ? `${value}.` : '0.');
      return;
    }
    const next = value + key;
    if (next.includes('.')) {
      const [, decimals] = next.split('.');
      if (decimals && decimals.length > maxDecimals) return;
    }
    if (next === '0' || (value === '0' && key !== '.')) {
      onChange(key);
      return;
    }
    onChange(next);
  }

  return (
    <View style={styles.container}>
      {KEYS.map((key) => (
        <TouchableOpacity
          key={key}
          style={styles.key}
          onPress={() => handlePress(key)}
          activeOpacity={0.7}
          accessibilityLabel={key === 'backspace' ? 'Borrar' : key}
        >
          {key === 'backspace' ? (
            <View style={styles.backspace}>
              <X size={22} color="#334155" strokeWidth={2.5} />
            </View>
          ) : (
            <Text style={styles.keyText}>{key}</Text>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  key: {
    width: '30%',
    minWidth: 72,
    maxWidth: 100,
    aspectRatio: 1.4,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'ios' && { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 }),
    ...(Platform.OS === 'android' && { elevation: 1 }),
  },
  keyText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#0f172a',
  },
  backspace: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
  },
});
