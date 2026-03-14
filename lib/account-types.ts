import {
    CreditCard,
    Landmark,
    PiggyBank,
    Receipt,
    TrendingUp,
    Wallet,
} from '@tamagui/lucide-icons';
import * as React from 'react';

export const TYPE_CONFIG: Record<string, { icon: React.ComponentType<any>; label: string; color: string; bg: string }> = {
    CASH: { icon: Wallet, label: 'Efectivo', color: '#16a34a', bg: '#dcfce7' },
    BANK: { icon: Landmark, label: 'Banco', color: '#2563eb', bg: '#dbeafe' },
    CARD: { icon: CreditCard, label: 'Tarjeta de débito', color: '#7c3aed', bg: '#ede9fe' },
    CREDIT_CARD: { icon: CreditCard, label: 'Tarjeta de crédito', color: '#dc2626', bg: '#fee2e2' },
    SAVINGS: { icon: PiggyBank, label: 'Ahorros', color: '#0d9488', bg: '#ccfbf1' },
    INVESTMENT: { icon: TrendingUp, label: 'Inversión', color: '#ea580c', bg: '#ffedd5' },
    CREDIT: { icon: Receipt, label: 'Crédito', color: '#dc2626', bg: '#fee2e2' },
};
