import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUnlockDateForLesson, parseLocalDateString } from '@/lib/business-days';

const NOTIFICATION_PERMISSION_KEY = 'notification_permission_requested';

/** Total lessons; reminders are scheduled for 8:00 AM Mexico City on each unlock day. */
const TOTAL_LESSONS = 23;
/** 8:00 AM Mexico City = 14:00 UTC (Mexico City UTC-6, no DST since 2022). */
const LESSON_REMINDER_UTC_HOUR = 14;

// Lazy load expo-notifications only on native platforms
let Notifications: typeof import('expo-notifications') | null = null;

async function getNotifications() {
  if (Platform.OS === 'web') {
    return null;
  }
  if (!Notifications) {
    Notifications = await import('expo-notifications');
    // Configure notification handler
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }
  return Notifications;
}

/**
 * Request notification permissions from the user
 * Returns true if permissions were granted
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }

  const notifications = await getNotifications();
  if (!notifications) return false;

  const { status: existingStatus } = await notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  // Store that we've requested permissions
  await AsyncStorage.setItem(NOTIFICATION_PERMISSION_KEY, 'true');

  return finalStatus === 'granted';
}

/**
 * Check if notification permissions are granted
 */
export async function hasNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }

  const notifications = await getNotifications();
  if (!notifications) return false;

  const { status } = await notifications.getPermissionsAsync();
  return status === 'granted';
}

/**
 * Check if we've already requested permissions
 */
export async function hasRequestedPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return true; // Skip on web
  }
  const requested = await AsyncStorage.getItem(NOTIFICATION_PERMISSION_KEY);
  return requested === 'true';
}

type ScheduledTransactionNotification = {
  transactionId: string;
  kind: 'EXPENSE' | 'INCOME' | 'TRANSFER';
  amount: number;
  categoryName?: string;
  scheduledDate: Date;
};

/**
 * Schedule a notification for a scheduled transaction
 * Notification is sent 1 day before and on the same day at 9:00 AM
 */
export async function scheduleTransactionNotification(
  transaction: ScheduledTransactionNotification
): Promise<string[]> {
  if (Platform.OS === 'web') {
    return [];
  }

  const notifications = await getNotifications();
  if (!notifications) return [];

  const hasPermission = await hasNotificationPermissions();
  if (!hasPermission) {
    return [];
  }

  const { transactionId, kind, amount, categoryName, scheduledDate } = transaction;
  const notificationIds: string[] = [];

  const kindLabel = kind === 'EXPENSE' ? 'Gasto' : kind === 'INCOME' ? 'Ingreso' : 'Transferencia';
  const formattedAmount = amount.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
  const categoryText = categoryName ? ` - ${categoryName}` : '';

  // Calculate notification times
  const now = new Date();
  const scheduledTime = new Date(scheduledDate);
  
  // Notification on the same day at 9:00 AM
  const sameDayNotification = new Date(scheduledTime);
  sameDayNotification.setHours(9, 0, 0, 0);

  // Notification 1 day before at 9:00 AM
  const dayBeforeNotification = new Date(scheduledTime);
  dayBeforeNotification.setDate(dayBeforeNotification.getDate() - 1);
  dayBeforeNotification.setHours(9, 0, 0, 0);

  // Schedule notification for 1 day before (if it's in the future)
  if (dayBeforeNotification > now) {
    const id = await notifications.scheduleNotificationAsync({
      content: {
        title: `${kindLabel} programado para mañana`,
        body: `Tienes un ${kindLabel.toLowerCase()} de ${formattedAmount}${categoryText} programado para mañana.`,
        data: { transactionId, type: 'scheduled_transaction_reminder' },
        sound: true,
      },
      trigger: {
        type: notifications.SchedulableTriggerInputTypes.DATE,
        date: dayBeforeNotification,
      },
      identifier: `tx_reminder_before_${transactionId}`,
    });
    notificationIds.push(id);
  }

  // Schedule notification for the same day (if it's in the future)
  if (sameDayNotification > now) {
    const id = await notifications.scheduleNotificationAsync({
      content: {
        title: `${kindLabel} programado para hoy`,
        body: `Recuerda: tienes un ${kindLabel.toLowerCase()} de ${formattedAmount}${categoryText} programado para hoy.`,
        data: { transactionId, type: 'scheduled_transaction_due' },
        sound: true,
      },
      trigger: {
        type: notifications.SchedulableTriggerInputTypes.DATE,
        date: sameDayNotification,
      },
      identifier: `tx_reminder_due_${transactionId}`,
    });
    notificationIds.push(id);
  }

  // Store notification IDs for this transaction
  await storeNotificationIds(transactionId, notificationIds);

  return notificationIds;
}

