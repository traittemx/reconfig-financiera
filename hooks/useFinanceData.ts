import type { MonthStats } from '@/components/finance/Last3MonthsChart';
import { COLLECTIONS, listDocuments, Query, type AppwriteDocument } from '@/lib/appwrite';
import type { SavingsGoalWithProgress } from '@/types/database';
import { endOfMonth, startOfMonth } from 'date-fns';
import { useCallback, useEffect, useState } from 'react';
export type CategoryExpense = {
    categoryName: string;
    categoryColor?: string;
    amount: number;
    percentage: number;
    category_id?: string;
};

export function useFinanceData(userId: string | null | undefined, orgId: string | null | undefined, selectedMonth: Date) {
    const [totalBalance, setTotalBalance] = useState<number>(0);
    const [monthIncome, setMonthIncome] = useState<number>(0);
    const [monthExpense, setMonthExpense] = useState<number>(0);
    const [expenseByCategory, setExpenseByCategory] = useState<CategoryExpense[]>([]);
    const [last3MonthsStats, setLast3MonthsStats] = useState<MonthStats[]>([]);
    const [savingsGoals, setSavingsGoals] = useState<SavingsGoalWithProgress[]>([]);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [allTransactions, setAllTransactions] = useState<any[]>([]);
    const [budgets, setBudgets] = useState<Record<string, number>>({});
    const [totalCreditDebt, setTotalCreditDebt] = useState<number>(0);
    const [loading, setLoading] = useState(true);

    const calculateAccountBalance = (
        accountId: string,
        transactions: any[],
        openingBalance: number,
        isDebt: boolean
    ) => {
        const real = transactions.filter((t) => !t.is_recurring);
        let net = 0;
        for (const t of real) {
            const amt = Number(t.amount);
            if (t.account_id === accountId) {
                if (t.kind === 'INCOME') net += isDebt ? -amt : amt;
                else if (t.kind === 'EXPENSE' || t.kind === 'TRANSFER') net += isDebt ? amt : -amt;
            } else if (t.transfer_account_id === accountId && t.kind === 'TRANSFER') {
                net += isDebt ? -amt : amt;
            }
        }
        return Number(openingBalance) + net;
    };

    const loadData = useCallback(async () => {
        if (!userId) return;
        setLoading(true);
        try {
            // 1. Fetch Accounts and All Transactions for Balance
            const [{ data: accounts }, { data: allTx }] = await Promise.all([
                listDocuments<AppwriteDocument>(COLLECTIONS.accounts, [Query.equal('user_id', [userId]), Query.limit(500)]),
                listDocuments<AppwriteDocument>(COLLECTIONS.transactions, [Query.equal('user_id', [userId]), Query.limit(5000)]),
            ]);

            let liquidBalance = 0;
            let debt = 0;
            accounts.forEach((a) => {
                const isDebt = a.type === 'CREDIT' || a.type === 'CREDIT_CARD';
                const accBalance = calculateAccountBalance(a.$id, allTx, Number(a.opening_balance || 0), isDebt);
                if (isDebt) {
                    debt += Math.abs(accBalance);
                } else {
                    liquidBalance += accBalance;
                }
            });
            setAccounts(accounts);
            setAllTransactions(allTx);
            setTotalBalance(liquidBalance);
            setTotalCreditDebt(debt);

            // 2. Fetch Month Specific Data
            const mStart = startOfMonth(selectedMonth).toISOString();
            const mEnd = endOfMonth(selectedMonth).toISOString();

            const [{ data: monthTx }, { data: categories }, { data: recurring }, { data: budgetsRes }] = await Promise.all([
                listDocuments<AppwriteDocument>(COLLECTIONS.transactions, [
                    Query.equal('user_id', [userId]),
                    Query.greaterThanEqual('occurred_at', mStart),
                    Query.lessThanEqual('occurred_at', mEnd),
                    Query.limit(1000)
                ]),
                listDocuments<AppwriteDocument>(COLLECTIONS.categories, [Query.equal('user_id', [userId]), Query.limit(500)]),
                listDocuments<AppwriteDocument>(COLLECTIONS.transactions, [
                    Query.equal('user_id', [userId]),
                    Query.equal('is_recurring', [true]),
                    Query.limit(200)
                ]),
                listDocuments<AppwriteDocument>(COLLECTIONS.budgets, [
                    Query.equal('user_id', [userId]),
                    Query.equal('month', ['0000-01']), // Current fixed budget system
                    Query.limit(1)
                ])
            ]);

            // Fetch budget items if a budget exists
            let budgetLimits: Record<string, number> = {};
            if (budgetsRes.length > 0) {
                const budgetId = budgetsRes[0].$id;
                const { data: items } = await listDocuments<AppwriteDocument>(COLLECTIONS.budget_items, [
                    Query.equal('budget_id', [budgetId]),
                    Query.limit(100)
                ]);
                items.forEach(item => {
                    budgetLimits[item.category_id as string] = Number(item.limit_amount);
                });
            }
            setBudgets(budgetLimits);

            // Calculate Income/Expense
            let income = 0;
            let expense = 0;
            const realMonthTx = monthTx.filter(t => !t.is_recurring);

            realMonthTx.forEach(t => {
                if (t.kind === 'INCOME') income += Number(t.amount);
                else if (t.kind === 'EXPENSE') expense += Number(t.amount);
            });

            // Calculate active recurring instances for the selected month
            const mStartDate = startOfMonth(selectedMonth);
            const mEndDate = endOfMonth(selectedMonth);

            recurring.forEach(t => {
                const day = t.recurrence_day_of_month ?? 1;
                const templateStart = new Date(t.occurred_at);
                const maxDay = mEndDate.getDate();
                const safeDay = Math.min(day, maxDay);
                const d = new Date(mStartDate.getFullYear(), mStartDate.getMonth(), safeDay);

                // If the occurrence date is before the template start, it's not active yet
                if (d < startOfMonth(templateStart)) return;

                // Check recurrence interval and total occurrences
                const interval = t.recurrence_interval_months ?? 1;
                const start = startOfMonth(templateStart);
                const diffMonths = (mStartDate.getFullYear() - start.getFullYear()) * 12 + (mStartDate.getMonth() - start.getMonth());

                if (diffMonths % interval !== 0) return;

                const occurrenceIndex = Math.floor(diffMonths / interval) + 1;
                if (t.recurrence_total_occurrences != null && occurrenceIndex > t.recurrence_total_occurrences) return;

                const monthlyAmt = Number(t.amount) / interval;
                if (t.kind === 'INCOME') income += monthlyAmt;
                else if (t.kind === 'EXPENSE') expense += monthlyAmt;
            });

            setMonthIncome(income);
            setMonthExpense(expense);

            // 3. Category Breakdown
            const catMap = new Map<string, { name: string; color?: string }>(
                categories.map((c) => [c.$id, { name: c.name as string, color: c.color as string | undefined }])
            );
            const byCat: Record<string, { amount: number; color?: string; id?: string }> = {};
            let totalExp = 0;

            [...realMonthTx.filter((t) => t.kind === 'EXPENSE')].forEach(
                (t) => {
                    const cid = (t.category_id as string) || 'other';
                    const catInfo = catMap.get(cid) || { name: 'Sin categoría', color: undefined };
                    const amt = Number(t.amount);

                    if (!byCat[catInfo.name]) byCat[catInfo.name] = { amount: 0, color: catInfo.color, id: cid };
                    byCat[catInfo.name].amount += amt;
                    totalExp += amt;
                }
            );

            recurring.filter((t) => t.kind === 'EXPENSE').forEach((t) => {
                const day = t.recurrence_day_of_month ?? 1;
                const templateStart = new Date(t.occurred_at);
                const maxDay = mEndDate.getDate();
                const safeDay = Math.min(day, maxDay);
                const d = new Date(mStartDate.getFullYear(), mStartDate.getMonth(), safeDay);

                if (d < startOfMonth(templateStart)) return;

                const interval = t.recurrence_interval_months ?? 1;
                const start = startOfMonth(templateStart);
                const diffMonths = (mStartDate.getFullYear() - start.getFullYear()) * 12 + (mStartDate.getMonth() - start.getMonth());

                if (diffMonths % interval !== 0) return;

                const occurrenceIndex = Math.floor(diffMonths / interval) + 1;
                if (t.recurrence_total_occurrences != null && occurrenceIndex > t.recurrence_total_occurrences) return;

                const cid = (t.category_id as string) || 'other';
                const catInfo = catMap.get(cid) || { name: 'Sin categoría', color: undefined };
                const amt = Number(t.amount) / interval;

                if (!byCat[catInfo.name]) byCat[catInfo.name] = { amount: 0, color: catInfo.color, id: cid };
                byCat[catInfo.name].amount += amt;
                totalExp += amt;
            });
            setExpenseByCategory(Object.entries(byCat).map(([name, info]) => ({
                categoryName: name,
                amount: info.amount,
                percentage: totalExp > 0 ? (info.amount / totalExp) * 100 : 0,
                categoryColor: info.color,
                category_id: info.id
            })).sort((a, b) => b.amount - a.amount));

        } catch (e) {
            console.error('Error fetching finance data:', e);
        } finally {
            setLoading(false);
        }
    }, [userId, selectedMonth]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    return {
        totalBalance,
        totalCreditDebt,
        monthIncome,
        monthExpense,
        expenseByCategory,
        last3MonthsStats,
        savingsGoals,
        budgets,
        accounts: accounts.map(a => ({
            ...a,
            balance: calculateAccountBalance(a.$id, allTransactions, Number(a.opening_balance || 0), a.type === 'CREDIT' || a.type === 'CREDIT_CARD')
        })),
        loading,
        refresh: loadData
    };
}
