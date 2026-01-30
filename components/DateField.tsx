import React, { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

const isWeb = Platform.OS === 'web';

type DateFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  editable?: boolean;
  style?: object;
};

/** Formatea Date a YYYY-MM-DD para la API */
function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parsea YYYY-MM-DD a Date */
function parseYMD(s: string): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return isNaN(date.getTime()) ? null : date;
}

export function DateField({ value, onChange, placeholder = 'Seleccionar fecha', editable = true, style }: DateFieldProps) {
  if (isWeb) {
    // En web usamos input type="date" para mostrar el calendario nativo del navegador
    const webInputStyle: React.CSSProperties = {
      width: '100%',
      padding: 12,
      marginBottom: 12,
      fontSize: 16,
      borderWidth: 1,
      borderStyle: 'solid',
      borderColor: '#e5e5e5',
      borderRadius: 8,
      outlineStyle: 'none',
      backgroundColor: editable ? '#fff' : '#f5f5f5',
    };
    return React.createElement('input', {
      type: 'date',
      value: value || '',
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
      disabled: !editable,
      style: webInputStyle,
      placeholder,
    });
  }

  // iOS/Android: abrir date picker nativo al pulsar
  const [showPicker, setShowPicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(() => parseYMD(value) || new Date());
  const dateObj = value ? parseYMD(value) : null;
  const displayText = dateObj ? toYMD(dateObj) : '';

  const openPicker = () => {
    if (!editable) return;
    setTempDate(parseYMD(value) || new Date());
    setShowPicker(true);
  };

  const onConfirmNative = (event: { nativeEvent: { action: string } }, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
      if (event.nativeEvent.action === 'set' && date) onChange(toYMD(date));
    }
  };

  const onConfirmIOS = () => {
    onChange(toYMD(tempDate));
    setShowPicker(false);
  };

  const DateTimePicker = require('@react-native-community/datetimepicker').default;
  const pickerValue = showPicker ? tempDate : (dateObj ? new Date(dateObj) : new Date());

  return (
    <View style={[styles.nativeWrap, style]}>
      <Pressable
        onPress={openPicker}
        style={[styles.trigger, !editable && styles.triggerDisabled]}
        disabled={!editable}
      >
        <Text style={[styles.triggerText, !displayText && styles.placeholder]} numberOfLines={1}>
          {displayText || placeholder}
        </Text>
      </Pressable>
      {Platform.OS === 'ios' && showPicker && (
        <Modal visible transparent animationType="slide">
          <Pressable style={styles.modalOverlay} onPress={() => setShowPicker(false)}>
            <View style={styles.modalContent}>
              <View style={styles.modalButtons}>
                <Pressable onPress={() => setShowPicker(false)} style={styles.modalBtn}>
                  <Text style={styles.modalBtnTextCancel}>Cancelar</Text>
                </Pressable>
                <Pressable onPress={onConfirmIOS} style={styles.modalBtn}>
                  <Text style={styles.modalBtnTextConfirm}>Aceptar</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={pickerValue}
                mode="date"
                display="spinner"
                onChange={(_e: unknown, d?: Date) => d && setTempDate(d)}
              />
            </View>
          </Pressable>
        </Modal>
      )}
      {Platform.OS === 'android' && showPicker && (
        <DateTimePicker value={pickerValue} mode="date" display="default" onChange={onConfirmNative} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  nativeWrap: { marginBottom: 12 },
  trigger: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 8,
    padding: 12,
    minHeight: 48,
    justifyContent: 'center',
  },
  triggerDisabled: { backgroundColor: '#f5f5f5' },
  triggerText: { fontSize: 16, color: '#000' },
  placeholder: { color: '#999' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalBtn: { paddingVertical: 8, paddingHorizontal: 4 },
  modalBtnTextCancel: { fontSize: 16, color: '#666' },
  modalBtnTextConfirm: { fontSize: 16, fontWeight: '600', color: '#0a7ea4' },
});