/**
 * Cancel all notifications for a specific transaction
 */
export async function cancelTransactionNotifications(transactionId: string): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  const notifications = await getNotifications();
  if (!notifications) return;

  // Cancel by known identifiers
  await notifications.cancelScheduledNotificationAsync(`tx_reminder_before_${transactionId}`).catch(() => {});
  await notifications.cancelScheduledNotificationAsync(`tx_reminder_due_${transactionId}`).catch(() => {});

  // Also try to cancel from stored IDs
  const storedIds = await getNotificationIds(transactionId);
  for (const id of storedIds) {
    await notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  }

  // Clean up stored IDs
  await removeNotificationIds(transactionId);
}

/**
 * Cancel all scheduled lesson reminders (lesson_reminder_1 … lesson_reminder_23).
 */
export async function cancelLessonReminders(): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  const notifications = await getNotifications();
  if (!notifications) return;

  for (let N = 1; N <= TOTAL_LESSONS; N++) {
    await notifications
      .cancelScheduledNotificationAsync(`lesson_reminder_${N}`)
      .catch(() => {});
  }
}

/**
 * Schedule local notifications at 8:00 AM Mexico City on each business day
 * when a lesson unlocks (1..23). Idempotent: cancels existing lesson reminders
 * first, then schedules only future dates. Call after user starts course or
 * when opening course tab to restore reminders (e.g. after reinstall).
 */
export async function scheduleLessonReminders(startDate: string): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  const notifications = await getNotifications();
  if (!notifications) return;

  const hasPermission = await hasNotificationPermissions();
  if (!hasPermission) {
    return;
  }

  await cancelLessonReminders();

  const start = parseLocalDateString(startDate);
  const now = new Date();

  for (let N = 1; N <= TOTAL_LESSONS; N++) {
    const unlockDate = getUnlockDateForLesson(start, N);
    const yyyy = unlockDate.getFullYear();
    const mm = String(unlockDate.getMonth() + 1).padStart(2, '0');
    const dd = String(unlockDate.getDate()).padStart(2, '0');
    const triggerAt = new Date(
      `${yyyy}-${mm}-${dd}T${String(LESSON_REMINDER_UTC_HOUR).padStart(2, '0')}:00:00.000Z`
    );

    if (triggerAt <= now) continue;

    await notifications.scheduleNotificationAsync({
      content: {
        title: 'Nueva lección disponible',
        body: N === 1 ? 'Ya está disponible la primera lección.' : `Ya está disponible la lección ${N}.`,
        data: { type: 'lesson_reminder', lessonNumber: N },
        sound: true,
      },
      trigger: {
        type: notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerAt,
      },
      identifier: `lesson_reminder_${N}`,
    });
  }
}

/**
 * Get all scheduled notifications (for debugging)
 */
export async function getAllScheduledNotifications(): Promise<unknown[]> {
  if (Platform.OS === 'web') {
    return [];
  }
  const notifications = await getNotifications();
  if (!notifications) return [];
  return notifications.getAllScheduledNotificationsAsync();
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }
  const notifications = await getNotifications();
  if (!notifications) return;
  await notifications.cancelAllScheduledNotificationsAsync();
}

// Storage helpers for notification IDs
const NOTIFICATION_IDS_PREFIX = 'notification_ids_';

async function storeNotificationIds(transactionId: string, ids: string[]): Promise<void> {
  await AsyncStorage.setItem(`${NOTIFICATION_IDS_PREFIX}${transactionId}`, JSON.stringify(ids));
}

async function getNotificationIds(transactionId: string): Promise<string[]> {
  const stored = await AsyncStorage.getItem(`${NOTIFICATION_IDS_PREFIX}${transactionId}`);
  return stored ? JSON.parse(stored) : [];
}

async function removeNotificationIds(transactionId: string): Promise<void> {
  await AsyncStorage.removeItem(`${NOTIFICATION_IDS_PREFIX}${transactionId}`);
}
