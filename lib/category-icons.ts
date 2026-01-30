import type { LucideIcon } from '@tamagui/lucide-icons';
import {
  UtensilsCrossed,
  Car,
  Home,
  HeartPulse,
  Gamepad2,
  GraduationCap,
  Receipt,
  Wallet,
  Briefcase,
  DollarSign,
  Tag,
  ShoppingCart,
  Plane,
  Coffee,
  Music,
  BookOpen,
  Gift,
  Zap,
  TrendingUp,
  TrendingDown,
  MoreHorizontal,
} from '@tamagui/lucide-icons';

export const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  UtensilsCrossed,
  Car,
  Home,
  HeartPulse,
  Gamepad2,
  GraduationCap,
  Receipt,
  Wallet,
  Briefcase,
  DollarSign,
  Tag,
  ShoppingCart,
  Plane,
  Coffee,
  Music,
  BookOpen,
  Gift,
  Zap,
  TrendingUp,
  TrendingDown,
  MoreHorizontal,
};

export const CATEGORY_ICON_OPTIONS: { value: string; label: string }[] = [
  { value: 'UtensilsCrossed', label: 'Comida' },
  { value: 'Car', label: 'Auto' },
  { value: 'Home', label: 'Casa' },
  { value: 'HeartPulse', label: 'Salud' },
  { value: 'Gamepad2', label: 'Juegos' },
  { value: 'GraduationCap', label: 'Educación' },
  { value: 'Receipt', label: 'Comprobante' },
  { value: 'Wallet', label: 'Billetera' },
  { value: 'Briefcase', label: 'Trabajo' },
  { value: 'DollarSign', label: 'Dinero' },
  { value: 'Tag', label: 'Etiqueta' },
  { value: 'ShoppingCart', label: 'Compras' },
  { value: 'Plane', label: 'Viajes' },
  { value: 'Coffee', label: 'Café' },
  { value: 'Music', label: 'Música' },
  { value: 'BookOpen', label: 'Libros' },
  { value: 'Gift', label: 'Regalos' },
  { value: 'Zap', label: 'Energía' },
  { value: 'TrendingUp', label: 'Sube' },
  { value: 'TrendingDown', label: 'Baja' },
  { value: 'MoreHorizontal', label: 'Otros' },
];

export const CATEGORY_COLOR_OPTIONS = [
  '#e11d48', // rose
  '#2563eb', // blue
  '#16a34a', // green
  '#dc2626', // red
  '#7c3aed', // violet
  '#ea580c', // orange
  '#0d9488', // teal
  '#64748b', // slate
  '#be185d', // pink
  '#0891b2', // cyan
  '#ca8a04', // yellow
  '#65a30d', // lime
];

const DEFAULT_EXPENSE_ICON = Receipt;
const DEFAULT_INCOME_ICON = Tag;
const DEFAULT_COLOR = '#64748b';

export function getCategoryIcon(iconName: string | null | undefined, kind?: string): LucideIcon {
  if (iconName && CATEGORY_ICON_MAP[iconName]) {
    return CATEGORY_ICON_MAP[iconName];
  }
  return kind === 'INCOME' ? DEFAULT_INCOME_ICON : DEFAULT_EXPENSE_ICON;
}

export function getCategoryColor(color: string | null | undefined, index?: number): string {
  if (color) return color;
  if (typeof index === 'number') {
    return CATEGORY_COLOR_OPTIONS[index % CATEGORY_COLOR_OPTIONS.length];
  }
  return DEFAULT_COLOR;
}
