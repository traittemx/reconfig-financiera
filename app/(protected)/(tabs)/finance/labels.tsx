import { PointsRewardModal } from '@/components/PointsRewardModal';
import { useAuth } from '@/contexts/auth-context';
import { usePoints } from '@/contexts/points-context';
import { COLLECTIONS, createDocument, deleteDocument, execFunction, listDocuments, Query, updateDocument, type AppwriteDocument } from '@/lib/appwrite';
import { CATEGORY_COLOR_OPTIONS } from '@/lib/category-icons';
import { awardPoints } from '@/lib/points';
import { Pencil, Tag, Trash2 } from '@tamagui/lucide-icons';
import { MotiView } from 'moti';
import { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Button } from 'tamagui';

type Label = { id: string; name: string; color?: string | null };

export default function LabelsScreen() {
    const { profile, refresh } = useAuth();
    const pointsContext = usePoints();
    const [rewardToShow, setRewardToShow] = useState<{ points: number; message: string } | null>(null);
    const [labels, setLabels] = useState<Label[]>([]);
    const [name, setName] = useState('');
    const [selectedColor, setSelectedColor] = useState('#7c3aed');
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingLabel, setEditingLabel] = useState<Label | null>(null);

    useEffect(() => {
        if (!profile?.id || !profile.org_id) return;
        (async () => {
            // Seed default labels if not already seeded (using a custom check or just letting the RPC handle it)
            try {
                await execFunction('seed_default_labels', { p_org_id: profile.org_id, p_user_id: profile.id }, false);
            } catch (err) {
                console.error('[labels] error seeding:', err);
            }

            await fetchLabels();
        })();
    }, [profile?.id, profile?.org_id]);

    async function fetchLabels() {
        if (!profile?.id) return;
        try {
            const { data } = await listDocuments<AppwriteDocument>(COLLECTIONS.transaction_labels, [
                Query.equal('user_id', [profile.id]),
                Query.orderAsc('name'),
                Query.limit(100),
            ]);
            setLabels(data.map((d) => ({
                id: (d as { $id?: string }).$id ?? (d as { id?: string }).id ?? '',
                name: (d.name as string) ?? '',
                color: (d.color as string) ?? null,
            })) as Label[]);
        } catch (err) {
            console.error('[labels] fetch error:', err);
        }
    }

    function openEditForm(label: Label) {
        setEditingLabel(label);
        setName(label.name);
        setSelectedColor(label.color ?? '#7c3aed');
        setShowForm(true);
    }

    function cancelForm() {
        setShowForm(false);
        setEditingLabel(null);
        setName('');
        setSelectedColor('#7c3aed');
    }

    async function saveLabel() {
        if (!name.trim() || !profile?.id || !profile.org_id) return;
        setLoading(true);
        try {
            if (editingLabel) {
                await updateDocument(COLLECTIONS.transaction_labels, editingLabel.id, {
                    name: name.trim().toUpperCase(),
                    color: selectedColor,
                });
            } else {
                const result = await createDocument(COLLECTIONS.transaction_labels, {
                    org_id: profile.org_id,
                    user_id: profile.id,
                    name: name.trim().toUpperCase(),
                    color: selectedColor,
                    created_at: new Date().toISOString(),
                } as Record<string, unknown>);

                const newId = (result as { $id?: string }).$id ?? (result as { id?: string }).id ?? '';
                const pointsAwarded = await awardPoints(profile.org_id, profile.id, 'CREATE_CATEGORY', 'transaction_labels', newId);
                if (pointsAwarded > 0) {
                    setRewardToShow({ points: pointsAwarded, message: '¡Etiqueta creada!' });
                }
            }
            cancelForm();
            await fetchLabels();
        } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Error al guardar');
        } finally {
            setLoading(false);
        }
    }

    function confirmDelete(label: Label) {
        Alert.alert(
            'Eliminar etiqueta',
            `¿Eliminar "${label.name}"?`,
            [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Eliminar', style: 'destructive', onPress: () => deleteLabel(label) },
            ]
        );
    }

    async function deleteLabel(label: Label) {
        setLoading(true);
        try {
            await deleteDocument(COLLECTIONS.transaction_labels, label.id);
            await fetchLabels();
        } catch (err) {
            Alert.alert('Error al eliminar', err instanceof Error ? err.message : 'No se pudo eliminar la etiqueta.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <View style={styles.wrapper}>
            <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <MotiView
                    from={{ opacity: 0, translateY: 8 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ duration: 400 }}
                >
                    <Button
                        onPress={() => (showForm ? cancelForm() : setShowForm(true))}
                        theme="blue"
                        size="$3"
                        width="100%"
                        marginBottom={20}
                    >
                        {showForm ? 'Cancelar' : 'Nueva etiqueta'}
                    </Button>
                </MotiView>

                {showForm && (
                    <MotiView
                        from={{ opacity: 0, translateY: 12 }}
                        animate={{ opacity: 1, translateY: 0 }}
                        style={styles.formCard}
                    >
                        <Text style={styles.fieldLabel}>Nombre</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Ej. DESEO, LUJO, NECESIDAD"
                            value={name}
                            onChangeText={setName}
                            autoCapitalize="characters"
                            editable={!loading}
                        />
                        <Text style={styles.fieldLabel}>Color</Text>
                        <View style={styles.colorRow}>
                            {CATEGORY_COLOR_OPTIONS.map((color) => (
                                <TouchableOpacity
                                    key={color}
                                    onPress={() => setSelectedColor(color)}
                                    style={[
                                        styles.colorOption,
                                        { backgroundColor: color },
                                        selectedColor === color && styles.colorOptionSelected,
                                    ]}
                                />
                            ))}
                        </View>
                        <Button
                            onPress={saveLabel}
                            disabled={loading}
                            theme="green"
                            size="$4"
                        >
                            {loading ? 'Guardando...' : editingLabel ? 'Guardar cambios' : 'Crear etiqueta'}
                        </Button>
                    </MotiView>
                )}

                <Text style={styles.sectionTitle}>Tus etiquetas</Text>
                {labels.length === 0 ? (
                    <Text style={styles.emptyText}>No tienes etiquetas personalizadas.</Text>
                ) : (
                    labels.map((item, index) => (
                        <MotiView
                            key={item.id}
                            from={{ opacity: 0, translateX: -12 }}
                            animate={{ opacity: 1, translateX: 0 }}
                            transition={{ duration: 320, delay: index * 50 }}
                            style={styles.labelCard}
                        >
                            <View style={[styles.labelIconWrap, { backgroundColor: (item.color || '#7c3aed') + '22' }]}>
                                <Tag size={20} color={item.color || '#7c3aed'} />
                            </View>
                            <Text style={styles.labelName}>{item.name}</Text>
                            <View style={styles.labelActions}>
                                <TouchableOpacity onPress={() => openEditForm(item)} style={styles.actionBtn}>
                                    <Pencil size={18} color="#2563eb" />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => confirmDelete(item)} style={styles.actionBtn}>
                                    <Trash2 size={18} color="#dc2626" />
                                </TouchableOpacity>
                            </View>
                        </MotiView>
                    ))
                )}
            </ScrollView>

            <PointsRewardModal
                visible={rewardToShow !== null}
                points={rewardToShow?.points ?? 0}
                message={rewardToShow?.message ?? ''}
                onDismiss={() => {
                    setRewardToShow(null);
                    pointsContext?.refresh();
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: { flex: 1, backgroundColor: '#f1f5f9' },
    container: { flex: 1 },
    content: { padding: 20, paddingBottom: 40 },
    formCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
    },
    fieldLabel: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 10 },
    input: {
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        padding: 14,
        marginBottom: 18,
        fontSize: 16,
        backgroundColor: '#fff',
        ...(Platform.OS === 'web' && { outlineStyle: 'none' as any }),
    },
    colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 18 },
    colorOption: { width: 36, height: 36, borderRadius: 18 },
    colorOptionSelected: { borderWidth: 3, borderColor: '#0f172a' },
    sectionTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a', marginBottom: 12 },
    emptyText: { fontSize: 14, color: '#94a3b8', textAlign: 'center', marginTop: 20 },
    labelCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 16,
        marginBottom: 10,
        elevation: 1,
    },
    labelIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
    labelName: { fontSize: 16, fontWeight: '700', color: '#0f172a', flex: 1 },
    labelActions: { flexDirection: 'row', gap: 8 },
    actionBtn: { padding: 8 },
});
