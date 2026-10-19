type Sale = { total: number; status: string; paymentMethod: string };
type Payment = { amount: number; status: string; resultDesc: string | null };
type Expense = { amount: number; category: string };
export type ReportRow = { section: string; metric: string; value: number; unit: 'KSh' | 'count' };

export function financialReport(sales: Sale[], payments: Payment[], expenses: Expense[]): ReportRow[] {
  const rows: ReportRow[] = [];
  const add = (section: string, metric: string, value: number, unit: 'KSh' | 'count' = 'KSh') => rows.push({ section, metric, value, unit });
  const cents = (amount: number) => Math.round(amount * 100);
  const completed = sales.filter((sale) => sale.status === 'COMPLETED');
  const online = payments.filter((payment) => payment.status === 'COMPLETED' && !payment.resultDesc?.startsWith('Paid at POS'));
  const posTotal = completed.reduce((sum, sale) => sum + cents(sale.total), 0);
  const onlineTotal = online.reduce((sum, payment) => sum + cents(payment.amount), 0);
  const expenseTotal = expenses.reduce((sum, expense) => sum + cents(expense.amount), 0);
  add('Profit & loss', 'Recorded income', (posTotal + onlineTotal) / 100);
  add('Profit & loss', 'Recorded expenses', expenseTotal / 100);
  add('Profit & loss', 'Estimated profit / loss', (posTotal + onlineTotal - expenseTotal) / 100);
  add('Sales', 'Completed POS sales', completed.length, 'count');
  add('Sales', 'POS income', posTotal / 100);
  for (const method of [...new Set(completed.map((sale) => sale.paymentMethod))].sort()) add('Sales', `POS ${method}`, completed.filter((sale) => sale.paymentMethod === method).reduce((sum, sale) => sum + cents(sale.total), 0) / 100);
  add('Sales', 'Online income (excludes POS settlements)', onlineTotal / 100);
  add('Sales', 'Online payments counted in income', online.length, 'count');
  add('Sales', 'Voided POS sales', sales.filter((sale) => sale.status === 'VOIDED').length, 'count');
  for (const status of ['COMPLETED', 'PENDING', 'FAILED', 'CANCELLED']) {
    const group = payments.filter((payment) => payment.status === status);
    add('Payment records', status, group.length, 'count');
    add('Payment records', `${status} amount`, group.reduce((sum, payment) => sum + cents(payment.amount), 0) / 100);
  }
  add('Expenses', 'Expense entries', expenses.length, 'count');
  for (const category of [...new Set(expenses.map((expense) => expense.category))].sort()) add('Expenses', category, expenses.filter((expense) => expense.category === category).reduce((sum, expense) => sum + cents(expense.amount), 0) / 100);
  return rows;
}

export function reportCsv(rows: ReportRow[], start: string, end: string) {
  const escape = (value: string | number) => {
    const raw = String(value);
    const safe = typeof value === 'string' && /^[=+@\-\t\r]/.test(raw) ? `'${raw}` : raw;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  return '\uFEFF' + [['Start', 'End', 'Section', 'Metric', 'Value', 'Unit'], ...rows.map((row) => [start, end, row.section, row.metric, row.value, row.unit])].map((row) => row.map(escape).join(',')).join('\r\n');
}
