
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Landmark, FileText, Plus, Trash2, Save, Printer, ArrowRight, ArrowUpRight, ArrowDownRight, Wallet, Building2, Search, Filter, RefreshCw, X, ArrowLeftRight, Download, Calendar, PieChart, BookOpen, Receipt, Hash, CheckCircle, Lock, Mail, Clock } from 'lucide-react';
import { InventoryItem, Godown, Ledger, Voucher } from '../types';
import { getAllItems, getAllGodowns, getAllLedgers, saveLedger, getAllVouchers, saveVoucher, getBusinessProfile } from '../utils/db';
import { useAuth } from '../contexts/AuthContext';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// Define Props Interface
interface CashBankBookProps {
    category: 'Cash' | 'Bank';
}

export const AccountingModule = () => {
  const [activeTab, setActiveTab] = useState<'invoice' | 'cash' | 'bank' | 'ledgers' | 'statements' | 'aging' | 'reports'>('invoice');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [godowns, setGodowns] = useState<Godown[]>([]);
  
  useEffect(() => {
    getAllItems().then(setItems);
    getAllGodowns().then(setGodowns);
  }, []);

  const MENU_ITEMS = [
    { id: 'invoice', label: 'Sales Invoice', icon: Receipt },
    { id: 'cash', label: 'Cash Book', icon: Wallet },
    { id: 'bank', label: 'Bank Book', icon: Landmark },
    { id: 'ledgers', label: 'Ledger Master', icon: BookOpen },
    { id: 'statements', label: 'Ledger Statements', icon: FileText },
    { id: 'aging', label: 'Aging Analysis', icon: Clock },
    { id: 'reports', label: 'Final Accounts', icon: PieChart },
  ];

  return (
    <div className="space-y-6 animate-fade-in max-w-full">
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex flex-col gap-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Landmark className="w-7 h-7 text-blue-700" />
                Accounting & Invoicing
              </h1>
              <p className="text-gray-500 mt-1">Manage GST invoices, cash flow, bank transactions, and ledgers.</p>
            </div>

            <div className="border-b border-gray-200 overflow-x-auto">
                <nav className="-mb-px flex space-x-8 min-w-max" aria-label="Tabs">
                    {MENU_ITEMS.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id as any)}
                                className={`
                                    group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-all
                                    ${isActive
                                        ? 'border-blue-600 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }
                                `}
                            >
                                <Icon className={`
                                    -ml-0.5 mr-2 h-5 w-5
                                    ${isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-500'}
                                `} />
                                {item.label}
                            </button>
                        );
                    })}
                </nav>
            </div>
        </div>
      </div>

      <div className="min-h-[500px]">
        {activeTab === 'invoice' && <InvoiceGenerator items={items} godowns={godowns} />}
        {activeTab === 'cash' && <CashBankBook category="Cash" />}
        {activeTab === 'bank' && <CashBankBook category="Bank" />}
        {activeTab === 'ledgers' && <LedgerManager />}
        {activeTab === 'statements' && <StatementGenerator />}
        {activeTab === 'aging' && <AgingReport />}
        {activeTab === 'reports' && <FinancialReports />}
      </div>
    </div>
  );
};

