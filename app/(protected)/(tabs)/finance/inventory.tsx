import { useAuth } from '@/contexts/auth-context';
import { Calendar, LayoutGrid, NotebookPen, Plus, ShoppingBag, Store, Wallet, X } from '@tamagui/lucide-icons';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import React, { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { Button } from 'tamagui';

import { COLLECTIONS, createDocument, deleteDocument, listDocuments, Query, type AppwriteDocument } from '@/lib/appwrite';

type InventoryItem = {
    id: string;
    name: string;
    store: string | null;
    notes: string | null;
    amount: number;
    purchase_date: string;
    created_at: string;
};

type Account = {
    id: string;
    name: string;
};

export default function InventoryScreen() {
    const { profile } = useAuth();
    const router = useRouter();
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Modal state
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
    const [isSellModalVisible, setIsSellModalVisible] = useState(false);
    const [saleAmount, setSaleAmount] = useState('');
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [isSelling, setIsSelling] = useState(false);

    const loadInventory = useCallback(async () => {
        if (!profile?.id || !profile.org_id) return;
        try {
            const { data } = await listDocuments<AppwriteDocument>(COLLECTIONS.inventory_items, [
                Query.equal('user_id', [profile.id]),
                Query.equal('org_id', [profile.org_id]),
                Query.orderDesc('purchase_date'),
                Query.limit(500),
            ]);
            setItems(data.map((d) => ({
                id: (d as any).id ?? (d as any).$id ?? '',
                name: d.name as string,
                store: d.store as string | null,
                notes: d.notes as string | null,
                amount: Number(d.amount ?? 0),
                purchase_date: d.purchase_date as string,
                created_at: d.created_at as string,
            })) as InventoryItem[]);

            // Load accounts for sale form
            const { data: accData } = await listDocuments<AppwriteDocument>(COLLECTIONS.accounts, [
                Query.equal('user_id', [profile.id]),
                Query.limit(100),
            ]);
            setAccounts(accData.map(a => ({
                id: (a as any).id ?? (a as any).$id ?? '',
                name: a.name as string
            })));
        } catch (err) {
            console.error('[inventory] load error:', err);
            Alert.alert('Error', 'No se pudo cargar el inventario.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [profile?.id, profile?.org_id]);

    useEffect(() => {
        loadInventory();
    }, [loadInventory]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadInventory();
    }, [loadInventory]);

    const openSellModal = (item: InventoryItem) => {
        setSelectedItem(item);
        setSaleAmount(String(item.amount));
        setIsSellModalVisible(true);
    };

    const handleSell = async () => {
        if (!selectedItem || !profile?.id || !profile.org_id) return;

        const amount = parseFloat(saleAmount.replace(',', '.'));
        if (isNaN(amount) || amount <= 0) {
            Alert.alert('Monto inválido', 'Por favor ingresa un precio de venta válido.');
            return;
        }

        if (!selectedAccountId) {
            Alert.alert('Selecciona una cuenta', 'Por favor selecciona a qué cuenta llegó el dinero.');
            return;
        }

        setIsSelling(true);
        try {
            // 1. Find or create "Venta de activo" category
            const { data: categories } = await listDocuments<AppwriteDocument>(COLLECTIONS.categories, [
                Query.equal('user_id', [profile.id]),
                Query.equal('kind', ['INCOME']),
                Query.equal('name', ['Venta de activo']),
                Query.limit(1)
            ]);

            let categoryId = '';
            if (categories.length > 0) {
                categoryId = (categories[0] as any).id ?? (categories[0] as any).$id;
            } else {
                const newCat = await createDocument(COLLECTIONS.categories, {
                    org_id: profile.org_id,
                    user_id: profile.id,
                    kind: 'INCOME',
                    name: 'Venta de activo',
                    is_default: false,
                    icon: 'TrendingUp',
                    color: '#16a34a',
                    created_at: new Date().toISOString()
                });
                categoryId = (newCat as any).id ?? (newCat as any).$id;
            }

            // 2. Create income transaction
            await createDocument(COLLECTIONS.transactions, {
                org_id: profile.org_id,
                user_id: profile.id,
                account_id: selectedAccountId,
                kind: 'INCOME',
                amount: amount,
                category_id: categoryId,
                note: `Venta de: ${selectedItem.name}`,
                occurred_at: new Date().toISOString(),
                created_at: new Date().toISOString()
            });

            // 3. Delete from inventory
            await deleteDocument(COLLECTIONS.inventory_items, selectedItem.id);

            Alert.alert('Éxito', 'Bien vendido y registrado correctamente.');
            setIsSellModalVisible(false);
            setSelectedItem(null);
            loadInventory();
        } catch (err) {
            console.error('[inventory] sell error:', err);
            Alert.alert('Error', 'No se pudo registrar la venta.');
        } finally {
            setIsSelling(false);
        }
    };

    const totalValue = items.reduce((sum, item) => sum + item.amount, 0);

    return (
        <View style={styles.wrapper}>
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />
                }
            >
                <MotiView
                    from={{ opacity: 0, translateY: 10 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    style={styles.heroCard}
                >
                    <View style={styles.heroContent}>
                        <View style={styles.heroHeader}>
                            <View style={styles.heroIconWrap}>
                                <ShoppingBag size={24} color="#fff" />
                            </View>
                            <Text style={styles.heroLabel}>Valor Total del Inventario</Text>
                        </View>
                        <Text style={styles.heroAmount}>
                            {totalValue.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                        </Text>
                        <View style={styles.heroFooter}>
                            <LayoutGrid size={14} color="rgba(255,255,255,0.7)" />
                            <Text style={styles.heroFooterText}>{items.length} bienes registrados</Text>
                        </View>
                    </View>
                </MotiView>

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Bienes Recientes</Text>
                    <TouchableOpacity onPress={() => router.push('/(tabs)/finance/transactions?new=1')}>
                        <View style={styles.addShortcut}>
                            <Plus size={16} color="#2563eb" />
                            <Text style={styles.addShortcutText}>Registrar Compra</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                {loading && !refreshing ? (
                    <View style={styles.loadingState}>
                        <Text style={styles.emptyText}>Cargando inventario...</Text>
                    </View>
                ) : items.length === 0 ? (
                    <MotiView
                        from={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        style={styles.emptyState}
                    >
                        <ShoppingBag size={48} color="#cbd5e1" />
                        <Text style={styles.emptyTitle}>Tu inventario está vacío</Text>
                        <Text style={styles.emptyText}>
                            Los bienes que registres al crear un gasto aparecerán aquí para llevar un control de tus posesiones.
                        </Text>
                    </MotiView>
                ) : (
                    items.map((item, index) => (
                        <MotiView
                            key={item.id}
                            from={{ opacity: 0, translateX: -10 }}
                            animate={{ opacity: 1, translateX: 0 }}
                            transition={{ delay: index * 50 }}
                        >
                            <TouchableOpacity
                                style={styles.itemCard}
                                activeOpacity={0.7}
                                onPress={() => openSellModal(item)}
                            >
                                <View style={styles.itemHeader}>
                                    <View style={styles.itemNameRow}>
                                        <LayoutGrid size={18} color="#2563eb" />
                                        <Text style={styles.itemName}>{item.name}</Text>
                                    </View>
                                    <Text style={styles.itemAmount}>
                                        {item.amount.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                                    </Text>
                                </View>

                                <View style={styles.itemDetails}>
                                    {item.store && (
                                        <View style={styles.detailRow}>
                                            <Store size={14} color="#64748b" />
                                            <Text style={styles.detailText}>{item.store}</Text>
                                        </View>
                                    )}
                                    <View style={styles.detailRow}>
                                        <Calendar size={14} color="#64748b" />
                                        <Text style={styles.detailText}>
                                            {format(new Date(item.purchase_date), "d 'de' MMMM, yyyy", { locale: es })}
                                        </Text>
                                    </View>
                                    {item.notes && (
                                        <View style={[styles.detailRow, { alignItems: 'flex-start', marginTop: 4 }]}>
                                            <NotebookPen size={14} color="#94a3b8" />
                                            <Text style={styles.notesText}>{item.notes}</Text>
                                        </View>
                                    )}
                                </View>
                            </TouchableOpacity>
                        </MotiView>
                    ))
                )}
            </ScrollView>

            {/* Sell Modal */}
            <Modal
                visible={isSellModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setIsSellModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <MotiView
                        from={{ translateY: 100 }}
                        animate={{ translateY: 0 }}
                        style={styles.modalContent}
                    >
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Vender Bien</Text>
                            <TouchableOpacity onPress={() => setIsSellModalVisible(false)}>
                                <X size={24} color="#0f172a" />
                            </TouchableOpacity>
                        </View>

                        {selectedItem && (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <View style={styles.itemPreview}>
                                    <Text style={styles.previewName}>{selectedItem.name}</Text>
                                    <Text style={styles.previewInfo}>Comprado por: {selectedItem.amount.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</Text>
                                </View>

                                <Text style={styles.fieldLabel}>Precio de venta (MXN)</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="0"
                                    keyboardType="decimal-pad"
                                    value={saleAmount}
                                    onChangeText={setSaleAmount}
                                />

                                <Text style={styles.fieldLabel}>¿A qué cuenta llegó el dinero?</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.accountPicker}>
                                    {accounts.map((acc) => (
                                        <TouchableOpacity
                                            key={acc.id}
                                            style={[
                                                styles.accountChip,
                                                selectedAccountId === acc.id && styles.accountChipActive
                                            ]}
                                            onPress={() => setSelectedAccountId(acc.id)}
                                        >
                                            <Wallet size={16} color={selectedAccountId === acc.id ? '#fff' : '#64748b'} />
                                            <Text style={[
                                                styles.accountChipText,
                                                selectedAccountId === acc.id && styles.accountChipTextActive
                                            ]}>
                                                {acc.name}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>

                                <Button
                                    marginTop={24}
                                    theme="green"
                                    size="$4"
                                    onPress={handleSell}
                                    disabled={isSelling}
                                >
                                    {isSelling ? 'Registrando venta...' : 'Registrar Venta'}
                                </Button>
                            </ScrollView>
                        )}
                    </MotiView>
                </View>
            </Modal>

            <TouchableOpacity
                style={styles.fab}
                onPress={() => router.push('/(tabs)/finance/transactions?new=1')}
                activeOpacity={0.9}
            >
                <Plus size={28} color="#fff" />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    container: { flex: 1 },
    content: { padding: 20, paddingBottom: 100 },
    heroCard: {
        backgroundColor: '#2563eb',
        borderRadius: 24,
        padding: 24,
        marginBottom: 24,
        shadowColor: '#2563eb',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 6,
    },
    heroContent: { gap: 8 },
    heroHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
    heroIconWrap: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroLabel: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },
    heroAmount: { fontSize: 32, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
    heroFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    heroFooterText: { fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.7)' },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
        paddingHorizontal: 4,
    },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
    addShortcut: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    addShortcutText: { fontSize: 14, fontWeight: '600', color: '#2563eb' },
    loadingState: { padding: 40, alignItems: 'center' },
    emptyState: {
        padding: 40,
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        gap: 12,
    },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: '#334155', marginTop: 8 },
    emptyText: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20 },
    itemCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 2,
    },
    itemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    itemNameRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    itemName: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
    itemAmount: { fontSize: 16, fontWeight: '700', color: '#16a34a' },
    itemDetails: { gap: 6 },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    detailText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
    notesText: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic', flex: 1 },
    fab: {
        position: 'absolute',
        bottom: 24,
        right: 24,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#2563eb',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 8,
        shadowColor: '#2563eb',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        minHeight: '60%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalTitle: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
    itemPreview: {
        padding: 16,
        backgroundColor: '#f1f5f9',
        borderRadius: 16,
        marginBottom: 24,
    },
    previewName: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
    previewInfo: { fontSize: 14, color: '#64748b' },
    fieldLabel: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 12 },
    input: {
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 16,
        padding: 16,
        fontSize: 18,
        color: '#0f172a',
        marginBottom: 24,
        backgroundColor: '#fff',
    },
    accountPicker: { flexDirection: 'row', marginBottom: 8 },
    accountChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: '#f1f5f9',
        marginRight: 10,
        gap: 8,
        height: 44,
    },
    accountChipActive: { backgroundColor: '#2563eb' },
    accountChipText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
    accountChipTextActive: { color: '#fff' },
});
