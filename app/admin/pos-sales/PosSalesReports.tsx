'use client';

import { useState } from 'react';
import { BRAND, WHATSAPP_NUMBER } from '@/app/lib/brand';
import { formatKes } from '@/app/lib/pos';
import { FaCashRegister, FaMoneyBillWave, FaMobileAlt, FaReceipt, FaPrint, FaSearch, FaUserTie } from 'react-icons/fa';

interface PosSaleRecord {
  id: string;
  saleNumber: string;
  cashierId: string;
  cashierName: string;
  items: Array<{
    id: string;
    name: string;
    category: string;
    price: number;
    quantity: number;
    notes?: string;
  }>;
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  amountPaid: number;
  changeDue: number;
  mpesaCode?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  notes?: string | null;
  status: string;
  createdAt: string;
}

export default function PosSalesReports({ initialSales }: { initialSales: PosSaleRecord[] }) {
  const sales = initialSales;
  const [selectedCashier, setSelectedCashier] = useState('ALL');
  const [selectedMethod, setSelectedMethod] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeReceipt, setActiveReceipt] = useState<PosSaleRecord | null>(null);

  // Extract unique cashiers
  const cashiers = Array.from(new Set(sales.map((s) => s.cashierName)));

  // Filter sales
  const filteredSales = sales.filter((s) => {
    const matchesCashier = selectedCashier === 'ALL' || s.cashierName === selectedCashier;
    const matchesMethod = selectedMethod === 'ALL' || s.paymentMethod === selectedMethod;
    const matchesSearch =
      !searchQuery ||
      s.saleNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.cashierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.customerName && s.customerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.mpesaCode && s.mpesaCode.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesCashier && matchesMethod && matchesSearch;
  });

  // Calculate Metrics
  const totalRevenue = filteredSales.reduce((sum, s) => sum + s.total, 0);
  const cashTotal = filteredSales
    .filter((s) => s.paymentMethod === 'CASH')
    .reduce((sum, s) => sum + s.total, 0);
  const mpesaTotal = filteredSales
    .filter((s) => s.paymentMethod === 'MPESA')
    .reduce((sum, s) => sum + s.total, 0);
  const totalOrders = filteredSales.length;

  // Breakdown by Cashier
  const activeCashiers = Array.from(new Set(filteredSales.map((s) => s.cashierName)));
  const cashierStats = activeCashiers.map((cName) => {
    const cSales = filteredSales.filter((s) => s.cashierName === cName);
    const cRevenue = cSales.reduce((sum, s) => sum + s.total, 0);
    const cCash = cSales.filter((s) => s.paymentMethod === 'CASH').reduce((sum, s) => sum + s.total, 0);
    const cMpesa = cSales.filter((s) => s.paymentMethod === 'MPESA').reduce((sum, s) => sum + s.total, 0);
    return {
      name: cName,
      count: cSales.length,
      revenue: cRevenue,
      cash: cCash,
      mpesa: cMpesa,
    };
  });

  const printReceipt = () => {
    window.print();
  };

  return (
    <div>
      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="checkout-panel border-l-4 border-l-[#0e6b5c]">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase font-semibold text-stone-500">POS Revenue</p>
            <FaCashRegister className="text-[#0e6b5c] text-xl" />
          </div>
          <p className="font-serif text-3xl mt-3 text-stone-900">{formatKes(totalRevenue)}</p>
          <p className="text-xs text-stone-400 mt-1">{totalOrders} completed transactions</p>
        </div>

        <div className="checkout-panel border-l-4 border-l-emerald-600">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase font-semibold text-stone-500">Cash Payments</p>
            <FaMoneyBillWave className="text-emerald-600 text-xl" />
          </div>
          <p className="font-serif text-3xl mt-3 text-stone-900">{formatKes(cashTotal)}</p>
          <p className="text-xs text-stone-400 mt-1">Cash sales after change</p>
        </div>

        <div className="checkout-panel border-l-4 border-l-green-600">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase font-semibold text-stone-500">M-Pesa Collected</p>
            <FaMobileAlt className="text-green-600 text-xl" />
          </div>
          <p className="font-serif text-3xl mt-3 text-stone-900">{formatKes(mpesaTotal)}</p>
          <p className="text-xs text-stone-400 mt-1">Till & mobile payments</p>
        </div>

        <div className="checkout-panel border-l-4 border-l-amber-600">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase font-semibold text-stone-500">Active Cashiers</p>
            <FaUserTie className="text-amber-600 text-xl" />
          </div>
          <p className="font-serif text-3xl mt-3 text-stone-900">{activeCashiers.length}</p>
          <p className="text-xs text-stone-400 mt-1">Staff members with sales</p>
        </div>
      </div>

      {/* Cashier Performance Breakdown */}
      {cashierStats.length > 0 && (
        <section className="checkout-panel mb-8 overflow-x-auto">
          <h2 className="text-xl font-serif mb-4 flex items-center gap-2">
            <FaUserTie className="text-[#0e6b5c]" /> Sales Breakdown by Cashier
          </h2>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-stone-200 text-xs font-semibold text-stone-600 bg-stone-50">
              <tr>
                <th className="p-3">Cashier</th>
                <th className="p-3">Sales Count</th>
                <th className="p-3">Cash Handled</th>
                <th className="p-3">M-Pesa Handled</th>
                <th className="p-3">Total Volume</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {cashierStats.map((cs) => (
                <tr key={cs.name} className="hover:bg-stone-50/60">
                  <td className="p-3 font-semibold text-stone-900">{cs.name}</td>
                  <td className="p-3 font-mono">{cs.count} orders</td>
                  <td className="p-3 font-mono text-emerald-700">{formatKes(cs.cash)}</td>
                  <td className="p-3 font-mono text-green-700">{formatKes(cs.mpesa)}</td>
                  <td className="p-3 font-bold font-mono text-[#0e6b5c]">{formatKes(cs.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs mb-6 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-[260px] border border-stone-300 rounded px-3 py-2 bg-stone-50">
          <FaSearch className="text-stone-400" />
          <input
            type="text"
            placeholder="Search receipt #, cashier, customer, M-Pesa code…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-sm focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs text-stone-500 font-semibold uppercase flex items-center gap-1">
            Cashier:
            <select
              value={selectedCashier}
              onChange={(e) => setSelectedCashier(e.target.value)}
              className="border border-stone-300 rounded px-2.5 py-1.5 text-xs bg-white text-stone-700 font-normal"
            >
              <option value="ALL">All Cashiers</option>
              {cashiers.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-stone-500 font-semibold uppercase flex items-center gap-1">
            Payment:
            <select
              value={selectedMethod}
              onChange={(e) => setSelectedMethod(e.target.value)}
              className="border border-stone-300 rounded px-2.5 py-1.5 text-xs bg-white text-stone-700 font-normal"
            >
              <option value="ALL">All Methods</option>
              <option value="CASH">Cash</option>
              <option value="MPESA">M-Pesa</option>
            </select>
          </label>
        </div>
      </div>

      {/* Sales Ledger Table */}
      <section className="checkout-panel overflow-x-auto p-0">
        <div className="p-6 border-b border-stone-100 flex justify-between items-center">
          <h2 className="text-xl font-serif">Transactions Ledger ({filteredSales.length})</h2>
        </div>

        <table className="w-full text-left text-sm">
          <thead className="border-b border-stone-200 text-xs font-semibold text-stone-600 bg-stone-50">
            <tr>
              <th className="px-6 py-3.5">Receipt #</th>
              <th className="px-6 py-3.5">Date / Time</th>
              <th className="px-6 py-3.5">Cashier</th>
              <th className="px-6 py-3.5">Items</th>
              <th className="px-6 py-3.5">Method</th>
              <th className="px-6 py-3.5 text-right">Total</th>
              <th className="px-6 py-3.5 text-center">Receipt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {filteredSales.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-stone-500">
                  No POS sales records found matching your filters.
                </td>
              </tr>
            ) : (
              filteredSales.map((s) => (
                <tr key={s.id} className="hover:bg-stone-50/70 transition-colors">
                  <td className="px-6 py-4 font-mono font-bold text-xs text-[#0e6b5c]">
                    {s.saleNumber}
                  </td>
                  <td className="px-6 py-4 text-xs text-stone-600 whitespace-nowrap">
                    {new Date(s.createdAt).toLocaleDateString('en-GB', {
                      timeZone: 'Africa/Nairobi',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}{' '}
                    <span className="text-stone-400">
                      {new Date(s.createdAt).toLocaleTimeString([], {
                        timeZone: 'Africa/Nairobi',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs font-medium text-stone-900">{s.cashierName}</td>
                  <td className="px-6 py-4 text-xs text-stone-600 max-w-xs truncate">
                    {s.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                        s.paymentMethod === 'CASH'
                          ? 'bg-emerald-100 text-emerald-800'
                          : s.paymentMethod === 'MPESA'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {s.paymentMethod}
                    </span>
                    {s.mpesaCode && (
                      <span className="block text-[10px] text-stone-400 font-mono mt-0.5">
                        Ref: {s.mpesaCode}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-stone-900 text-right whitespace-nowrap">
                    {formatKes(s.total)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => setActiveReceipt(s)}
                      className="inline-flex items-center gap-1.5 text-xs text-[#0e6b5c] hover:underline"
                    >
                      <FaReceipt /> View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {/* Printable Receipt Modal */}
      {activeReceipt && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-stone-200 max-w-md w-full p-6 animate-in fade-in zoom-in duration-150">
            <div id="receipt-print-area" className="font-mono text-xs text-stone-800">
              {/* Header */}
              <div className="text-center pb-4 border-b border-dashed border-stone-300">
                <h3 className="font-serif text-xl font-bold text-stone-900 tracking-tight">
                  {BRAND.name.toUpperCase()}
                </h3>
                <p className="text-[11px] text-stone-500 mt-1">{BRAND.licence}</p>
                <p className="text-[10px] text-stone-400 mt-0.5">WhatsApp: {WHATSAPP_NUMBER}</p>
              </div>

              {/* Meta */}
              <div className="py-3 border-b border-dashed border-stone-300 space-y-1">
                <div className="flex justify-between">
                  <span className="text-stone-500">Receipt #:</span>
                  <span className="font-bold">{activeReceipt.saleNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Date/Time:</span>
                  <span>{new Date(activeReceipt.createdAt).toLocaleString('en-GB', { timeZone: 'Africa/Nairobi' })} EAT</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Cashier:</span>
                  <span>{activeReceipt.cashierName}</span>
                </div>
                {activeReceipt.customerName && (
                  <div className="flex justify-between">
                    <span className="text-stone-500">Customer:</span>
                    <span>{activeReceipt.customerName}</span>
                  </div>
                )}
              </div>

              {/* Line Items */}
              <div className="py-3 border-b border-dashed border-stone-300 space-y-2">
                {activeReceipt.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between">
                    <div className="max-w-[70%]">
                      <p className="font-medium text-stone-900">{item.name}</p>
                      <p className="text-[10px] text-stone-500">
                        {item.quantity} x {formatKes(item.price)}
                      </p>
                    </div>
                    <span className="font-semibold">{formatKes(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="py-3 border-b border-dashed border-stone-300 space-y-1">
                <div className="flex justify-between text-stone-600">
                  <span>Subtotal:</span>
                  <span>{formatKes(activeReceipt.subtotal)}</span>
                </div>
                {activeReceipt.discount > 0 && (
                  <div className="flex justify-between text-red-700">
                    <span>Discount:</span>
                    <span>-{formatKes(activeReceipt.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-stone-900 pt-1">
                  <span>TOTAL:</span>
                  <span>{formatKes(activeReceipt.total)}</span>
                </div>
              </div>

              {/* Payment Details */}
              <div className="py-3 border-b border-dashed border-stone-300 space-y-1">
                <div className="flex justify-between">
                  <span className="text-stone-500">Payment Method:</span>
                  <span className="font-bold">{activeReceipt.paymentMethod}</span>
                </div>
                {activeReceipt.paymentMethod === 'CASH' && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-stone-500">Amount Tendered:</span>
                      <span>{formatKes(activeReceipt.amountPaid)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-emerald-800">
                      <span>Change Given:</span>
                      <span>{formatKes(activeReceipt.changeDue)}</span>
                    </div>
                  </>
                )}
                {activeReceipt.mpesaCode && (
                  <div className="flex justify-between">
                    <span className="text-stone-500">M-Pesa Reference:</span>
                    <span className="font-mono">{activeReceipt.mpesaCode}</span>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="text-center pt-4 text-stone-500 text-[11px] leading-5">
                <p className="font-medium">Thank you. Get well soon!</p>
                <p className="text-[10px] text-stone-400">Keep medicines out of reach of children.</p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-3 pt-5 mt-4 border-t border-stone-100 no-print">
              <button
                type="button"
                onClick={() => setActiveReceipt(null)}
                className="px-4 py-2 border border-stone-300 text-stone-700 rounded text-sm hover:bg-stone-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={printReceipt}
                className="shop-button text-sm py-2 px-4 flex items-center gap-2"
              >
                <FaPrint /> Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