const StatementGenerator = () => {
    const [ledgers, setLedgers] = useState<Ledger[]>([]);
    const [selectedLedgerId, setSelectedLedgerId] = useState<string>('');
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [reportData, setReportData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [businessProfile, setBusinessProfile] = useState<any>(null);
    const reportRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        getAllLedgers().then(l => setLedgers(l.sort((a,b) => a.name.localeCompare(b.name))));
        getBusinessProfile().then(setBusinessProfile);
    }, []);

    const generateStatement = async () => {
        if(!selectedLedgerId) return;
        setLoading(true);
        
        const ledger = ledgers.find(l => l.id === Number(selectedLedgerId));
        const vouchers = await getAllVouchers();
        
        if(!ledger) return;

        // Initial Balance from Master (Asset/Expense = Dr(+), Liability/Income = Cr(-))
        let balance = ledger.openingBalanceType === 'Dr' ? (ledger.openingBalance || 0) : -(ledger.openingBalance || 0);

        // Helper to calculate effect of a voucher on this ledger
        const calculateChange = (v: Voucher) => {
            let change = 0;
            // Party Logic (Primary Ledger)
            if (v.partyLedgerId === ledger.id) {
                // Debits
                if (v.type === 'Sales') change += v.totalAmount;
                if (v.type === 'Payment') change += v.totalAmount; // We paid Party (Dr Receiver)
                
                // Credits
                if (v.type === 'Purchase') change -= v.totalAmount;
                if (v.type === 'Receipt') change -= v.totalAmount; // Received from Party (Cr Giver)
                if (v.type === 'Contra') change -= v.totalAmount; // Source (Cr)
            }
            // Item Logic (Secondary Ledgers)
            v.items.forEach(item => {
                if (item.itemId === ledger.id) {
                    // Sales Item: Credit (Income)
                    if (v.type === 'Sales') change -= item.amount; 
                    
                    // Purchase Item: Debit (Expense/Asset)
                    if (v.type === 'Purchase') change += item.amount;

                    // Receipt Item (Cash/Bank receiving): Debit
                    if (v.type === 'Receipt') change += item.amount;

                    // Payment Item (Cash/Bank paying): Credit
                    if (v.type === 'Payment') change -= item.amount;

                    // Contra Item (Target receiving): Debit
                    if (v.type === 'Contra') change += item.amount;
                }
            });
            return change;
        };

        // 1. Process Previous Vouchers (Before Start Date)
        const prevVouchers = vouchers.filter(v => new Date(v.date) < new Date(startDate));
        prevVouchers.forEach(v => {
            balance += calculateChange(v);
        });

        const periodOpening = balance;

        // 2. Process Current Period Vouchers
        const currentVouchers = vouchers.filter(v => 
            new Date(v.date) >= new Date(startDate) && 
            new Date(v.date) <= new Date(endDate)
        ).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const lines = currentVouchers.map(v => {
            const change = calculateChange(v);
            balance += change;
            
            return {
                id: v.id,
                date: v.date,
                ref: v.referenceNo || `VCH-${v.id}`,
                type: v.type,
                narration: v.narration,
                debit: change > 0 ? change : 0,
                credit: change < 0 ? Math.abs(change) : 0,
                balance
            };
        });

        setReportData({
            ledger,
            periodOpening,
            lines,
            periodClosing: balance
        });
        setLoading(false);
    };

    const downloadPDF = async () => {
        if(!reportRef.current || !reportData) return;
        try {
            const canvas = await html2canvas(reportRef.current, { scale: 2, backgroundColor: '#ffffff' });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgWidth = 210;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
            pdf.save(`${reportData.ledger.name}_Statement.pdf`);
        } catch(e) {
            console.error(e);
            alert("Export failed");
        }
    };

    const formatMoney = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
            <div className="lg:col-span-1 bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-fit">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center">
                    <Filter className="w-5 h-5 mr-2 text-blue-600" /> Report Criteria
                </h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Select Ledger</label>
                        <select className="w-full border rounded-lg p-2.5 text-sm" value={selectedLedgerId} onChange={e => setSelectedLedgerId(e.target.value)}>
                            <option value="">-- Select Account --</option>
                            {ledgers.map(l => <option key={l.id} value={l.id}>{l.name} ({l.group})</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
                        <input type="date" className="w-full border rounded-lg p-2 text-sm" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                        <input type="date" className="w-full border rounded-lg p-2 text-sm" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    </div>
                    <button onClick={generateStatement} disabled={!selectedLedgerId || loading} className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 shadow-sm disabled:opacity-50">
                        {loading ? 'Generating...' : 'View Statement'}
                    </button>
                </div>
            </div>

            <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                {reportData ? (
                    <>
                        <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                            <h3 className="font-bold text-gray-900">Statement Preview</h3>
                            <button onClick={downloadPDF} className="flex items-center text-sm bg-white border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50 text-gray-700">
                                <Download className="w-4 h-4 mr-2" /> PDF
                            </button>
                        </div>
                        <div className="overflow-auto bg-gray-100 p-4 max-h-[600px]">
                            <div ref={reportRef} className="bg-white p-8 max-w-3xl mx-auto shadow-sm min-h-[800px] text-gray-900">
                                {/* Header */}
                                <div className="text-center border-b-2 border-gray-100 pb-6 mb-6">
                                    <h2 className="text-xl font-bold uppercase">{businessProfile?.companyName || 'Company Name'}</h2>
                                    <p className="text-sm text-gray-500">{businessProfile?.city}, {businessProfile?.state}</p>
                                    <h3 className="text-lg font-bold mt-4 text-blue-800">Ledger Statement</h3>
                                    <p className="text-sm font-medium mt-1">{reportData.ledger.name}</p>
                                    <p className="text-xs text-gray-500 mt-1">Period: {new Date(startDate).toLocaleDateString()} to {new Date(endDate).toLocaleDateString()}</p>
                                </div>

                                <div className="flex justify-end mb-4">
                                    <div className="text-right text-sm">
                                        <span className="text-gray-500 mr-2">Opening Balance:</span>
                                        <span className="font-bold">{formatMoney(Math.abs(reportData.periodOpening))} {reportData.periodOpening >= 0 ? 'Dr' : 'Cr'}</span>
                                    </div>
                                </div>

                                <table className="w-full text-sm border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50 border-y border-gray-200">
                                            <th className="py-2 px-2 text-left w-24">Date</th>
                                            <th className="py-2 px-2 text-left">Particulars</th>
                                            <th className="py-2 px-2 text-left w-20">Type</th>
                                            <th className="py-2 px-2 text-right w-24">Debit</th>
                                            <th className="py-2 px-2 text-right w-24">Credit</th>
                                            <th className="py-2 px-2 text-right w-28 bg-blue-50/50">Balance</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {reportData.lines.map((line: any, i: number) => (
                                            <tr key={i} className="hover:bg-gray-50">
                                                <td className="py-2 px-2 text-gray-600 whitespace-nowrap">{new Date(line.date).toLocaleDateString()}</td>
                                                <td className="py-2 px-2">
                                                    <div className="font-medium text-gray-900">{line.narration || line.ref}</div>
                                                </td>
                                                <td className="py-2 px-2 text-xs uppercase text-gray-500">{line.type}</td>
                                                <td className="py-2 px-2 text-right text-gray-700">{line.debit ? formatMoney(line.debit) : ''}</td>
                                                <td className="py-2 px-2 text-right text-gray-700">{line.credit ? formatMoney(line.credit) : ''}</td>
                                                <td className="py-2 px-2 text-right font-medium bg-blue-50/30">
                                                    {formatMoney(Math.abs(line.balance))} {line.balance >= 0 ? 'Dr' : 'Cr'}
                                                </td>
                                            </tr>
                                        ))}
                                        {reportData.lines.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="py-8 text-center text-gray-400 italic">No transactions in selected period.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                    <tfoot>
                                        <tr className="border-t-2 border-gray-200">
                                            <td colSpan={3} className="py-3 px-2 text-right font-bold text-gray-700">Total / Closing</td>
                                            <td className="py-3 px-2 text-right font-bold">{formatMoney(reportData.lines.reduce((a:any,b:any)=>a+b.debit, 0))}</td>
                                            <td className="py-3 px-2 text-right font-bold">{formatMoney(reportData.lines.reduce((a:any,b:any)=>a+b.credit, 0))}</td>
                                            <td className="py-3 px-2 text-right font-bold text-blue-800 bg-blue-50">
                                                {formatMoney(Math.abs(reportData.periodClosing))} {reportData.periodClosing >= 0 ? 'Dr' : 'Cr'}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                                
                                <div className="mt-8 pt-8 border-t border-gray-100 text-center text-xs text-gray-400">
                                    Generated by TaxAnalyst ERP on {new Date().toLocaleString()}
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8">
                        <FileText className="w-16 h-16 mb-4 text-gray-200" />
                        <p>Select a ledger and date range to generate statement.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const AgingReport = () => {
    const [reportType, setReportType] = useState<'Receivables' | 'Payables'>('Receivables');
    const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
    const [reportData, setReportData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const reportRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        generateReport();
    }, [reportType, asOfDate]);

    const generateReport = async () => {
        setLoading(true);
        const [allLedgers, allVouchers] = await Promise.all([getAllLedgers(), getAllVouchers()]);
        
        const targetGroup = reportType === 'Receivables' ? 'Sundry Debtors' : 'Sundry Creditors';
        const targetLedgers = allLedgers.filter(l => l.group === targetGroup);
        const asOfTime = new Date(asOfDate).getTime();

        const results = targetLedgers.map(ledger => {
            // 1. Calculate Closing Balance As Of Date
            let balance = ledger.openingBalanceType === (reportType === 'Receivables' ? 'Dr' : 'Cr') 
                ? (ledger.openingBalance || 0) 
                : -(ledger.openingBalance || 0);

            // Filter vouchers up to As Of Date
            const periodVouchers = allVouchers.filter(v => new Date(v.date) <= new Date(asOfDate));

            periodVouchers.forEach(v => {
                // Determine effect on balance
                let amount = 0;
                // Primary Party
                if (v.partyLedgerId === ledger.id) {
                    if (['Sales', 'Payment'].includes(v.type)) amount += v.totalAmount; // Dr effect
                    if (['Purchase', 'Receipt'].includes(v.type)) amount -= v.totalAmount; // Cr effect
                }
                // Item/Contra
                v.items.forEach(item => {
                    if (item.itemId === ledger.id) {
                        if (['Purchase', 'Payment'].includes(v.type)) amount += item.amount;
                        if (['Sales', 'Receipt'].includes(v.type)) amount -= item.amount;
                    }
                });

                // Adjust balance based on report type perspective
                if (reportType === 'Receivables') {
                    balance += amount; 
                } else {
                    balance -= amount; // Invert logic for Payables
                }
            });

            if (balance <= 0) return null; // Only show outstanding

            // 2. FIFO Aging Logic
            const billTypes = reportType === 'Receivables' ? ['Sales', 'Journal'] : ['Purchase', 'Journal'];
            
            const bills = periodVouchers
                .filter(v => billTypes.includes(v.type) && (v.partyLedgerId === ledger.id || v.items.some(i => i.itemId === ledger.id)))
                .map(v => {
                    let amt = v.partyLedgerId === ledger.id ? v.totalAmount : v.items.find(i => i.itemId === ledger.id)?.amount || 0;
                    return { date: v.date, amount: amt };
                })
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            let remainingToMatch = balance;
            const buckets = { '0-30': 0, '31-60': 0, '61-90': 0, '>90': 0 };

            for (const bill of bills) {
                if (remainingToMatch <= 0) break;
                
                const matched = Math.min(remainingToMatch, bill.amount);
                const billTime = new Date(bill.date).getTime();
                const diffDays = Math.floor((asOfTime - billTime) / (1000 * 3600 * 24));

                if (diffDays <= 30) buckets['0-30'] += matched;
                else if (diffDays <= 60) buckets['31-60'] += matched;
                else if (diffDays <= 90) buckets['61-90'] += matched;
                else buckets['>90'] += matched;

                remainingToMatch -= matched;
            }

            if (remainingToMatch > 0) {
                buckets['>90'] += remainingToMatch;
            }

            return {
                name: ledger.name,
                totalDue: balance,
                buckets
            };
        }).filter(Boolean);

        setReportData(results);
        setLoading(false);
    };

    const downloadPDF = async () => {
        if(!reportRef.current) return;
        const canvas = await html2canvas(reportRef.current, { scale: 2, backgroundColor: '#ffffff' });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgWidth = 210;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
        pdf.save(`${reportType}_Aging_${asOfDate}.pdf`);
    };

    const formatMoney = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm gap-4">
                <div className="flex items-center gap-4">
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        <button 
                            onClick={() => setReportType('Receivables')}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${reportType === 'Receivables' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
                        >
                            Receivables (Debtors)
                        </button>
                        <button 
                            onClick={() => setReportType('Payables')}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${reportType === 'Payables' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500'}`}
                        >
                            Payables (Vendors)
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">As Of:</span>
                        <input type="date" value={asOfDate} onChange={e => setAsOfDate(e.target.value)} className="border rounded-lg p-2 text-sm" />
                    </div>
                </div>
                <button onClick={downloadPDF} className="flex items-center px-4 py-2 bg-gray-800 text-white rounded-lg text-sm hover:bg-gray-900">
                    <Download className="w-4 h-4 mr-2" /> PDF Export
                </button>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden p-8 flex justify-center bg-gray-50/50">
                <div ref={reportRef} className="bg-white p-8 w-full max-w-5xl shadow-sm text-gray-900 border border-gray-100">
                    <div className="text-center mb-8 border-b-2 border-gray-800 pb-4">
                        <h2 className="text-2xl font-bold uppercase tracking-wide">Aging Analysis Report</h2>
                        <p className="text-gray-500 text-sm mt-1">{reportType} as on {new Date(asOfDate).toLocaleDateString()}</p>
                    </div>

                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="bg-gray-100 text-gray-700">
                                <th className="py-3 px-4 text-left font-bold border-b border-gray-300">Party Name</th>
                                <th className="py-3 px-4 text-right font-bold border-b border-gray-300 w-32">Total Due</th>
                                <th className="py-3 px-4 text-right font-medium border-b border-gray-300 w-24 text-gray-500">0-30 Days</th>
                                <th className="py-3 px-4 text-right font-medium border-b border-gray-300 w-24 text-gray-500">31-60 Days</th>
                                <th className="py-3 px-4 text-right font-medium border-b border-gray-300 w-24 text-gray-500">61-90 Days</th>
                                <th className="py-3 px-4 text-right font-bold border-b border-gray-300 w-24 text-red-600">&gt; 90 Days</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan={6} className="py-8 text-center">Loading...</td></tr>
                            ) : reportData.length === 0 ? (
                                <tr><td colSpan={6} className="py-8 text-center text-gray-400 italic">No outstanding {reportType.toLowerCase()} found.</td></tr>
                            ) : (
                                reportData.map((row, i) => (
                                    <tr key={i} className="hover:bg-gray-50">
                                        <td className="py-3 px-4 font-medium text-gray-800">{row.name}</td>
                                        <td className="py-3 px-4 text-right font-bold">{formatMoney(row.totalDue)}</td>
                                        <td className="py-3 px-4 text-right">{row.buckets['0-30'] ? formatMoney(row.buckets['0-30']) : '-'}</td>
                                        <td className="py-3 px-4 text-right">{row.buckets['31-60'] ? formatMoney(row.buckets['31-60']) : '-'}</td>
                                        <td className="py-3 px-4 text-right text-orange-600">{row.buckets['61-90'] ? formatMoney(row.buckets['61-90']) : '-'}</td>
                                        <td className="py-3 px-4 text-right font-bold text-red-600">{row.buckets['>90'] ? formatMoney(row.buckets['>90']) : '-'}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        <tfoot>
                            <tr className="bg-gray-50 font-bold border-t-2 border-gray-300">
                                <td className="py-3 px-4 text-right">Grand Total</td>
                                <td className="py-3 px-4 text-right">{formatMoney(reportData.reduce((a,b)=>a+b.totalDue, 0))}</td>
                                <td className="py-3 px-4 text-right">{formatMoney(reportData.reduce((a,b)=>a+b.buckets['0-30'], 0))}</td>
                                <td className="py-3 px-4 text-right">{formatMoney(reportData.reduce((a,b)=>a+b.buckets['31-60'], 0))}</td>
                                <td className="py-3 px-4 text-right">{formatMoney(reportData.reduce((a,b)=>a+b.buckets['61-90'], 0))}</td>
                                <td className="py-3 px-4 text-right text-red-700">{formatMoney(reportData.reduce((a,b)=>a+b.buckets['>90'], 0))}</td>
                            </tr>
                        </tfoot>
                    </table>
                    <div className="mt-8 text-center text-xs text-gray-400">
                        Generated via TaxAnalyst ERP
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Financial Reports ---
const FinancialReports = () => {
    const [reportType, setReportType] = useState<'tb' | 'pl' | 'bs'>('tb');
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [data, setData] = useState<any[]>([]);
    const [totals, setTotals] = useState({ dr: 0, cr: 0 });
    const [loading, setLoading] = useState(false);
    const [businessProfile, setBusinessProfile] = useState<any>(null);
    const [closingStock, setClosingStock] = useState(0);
    const reportRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadData();
    }, [endDate, reportType]);

    const loadData = async () => {
        setLoading(true);
        const [ledgers, vouchers, items, profile] = await Promise.all([
            getAllLedgers(), 
            getAllVouchers(),
            getAllItems(),
            getBusinessProfile()
        ]);
        setBusinessProfile(profile);

        // Calculate Closing Stock
        const stockVal = items.reduce((acc, item) => {
            const qty = Object.values(item.stock).reduce((a: number, b: number) => a + b, 0);
            return acc + (qty * item.purchasePrice);
        }, 0);
        setClosingStock(stockVal);

        // Calculate Ledger Balances
        const balances = ledgers.map(l => {
            let bal = l.openingBalanceType === 'Dr' ? (l.openingBalance || 0) : -(l.openingBalance || 0);
            
            // Only consider vouchers up to end date
            const relevantVouchers = vouchers.filter(v => new Date(v.date) <= new Date(endDate));

            relevantVouchers.forEach(v => {
                if (v.partyLedgerId === l.id) {
                    if (['Sales', 'Payment'].includes(v.type)) bal += v.totalAmount;
                    if (['Purchase', 'Receipt'].includes(v.type)) bal -= v.totalAmount;
                    if (v.type === 'Contra') bal -= v.totalAmount; 
                }
                v.items.forEach(i => {
                    if (i.itemId === l.id) {
                        if (['Purchase', 'Payment'].includes(v.type)) bal += i.amount;
                        if (['Sales', 'Receipt'].includes(v.type)) bal -= i.amount;
                        if (v.type === 'Contra') bal += i.amount;
                    }
                });
            });
            return { ...l, balance: bal };
        }).filter(l => Math.abs(l.balance) > 0.01);

        if (reportType === 'tb') {
            const tbData = balances.map(l => ({
                name: l.name,
                group: l.group,
                debit: l.balance > 0 ? l.balance : 0,
                credit: l.balance < 0 ? Math.abs(l.balance) : 0
            }));
            const totalDr = tbData.reduce((a,b) => a + b.debit, 0);
            const totalCr = tbData.reduce((a,b) => a + b.credit, 0);
            setData(tbData.sort((a,b) => a.name.localeCompare(b.name)));
            setTotals({ dr: totalDr, cr: totalCr });
        } 
        else if (reportType === 'pl') {
            // Profit & Loss
            const incomeGroups = ['Sales Accounts', 'Direct Incomes', 'Indirect Incomes'];
            const expenseGroups = ['Purchase Accounts', 'Direct Expenses', 'Indirect Expenses'];
            
            const income = balances.filter(l => incomeGroups.includes(l.group));
            const expense = balances.filter(l => expenseGroups.includes(l.group));
            
            const totalIncome = income.reduce((a,b) => a + Math.abs(b.balance), 0); // Usually Credit
            const totalExpense = expense.reduce((a,b) => a + Math.abs(b.balance), 0); // Usually Debit
            
            // Net Profit
            const netProfit = (totalIncome + stockVal) - totalExpense;

            setData([
                { section: 'Income', items: income, total: totalIncome },
                { section: 'Expenses', items: expense, total: totalExpense },
                { section: 'Closing Stock', items: [{ name: 'Closing Stock', balance: stockVal }], total: stockVal }
            ]);
            setTotals({ dr: totalExpense, cr: totalIncome + stockVal }); 
        }
        else if (reportType === 'bs') {
            // Balance Sheet
            const incomeGroups = ['Sales Accounts', 'Direct Incomes', 'Indirect Incomes'];
            const expenseGroups = ['Purchase Accounts', 'Direct Expenses', 'Indirect Expenses'];
            const incomeVal = balances.filter(l => incomeGroups.includes(l.group)).reduce((a,b) => a + Math.abs(b.balance), 0);
            const expenseVal = balances.filter(l => expenseGroups.includes(l.group)).reduce((a,b) => a + Math.abs(b.balance), 0);
            const netProfit = (incomeVal + stockVal) - expenseVal;

            const liabilityGroups = ['Capital Account', 'Loans (Liability)', 'Current Liabilities', 'Suspense A/c', 'Sundry Creditors'];
            const assetGroups = ['Fixed Assets', 'Current Assets', 'Investments', 'Loans & Advances (Asset)', 'Sundry Debtors', 'Cash-in-Hand', 'Bank Accounts'];

            const liabilities = balances.filter(l => liabilityGroups.includes(l.group));
            const assets = balances.filter(l => assetGroups.includes(l.group));

            // Add Net Profit to Liabilities (Reserves) or Capital
            const liabilitiesWithProfit = [...liabilities, { name: 'Net Profit / (Loss)', balance: -netProfit }]; 
            const assetsWithStock = [...assets, { name: 'Closing Stock', balance: stockVal }]; 

            setData([
                { section: 'Liabilities', items: liabilitiesWithProfit, total: liabilitiesWithProfit.reduce((a,b) => a + Math.abs(b.balance), 0) },
                { section: 'Assets', items: assetsWithStock, total: assetsWithStock.reduce((a,b) => a + Math.abs(b.balance), 0) }
            ]);
        }

        setLoading(false);
    };

    const downloadPDF = async () => {
        if(!reportRef.current) return;
        const canvas = await html2canvas(reportRef.current, { scale: 2, backgroundColor: '#ffffff' });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgWidth = 210;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
        pdf.save(`${reportType.toUpperCase()}_${endDate}.pdf`);
    };

    const formatMoney = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex gap-4 items-center">
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        <button onClick={() => setReportType('tb')} className={`px-4 py-2 text-sm font-medium rounded-md ${reportType==='tb'?'bg-white shadow text-blue-600':'text-gray-600'}`}>Trial Balance</button>
                        <button onClick={() => setReportType('pl')} className={`px-4 py-2 text-sm font-medium rounded-md ${reportType==='pl'?'bg-white shadow text-blue-600':'text-gray-600'}`}>P & L A/c</button>
                        <button onClick={() => setReportType('bs')} className={`px-4 py-2 text-sm font-medium rounded-md ${reportType==='bs'?'bg-white shadow text-blue-600':'text-gray-600'}`}>Balance Sheet</button>
                    </div>
                    <input type="date" className="border rounded-lg p-2 text-sm" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
                <button onClick={downloadPDF} className="flex items-center px-4 py-2 bg-gray-800 text-white rounded-lg text-sm hover:bg-gray-900"><Download className="w-4 h-4 mr-2" /> Export</button>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden p-8 flex justify-center bg-gray-50/50">
                <div ref={reportRef} className="bg-white p-12 w-full max-w-4xl shadow-lg text-gray-900 min-h-[800px]">
                    <div className="text-center mb-8 pb-4 border-b-2 border-gray-800">
                        <h2 className="text-2xl font-bold uppercase">{businessProfile?.companyName || 'Company Name'}</h2>
                        <h3 className="text-lg font-semibold mt-1">
                            {reportType === 'tb' ? 'Trial Balance' : reportType === 'pl' ? 'Profit & Loss A/c' : 'Balance Sheet'}
                        </h3>
                        <p className="text-sm text-gray-500">As at {new Date(endDate).toLocaleDateString()}</p>
                    </div>

                    {loading ? <div className="text-center py-10">Loading...</div> : (
                        <>
                            {reportType === 'tb' && (
                                <table className="w-full text-sm border-collapse">
                                    <thead>
                                        <tr className="border-b-2 border-gray-800">
                                            <th className="text-left py-2">Particulars</th>
                                            <th className="text-right py-2 w-32">Debit</th>
                                            <th className="text-right py-2 w-32">Credit</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.map((row: any, i: number) => (
                                            <tr key={i} className="border-b border-gray-100">
                                                <td className="py-2">{row.name}</td>
                                                <td className="py-2 text-right">{row.debit ? formatMoney(row.debit) : ''}</td>
                                                <td className="py-2 text-right">{row.credit ? formatMoney(row.credit) : ''}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="font-bold border-t-2 border-gray-800">
                                            <td className="py-2">Total</td>
                                            <td className="py-2 text-right">{formatMoney(totals.dr)}</td>
                                            <td className="py-2 text-right">{formatMoney(totals.cr)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            )}

                            {(reportType === 'pl' || reportType === 'bs') && (
                                <div className="flex gap-8">
                                    {data.map((section: any, idx: number) => (
                                        <div key={idx} className="flex-1">
                                            <h4 className="font-bold border-b-2 border-gray-400 pb-2 mb-2 uppercase text-sm">{section.section}</h4>
                                            <table className="w-full text-sm">
                                                <tbody>
                                                    {section.items && section.items.map((item: any, i: number) => (
                                                        <tr key={i} className="border-b border-gray-100">
                                                            <td className="py-2">{item.name}</td>
                                                            <td className="py-2 text-right">{formatMoney(Math.abs(item.balance))}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                                <tfoot>
                                                    <tr className="font-bold border-t-2 border-gray-400">
                                                        <td className="py-2">Total</td>
                                                        <td className="py-2 text-right">{formatMoney(section.total)}</td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

// ... [LedgerManager, InvoiceGenerator, CashBankBook components remain unchanged] ...
const InvoiceGenerator = ({ items, godowns }: { items: InventoryItem[], godowns: Godown[] }) => {
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [formData, setFormData] = useState({
      date: new Date().toISOString().split('T')[0],
      partyLedgerId: '',
      referenceNo: '',
      narration: '',
  });
  const [lines, setLines] = useState<any[]>([]);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
      getAllLedgers().then(l => setLedgers(l.filter(x => ['Sundry Debtors', 'Cash-in-Hand', 'Bank Accounts'].includes(x.group))));
  }, []);

  const addLine = () => {
      setLines([...lines, { itemId: '', quantity: 1, rate: 0, amount: 0 }]);
  };

  const updateLine = (index: number, field: string, value: any) => {
      const newLines = [...lines];
      newLines[index][field] = value;
      
      if (field === 'itemId') {
          const item = items.find(i => i.id === Number(value));
          if (item) {
              newLines[index].rate = item.sellingPrice;
              newLines[index].itemName = item.name;
          }
      }

      if (field === 'quantity' || field === 'rate' || field === 'itemId') {
           const qty = Number(newLines[index].quantity);
           const rate = Number(newLines[index].rate);
           newLines[index].amount = qty * rate;
      }
      setLines(newLines);
  };

  const removeLine = (index: number) => {
      const newLines = lines.filter((_, i) => i !== index);
      setLines(newLines);
  };

  const calculateTotal = () => lines.reduce((acc, curr) => acc + (curr.amount || 0), 0);

  const handleSave = async () => {
      if (!formData.partyLedgerId || lines.length === 0) {
          alert("Please select a customer and add items.");
          return;
      }

      const voucher: Voucher = {
          type: 'Sales',
          date: formData.date,
          referenceNo: formData.referenceNo,
          partyLedgerId: Number(formData.partyLedgerId),
          items: lines.map(l => ({
              itemId: Number(l.itemId),
              itemName: items.find(i => i.id === Number(l.itemId))?.name || 'Unknown',
              quantity: Number(l.quantity),
              rate: Number(l.rate),
              amount: Number(l.amount),
              gstRate: 0, igst: 0, cgst: 0, sgst: 0
          })),
          totalAmount: calculateTotal(),
          totalTax: 0,
          narration: formData.narration
      };

      await saveVoucher(voucher);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      
      setFormData({ ...formData, referenceNo: '', narration: '' });
      setLines([]);
  };

  return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 relative">
           <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-blue-600" /> New Sales Invoice
           </h3>
           
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
               <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Customer / Party</label>
                   <select 
                      className="w-full border rounded-lg p-2 text-sm"
                      value={formData.partyLedgerId}
                      onChange={e => setFormData({...formData, partyLedgerId: e.target.value})}
                   >
                       <option value="">Select Customer...</option>
                       {ledgers.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                   </select>
               </div>
               <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Date</label>
                   <input 
                      type="date" 
                      className="w-full border rounded-lg p-2 text-sm"
                      value={formData.date}
                      onChange={e => setFormData({...formData, date: e.target.value})}
                   />
               </div>
               <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Invoice No (Optional)</label>
                   <input 
                      type="text" 
                      className="w-full border rounded-lg p-2 text-sm"
                      placeholder="Auto-generated if blank"
                      value={formData.referenceNo}
                      onChange={e => setFormData({...formData, referenceNo: e.target.value})}
                   />
               </div>
           </div>

           <div className="border rounded-lg overflow-hidden mb-6">
               <table className="w-full text-sm">
                   <thead className="bg-gray-50 border-b">
                       <tr>
                           <th className="p-3 text-left w-10">#</th>
                           <th className="p-3 text-left">Item Description</th>
                           <th className="p-3 text-right w-24">Qty</th>
                           <th className="p-3 text-right w-32">Rate</th>
                           <th className="p-3 text-right w-32">Amount</th>
                           <th className="p-3 w-10"></th>
                       </tr>
                   </thead>
                   <tbody className="divide-y">
                       {lines.map((line, i) => (
                           <tr key={i}>
                               <td className="p-3 text-center text-gray-500">{i + 1}</td>
                               <td className="p-3">
                                   <select 
                                      className="w-full border rounded p-1.5"
                                      value={line.itemId}
                                      onChange={e => updateLine(i, 'itemId', e.target.value)}
                                   >
                                       <option value="">Select Item</option>
                                       {items.map(item => <option key={item.id} value={item.id}>{item.name} (Stk: {Object.values(item.stock).reduce((a:number,b:number)=>a+b,0)})</option>)}
                                   </select>
                               </td>
                               <td className="p-3">
                                   <input type="number" className="w-full border rounded p-1.5 text-right" value={line.quantity} onChange={e => updateLine(i, 'quantity', e.target.value)} />
                               </td>
                               <td className="p-3">
                                   <input type="number" className="w-full border rounded p-1.5 text-right" value={line.rate} onChange={e => updateLine(i, 'rate', e.target.value)} />
                               </td>
                               <td className="p-3 text-right font-medium">
                                   {line.amount.toLocaleString()}
                               </td>
                               <td className="p-3 text-center">
                                   <button onClick={() => removeLine(i)} className="text-red-500 hover:text-red-700"><X className="w-4 h-4"/></button>
                               </td>
                           </tr>
                       ))}
                   </tbody>
                   <tfoot className="bg-gray-50 font-bold">
                       <tr>
                           <td colSpan={4} className="p-3 text-right">Total Amount</td>
                           <td className="p-3 text-right">{calculateTotal().toLocaleString()}</td>
                           <td></td>
                       </tr>
                   </tfoot>
               </table>
               <div className="p-3 border-t bg-gray-50">
                   <button onClick={addLine} className="flex items-center text-blue-600 text-sm font-medium hover:underline">
                       <Plus className="w-4 h-4 mr-1" /> Add Line Item
                   </button>
               </div>
           </div>

           <div className="mb-6">
               <label className="block text-sm font-medium text-gray-700 mb-1">Narration / Notes</label>
               <textarea 
                  className="w-full border rounded-lg p-2 text-sm" 
                  rows={2}
                  value={formData.narration}
                  onChange={e => setFormData({...formData, narration: e.target.value})}
               />
           </div>

           <div className="flex justify-end gap-3">
               <button className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium">Cancel</button>
               <button onClick={handleSave} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm">Save Invoice</button>
           </div>

           {showToast && (
              <div className="absolute top-4 right-4 flex items-center gap-2 bg-green-100 border border-green-200 text-green-800 px-4 py-3 rounded-lg shadow-lg animate-fade-in">
                  <CheckCircle className="w-5 h-5" />
                  <span>Invoice Saved Successfully!</span>
              </div>
           )}
      </div>
  );
};

// ... [LedgerManager, CashBankBook components below are kept as is] ...
const LedgerManager = () => {
    const [ledgers, setLedgers] = useState<Ledger[]>([]);
    const [isEditing, setIsEditing] = useState(false);
    const [currentLedger, setCurrentLedger] = useState<Partial<Ledger>>({ 
        group: 'Sundry Debtors', 
        openingBalance: 0, 
        currentBalance: 0,
        code: ''
    });

    useEffect(() => { loadLedgers(); }, []);

    const loadLedgers = async () => {
        const data = await getAllLedgers();
        data.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
        setLedgers(data);
    };

    const generateNextCode = () => {
        const codes = ledgers.map(l => parseInt(l.code || '0')).filter(n => !isNaN(n));
        const max = codes.length > 0 ? Math.max(...codes) : 1000;
        return (max + 1).toString();
    };

    const handleCreateNew = () => {
        setCurrentLedger({ 
            group: 'Sundry Debtors', 
            openingBalance: 0, 
            currentBalance: 0,
            code: generateNextCode() 
        });
        setIsEditing(true);
    };

    const handleEdit = (ledger: Ledger) => {
        setCurrentLedger(ledger);
        setIsEditing(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!currentLedger.name) return;
        
        await saveLedger({
            ...currentLedger,
            currentBalance: currentLedger.openingBalance || 0 
        } as Ledger);
        
        setIsEditing(false);
        loadLedgers();
    };

    const GROUPS = [
        'Bank Accounts', 'Cash-in-Hand', 'Sundry Debtors', 'Sundry Creditors', 
        'Purchase Accounts', 'Sales Accounts', 'Direct Expenses', 'Indirect Expenses',
        'Direct Incomes', 'Indirect Incomes', 'Capital Account', 'Loans (Liability)',
        'Fixed Assets', 'Current Assets', 'Current Liabilities', 'Stock-in-Hand'
    ];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="font-bold text-gray-800">Chart of Accounts</h3>
                <button onClick={handleCreateNew} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-2"/> New Ledger
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-3 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase w-24">Code</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Ledger Name</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Group</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Portal Access</th>
                                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {ledgers.map(l => (
                                <tr key={l.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-sm font-mono text-gray-500">{l.code || '-'}</td>
                                    <td className="px-6 py-4 font-medium text-gray-900">
                                        {l.name}
                                        {l.alias && <span className="block text-xs text-gray-400 italic">({l.alias})</span>}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600">{l.group}</td>
                                    <td className="px-6 py-4 text-sm text-gray-600">
                                        {l.portalEmail ? (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                                Active
                                            </span>
                                        ) : (
                                            <span className="text-gray-400 text-xs">Disabled</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right text-sm font-medium">
                                        <button onClick={() => handleEdit(l)} className="text-blue-600 hover:text-blue-900"><FileText className="w-4 h-4"/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {isEditing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-900">{currentLedger.id ? 'Edit Ledger' : 'Create New Ledger'}</h3>
                            <button onClick={() => setIsEditing(false)}><X className="w-5 h-5 text-gray-400"/></button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div className="flex gap-4">
                                <div className="w-1/3">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Ledger Code</label>
                                    <input type="text" className="w-full border rounded-lg p-2 text-sm bg-gray-50 font-mono" value={currentLedger.code || ''} onChange={e => setCurrentLedger({...currentLedger, code: e.target.value})} />
                                </div>
                                <div className="w-2/3">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Ledger Name</label>
                                    <input type="text" required className="w-full border rounded-lg p-2 text-sm" placeholder="e.g. HDFC Bank, Roy Electronics" value={currentLedger.name || ''} onChange={e => setCurrentLedger({...currentLedger, name: e.target.value})} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Under Group</label>
                                    <select className="w-full border rounded-lg p-2 text-sm" value={currentLedger.group} onChange={e => setCurrentLedger({...currentLedger, group: e.target.value as any})}>
                                        {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                                    </select>
                                </div>
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Op. Bal</label>
                                        <input type="number" className="w-full border rounded-lg p-2 text-sm" value={currentLedger.openingBalance} onChange={e => setCurrentLedger({...currentLedger, openingBalance: Number(e.target.value)})} />
                                    </div>
                                    <div className="w-20">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                                        <select className="w-full border rounded-lg p-2 text-sm" value={currentLedger.openingBalanceType || 'Dr'} onChange={e => setCurrentLedger({...currentLedger, openingBalanceType: e.target.value as any})}>
                                            <option value="Dr">Dr</option>
                                            <option value="Cr">Cr</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Portal Access Section */}
                            {['Sundry Debtors', 'Sundry Creditors'].includes(currentLedger.group || '') && (
                                <div className="mt-4 p-4 bg-purple-50 rounded-lg border border-purple-100">
                                    <h4 className="font-semibold text-purple-900 mb-3 flex items-center">
                                        <Lock className="w-4 h-4 mr-2" /> Partner Portal Access
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-purple-800 mb-1">Portal Email</label>
                                            <div className="relative">
                                                <Mail className="absolute left-2 top-2 w-4 h-4 text-purple-400" />
                                                <input 
                                                    type="email" 
                                                    className="w-full border border-purple-200 rounded-lg pl-8 p-2 text-sm focus:ring-purple-500 focus:border-purple-500" 
                                                    placeholder="client@email.com"
                                                    value={currentLedger.portalEmail || ''} 
                                                    onChange={e => setCurrentLedger({...currentLedger, portalEmail: e.target.value})} 
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-purple-800 mb-1">Portal Password</label>
                                            <input 
                                                type="password" 
                                                className="w-full border border-purple-200 rounded-lg p-2 text-sm focus:ring-purple-500 focus:border-purple-500" 
                                                placeholder="Set password"
                                                value={currentLedger.portalPassword || ''} 
                                                onChange={e => setCurrentLedger({...currentLedger, portalPassword: e.target.value})} 
                                            />
                                        </div>
                                    </div>
                                    <p className="text-xs text-purple-600 mt-2">Setting these credentials allows the customer/vendor to log in and view their statement.</p>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">GSTIN (Optional)</label>
                                <input type="text" className="w-full border rounded-lg p-2 text-sm uppercase" placeholder="For B2B Parties" value={currentLedger.gstin || ''} onChange={e => setCurrentLedger({...currentLedger, gstin: e.target.value})} />
                            </div>
                            <div className="pt-4 flex justify-end">
                                <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">Save Ledger</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

const CashBankBook = ({ category }: CashBankBookProps) => {
    const [mode, setMode] = useState<'Receipt' | 'Payment' | 'Contra'>('Receipt');
    const [ledgers, setLedgers] = useState<Ledger[]>([]);
    const [vouchers, setVouchers] = useState<Voucher[]>([]);
    const [showToast, setShowToast] = useState(false);
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        partyLedgerId: '',
        cashBankLedgerId: '',
        amount: '',
        narration: '',
        referenceNo: ''
    });

    useEffect(() => { loadData(); }, [category]);

    const isPrimaryLedger = (ledger: Ledger) => {
        if (category === 'Cash') return ledger.group === 'Cash-in-Hand';
        if (category === 'Bank') return ['Bank Accounts', 'Bank OD A/c'].includes(ledger.group);
        return ledger.group === category;
    };

    const isContraTarget = (ledger: Ledger) => {
        if (category === 'Cash') return ['Bank Accounts', 'Bank OD A/c'].includes(ledger.group);
        if (category === 'Bank') return ledger.group === 'Cash-in-Hand';
        return false;
    };

    const loadData = async () => {
        const [l, v] = await Promise.all([getAllLedgers(), getAllVouchers()]);
        setLedgers(l);
        const categoryLedgerIds = l.filter(leg => isPrimaryLedger(leg)).map(leg => leg.id);
        const filteredVouchers = v.filter(x => {
            const primaryId = x.items?.[0]?.itemId;
            const partyId = x.partyLedgerId;
            return categoryLedgerIds.includes(primaryId) || categoryLedgerIds.includes(partyId);
        }).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setVouchers(filteredVouchers);
        const firstLedger = l.find(leg => isPrimaryLedger(leg));
        if (firstLedger) setFormData(prev => ({ ...prev, cashBankLedgerId: firstLedger.id?.toString() || '' }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.partyLedgerId || !formData.cashBankLedgerId || !formData.amount) {
            alert("Please select accounts and amount"); return;
        }
        const voucher: Voucher = {
            type: mode,
            date: formData.date,
            referenceNo: formData.referenceNo,
            partyLedgerId: Number(formData.partyLedgerId),
            items: [{
                itemId: Number(formData.cashBankLedgerId),
                itemName: ledgers.find(l => l.id === Number(formData.cashBankLedgerId))?.name || category,
                quantity: 1, rate: Number(formData.amount), amount: Number(formData.amount), gstRate: 0, igst: 0, cgst: 0, sgst: 0
            }],
            totalAmount: Number(formData.amount), totalTax: 0, narration: formData.narration
        };
        await saveVoucher(voucher);
        setFormData({ ...formData, amount: '', narration: '', referenceNo: '', partyLedgerId: '' });
        loadData();
        setShowToast(true); setTimeout(() => setShowToast(false), 3000);
    };

    const primaryLedgers = ledgers.filter(l => isPrimaryLedger(l));
    const contraTargetLedgers = ledgers.filter(l => isContraTarget(l));
    const partyLedgers = ledgers.filter(l => !isPrimaryLedger(l) && !isContraTarget(l));
    const availableParties = mode === 'Contra' ? contraTargetLedgers : partyLedgers;
    const theme = mode === 'Receipt' ? 'green' : mode === 'Payment' ? 'red' : 'blue';
    const Icon = mode === 'Receipt' ? ArrowDownRight : mode === 'Payment' ? ArrowUpRight : ArrowLeftRight;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
            <div className="lg:col-span-1 space-y-6">
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="p-2 bg-gray-50 flex border-b border-gray-200">
                        <button onClick={() => setMode('Receipt')} className={`flex-1 py-2 text-xs font-bold rounded-md flex flex-col items-center justify-center gap-1 transition-all ${mode === 'Receipt' ? 'bg-white text-green-600 shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700'}`}><ArrowDownRight className="w-4 h-4" /> {category} In</button>
                        <button onClick={() => setMode('Payment')} className={`flex-1 py-2 text-xs font-bold rounded-md flex flex-col items-center justify-center gap-1 transition-all ${mode === 'Payment' ? 'bg-white text-red-600 shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700'}`}><ArrowUpRight className="w-4 h-4" /> {category} Out</button>
                        <button onClick={() => setMode('Contra')} className={`flex-1 py-2 text-xs font-bold rounded-md flex flex-col items-center justify-center gap-1 transition-all ${mode === 'Contra' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700'}`}><ArrowLeftRight className="w-4 h-4" /> Contra</button>
                    </div>
                    <form onSubmit={handleSave} className="p-6 space-y-4">
                        <div className={`text-xs font-bold uppercase tracking-wider text-${theme}-600 mb-2 flex items-center gap-2`}><Icon className="w-4 h-4"/> {mode === 'Receipt' ? `${category} Receipt` : mode === 'Payment' ? `${category} Payment` : `Fund Transfer`}</div>
                        <div><label className="block text-xs font-medium text-gray-500 mb-1">Date</label><input type="date" className="w-full border rounded-lg p-2 text-sm" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} /></div>
                        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                            <div><label className="block text-xs font-medium text-gray-500 mb-1">{mode === 'Receipt' ? 'To' : 'From'} ({category})</label><select className="w-full border rounded-lg p-2 text-sm bg-white font-mono" value={formData.cashBankLedgerId} onChange={e => setFormData({...formData, cashBankLedgerId: e.target.value})}><option value="">Select Account...</option>{primaryLedgers.map(l => <option key={l.id} value={l.id}>{l.name} (₹{l.currentBalance})</option>)}</select></div>
                            <div><label className="block text-xs font-medium text-gray-500 mb-1">{mode === 'Receipt' ? 'From' : 'To'} (Party)</label><select className="w-full border rounded-lg p-2 text-sm bg-white font-mono" value={formData.partyLedgerId} onChange={e => setFormData({...formData, partyLedgerId: e.target.value})}><option value="">Select Account...</option>{availableParties.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4"><div className="col-span-2"><label className="block text-xs font-medium text-gray-500 mb-1">Amount</label><input type="number" className="w-full border rounded-lg p-2 text-lg font-bold" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} /></div></div>
                        <div><label className="block text-xs font-medium text-gray-500 mb-1">Narration</label><textarea rows={2} className="w-full border rounded-lg p-2 text-sm" value={formData.narration} onChange={e => setFormData({...formData, narration: e.target.value})} /></div>
                        <button type="submit" className={`w-full py-3 rounded-lg text-white font-bold shadow-lg ${theme === 'green' ? 'bg-green-600' : theme === 'red' ? 'bg-red-600' : 'bg-blue-600'}`}>Save Transaction</button>
                    </form>
                </div>
            </div>
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center"><h3 className="font-bold text-gray-800 flex items-center gap-2"><RefreshCw className="w-4 h-4 text-gray-500" /> History</h3></div>
                <div className="flex-1 overflow-auto"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50 sticky top-0"><tr><th className="px-6 py-3 text-left text-xs font-bold text-gray-500">Date</th><th className="px-6 py-3 text-left text-xs font-bold text-gray-500">Particulars</th><th className="px-6 py-3 text-right text-xs font-bold text-gray-500">Amount</th></tr></thead><tbody className="divide-y divide-gray-200">{vouchers.map(v => (<tr key={v.id} className="hover:bg-gray-50"><td className="px-6 py-4 text-sm text-gray-600">{new Date(v.date).toLocaleDateString()}</td><td className="px-6 py-4"><div className="text-sm font-medium text-gray-900">{ledgers.find(l=>l.id===v.partyLedgerId)?.name}</div></td><td className={`px-6 py-4 text-right text-sm font-bold ${v.type==='Receipt'?'text-green-600':v.type==='Contra'?'text-blue-600':'text-red-600'}`}>{v.totalAmount.toLocaleString()}</td></tr>))}</tbody></table></div>
            </div>
            {showToast && <div className="fixed top-24 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-white border border-green-200 rounded-lg shadow-lg"><CheckCircle className="w-5 h-5 text-green-600" /><span className="font-semibold text-gray-900">Saved</span></div>}
        </div>
    );
};
