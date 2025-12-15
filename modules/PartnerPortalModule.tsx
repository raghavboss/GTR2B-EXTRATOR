
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getAllVouchers, getBusinessProfile } from '../utils/db'; 
import { Voucher, BusinessProfile, Ledger } from '../types';
import { Download, LogOut, Calendar, Building2, FileText, Search, User, Clock } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// --- Types ---
interface AgingBuckets {
    '0-30': number;
    '31-60': number;
    '61-90': number;
    '>90': number;
}

// --- Logic ---

const calculateLedgerStatement = (ledgerId: number, vouchers: Voucher[], startDate: string, endDate: string, openingBal: number, openingType: 'Dr'|'Cr') => {
    let runningBalance = openingType === 'Dr' ? openingBal : -openingBal;
    
    // 1. Calculate balance BEFORE start date
    const prevVouchers = vouchers.filter(v => new Date(v.date) < new Date(startDate));
    
    prevVouchers.forEach(v => {
        // Party logic (Primary)
        if (v.partyLedgerId === ledgerId) {
            if (['Sales', 'Payment'].includes(v.type)) runningBalance += v.totalAmount; // Dr
            if (['Purchase', 'Receipt'].includes(v.type)) runningBalance -= v.totalAmount; // Cr
        }
        // Item logic (Secondary/Contra)
        v.items.forEach(item => {
            if (item.itemId === ledgerId) {
                if (['Purchase', 'Payment'].includes(v.type)) runningBalance += item.amount;
                if (['Sales', 'Receipt'].includes(v.type)) runningBalance -= item.amount;
            }
        });
    });

    const bwdOpening = runningBalance;

    // 2. Process Current Period
    const currentVouchers = vouchers.filter(v => 
        new Date(v.date) >= new Date(startDate) && new Date(v.date) <= new Date(endDate)
    ).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const statementLines = currentVouchers.map(v => {
        let debit = 0;
        let credit = 0;

        if (v.partyLedgerId === ledgerId) {
            if (['Sales', 'Payment'].includes(v.type)) debit = v.totalAmount;
            if (['Purchase', 'Receipt'].includes(v.type)) credit = v.totalAmount;
        }
        v.items.forEach(item => {
            if (item.itemId === ledgerId) {
                if (['Purchase', 'Payment'].includes(v.type)) debit += item.amount;
                if (['Sales', 'Receipt'].includes(v.type)) credit += item.amount;
            }
        });

        runningBalance = runningBalance + debit - credit;

        return {
            date: v.date,
            particulars: v.narration || `${v.type} - Ref: ${v.referenceNo || '-'}`,
            vchType: v.type,
            vchNo: v.referenceNo || `VCH-${v.id}`,
            debit,
            credit,
            balance: runningBalance
        };
    });

    return { openingBalance: bwdOpening, lines: statementLines, closingBalance: runningBalance };
};

// FIFO Aging Calculation
const calculateAging = (closingBalance: number, vouchers: Voucher[], ledgerId: number, asOfDate: string): AgingBuckets | null => {
    // If balance is Credit (Payable) or Zero, usually we don't show aging for "Outstanding Dues" in same way
    // But for a Partner portal, if they owe money (Dr), we show aging.
    if (closingBalance <= 0) return null;

    const buckets: AgingBuckets = { '0-30': 0, '31-60': 0, '61-90': 0, '>90': 0 };
    let remainingToMatch = closingBalance;

    // Get all DEBIT transactions up to the 'asOfDate', sorted NEWEST first.
    // We walk backwards from today matching the outstanding balance against recent bills/debits.
    const debits = vouchers
        .filter(v => new Date(v.date) <= new Date(asOfDate))
        .map(v => {
            let debitAmount = 0;
            if (v.partyLedgerId === ledgerId) {
                if (['Sales', 'Payment'].includes(v.type)) debitAmount += v.totalAmount;
            }
            v.items.forEach(item => {
                if (item.itemId === ledgerId) {
                    if (['Purchase', 'Payment'].includes(v.type)) debitAmount += item.amount;
                }
            });
            return { date: v.date, amount: debitAmount };
        })
        .filter(d => d.amount > 0)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const asOfTime = new Date(asOfDate).getTime();

    for (const txn of debits) {
        if (remainingToMatch <= 0) break;

        const amountToAttribute = Math.min(remainingToMatch, txn.amount);
        const txnTime = new Date(txn.date).getTime();
        const daysOld = Math.floor((asOfTime - txnTime) / (1000 * 3600 * 24));

        if (daysOld <= 30) buckets['0-30'] += amountToAttribute;
        else if (daysOld <= 60) buckets['31-60'] += amountToAttribute;
        else if (daysOld <= 90) buckets['61-90'] += amountToAttribute;
        else buckets['>90'] += amountToAttribute;

        remainingToMatch -= amountToAttribute;
    }

    // If there's still remaining balance not matched by transaction history (e.g. Opening Balance was high), dump into >90
    if (remainingToMatch > 0) {
        buckets['>90'] += remainingToMatch;
    }

    return buckets;
};

// --- Component ---

export const PartnerPortalModule = () => {
    const { currentExternalUser, logout } = useAuth();
    const [vouchers, setVouchers] = useState<Voucher[]>([]);
    const [businessProfile, setBusinessProfile] = useState<BusinessProfile | undefined>(undefined);
    const [statementData, setStatementData] = useState<any>(null);
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const reportRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!currentExternalUser) return;
        loadData();
    }, [currentExternalUser, startDate, endDate]);

    const loadData = async () => {
        const [allVouchers, profile] = await Promise.all([getAllVouchers(), getBusinessProfile()]);
        setVouchers(allVouchers);
        setBusinessProfile(profile);

        if (currentExternalUser?.id) {
            const data = calculateLedgerStatement(
                currentExternalUser.id, 
                allVouchers, 
                startDate, 
                endDate, 
                currentExternalUser.openingBalance || 0, 
                currentExternalUser.openingBalanceType || 'Dr'
            );
            setStatementData(data);
        }
    };

    const agingData = useMemo(() => {
        if (!currentExternalUser?.id || !statementData) return null;
        return calculateAging(statementData.closingBalance, vouchers, currentExternalUser.id, endDate);
    }, [statementData, vouchers, currentExternalUser, endDate]);

    const downloadPDF = async () => {
        if(!reportRef.current) return;
        try {
            const canvas = await html2canvas(reportRef.current, { scale: 2, backgroundColor: '#ffffff' });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgWidth = 210;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
            pdf.save(`Statement_${currentExternalUser?.name}.pdf`);
        } catch(e) { console.error(e); }
    };

    const formatMoney = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    if (!currentExternalUser) return <div>Access Denied</div>;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Navbar */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="bg-purple-600 p-1.5 rounded-lg">
                            <Building2 className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-gray-900 leading-none">Partner Portal</h1>
                            <p className="text-xs text-gray-500">{businessProfile?.companyName || 'ERP System'}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="hidden md:flex flex-col items-end">
                            <span className="text-sm font-medium text-gray-900">{currentExternalUser.name}</span>
                            <span className="text-xs text-gray-500">{currentExternalUser.group}</span>
                        </div>
                        <button 
                            onClick={logout}
                            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                            title="Sign Out"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 space-y-6">
                
                {/* Controls */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <Calendar className="w-5 h-5 text-gray-400" />
                        <span className="text-sm font-medium text-gray-700">Statement Period:</span>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                        <input 
                            type="date" 
                            value={startDate} 
                            onChange={e => setStartDate(e.target.value)} 
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-purple-500 focus:border-purple-500 outline-none"
                        />
                        <span className="self-center text-gray-400">-</span>
                        <input 
                            type="date" 
                            value={endDate} 
                            onChange={e => setEndDate(e.target.value)} 
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-purple-500 focus:border-purple-500 outline-none"
                        />
                    </div>
                    <button 
                        onClick={downloadPDF}
                        className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 shadow-sm transition-colors w-full md:w-auto justify-center"
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Download PDF
                    </button>
                </div>

                {/* Report View */}
                {statementData && (
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden p-8 flex justify-center bg-gray-50/50">
                        <div ref={reportRef} className="bg-white p-8 w-full max-w-4xl shadow-sm text-gray-900 border border-gray-100">
                            
                            {/* PDF Header */}
                            <div className="flex justify-between items-start border-b-2 border-purple-100 pb-6 mb-6">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900 uppercase">{businessProfile?.companyName}</h2>
                                    <p className="text-sm text-gray-500 mt-1">{businessProfile?.addressLine1}, {businessProfile?.city}</p>
                                    <p className="text-sm text-gray-500">GSTIN: {businessProfile?.gstin}</p>
                                </div>
                                <div className="text-right">
                                    <h3 className="text-lg font-bold text-purple-700">Account Statement</h3>
                                    <p className="text-sm font-medium text-gray-900 mt-1">{currentExternalUser.name}</p>
                                    <p className="text-xs text-gray-500">{currentExternalUser.address || ''}</p>
                                    <p className="text-xs text-gray-500 mt-2">
                                        Period: {new Date(startDate).toLocaleDateString()} to {new Date(endDate).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>

                            {/* Opening Balance Row */}
                            <div className="mb-4 flex justify-end">
                                <div className="bg-gray-50 px-4 py-2 rounded-lg border border-gray-200 text-sm">
                                    <span className="font-medium text-gray-600 mr-2">Opening Balance:</span>
                                    <span className={`font-bold ${statementData.openingBalance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                                        {formatMoney(Math.abs(statementData.openingBalance))} {statementData.openingBalance >= 0 ? 'Dr' : 'Cr'}
                                    </span>
                                </div>
                            </div>

                            {/* Table */}
                            <table className="w-full text-sm border-collapse mb-8">
                                <thead>
                                    <tr className="bg-purple-50 text-purple-900">
                                        <th className="py-3 px-4 text-left font-semibold border-b border-purple-100">Date</th>
                                        <th className="py-3 px-4 text-left font-semibold border-b border-purple-100 w-1/3">Particulars</th>
                                        <th className="py-3 px-4 text-left font-semibold border-b border-purple-100">Vch Type</th>
                                        <th className="py-3 px-4 text-right font-semibold border-b border-purple-100">Debit</th>
                                        <th className="py-3 px-4 text-right font-semibold border-b border-purple-100">Credit</th>
                                        <th className="py-3 px-4 text-right font-semibold border-b border-purple-100 bg-purple-100/50">Balance</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {statementData.lines.map((row: any, i: number) => (
                                        <tr key={i} className="hover:bg-gray-50">
                                            <td className="py-3 px-4 text-gray-600 whitespace-nowrap">{new Date(row.date).toLocaleDateString()}</td>
                                            <td className="py-3 px-4 text-gray-900 font-medium">{row.particulars}</td>
                                            <td className="py-3 px-4 text-gray-500 text-xs uppercase">{row.vchType}</td>
                                            <td className="py-3 px-4 text-right font-mono">{row.debit ? formatMoney(row.debit) : '-'}</td>
                                            <td className="py-3 px-4 text-right font-mono">{row.credit ? formatMoney(row.credit) : '-'}</td>
                                            <td className="py-3 px-4 text-right font-mono font-medium bg-gray-50">
                                                {formatMoney(Math.abs(row.balance))} <span className="text-xs text-gray-400">{row.balance >= 0 ? 'Dr' : 'Cr'}</span>
                                            </td>
                                        </tr>
                                    ))}
                                    {statementData.lines.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="py-8 text-center text-gray-400 italic">No transactions during this period.</td>
                                        </tr>
                                    )}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 border-gray-200">
                                        <td colSpan={3} className="py-4 px-4 text-right font-bold text-gray-700">Closing Balance</td>
                                        <td className="py-4 px-4 text-right font-bold">{formatMoney(statementData.lines.reduce((a:any, b:any) => a + b.debit, 0))}</td>
                                        <td className="py-4 px-4 text-right font-bold">{formatMoney(statementData.lines.reduce((a:any, b:any) => a + b.credit, 0))}</td>
                                        <td className={`py-4 px-4 text-right font-bold text-lg bg-gray-50 ${statementData.closingBalance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                                            {formatMoney(Math.abs(statementData.closingBalance))} {statementData.closingBalance >= 0 ? 'Dr' : 'Cr'}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>

                            {/* Aging Analysis Section */}
                            {agingData && (
                                <div className="mt-8 border border-gray-200 rounded-lg overflow-hidden page-break-inside-avoid">
                                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
                                        <h4 className="font-bold text-gray-700 flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-gray-500" />
                                            Aging Analysis (Outstanding)
                                        </h4>
                                        <span className="text-xs text-gray-500">As on {new Date(endDate).toLocaleDateString()}</span>
                                    </div>
                                    <div className="grid grid-cols-4 divide-x divide-gray-200">
                                        <div className="p-3 text-center">
                                            <p className="text-xs text-gray-500 font-medium uppercase mb-1">0 - 30 Days</p>
                                            <p className="font-bold text-gray-900">{formatMoney(agingData['0-30'])}</p>
                                        </div>
                                        <div className="p-3 text-center">
                                            <p className="text-xs text-gray-500 font-medium uppercase mb-1">31 - 60 Days</p>
                                            <p className="font-bold text-gray-900">{formatMoney(agingData['31-60'])}</p>
                                        </div>
                                        <div className="p-3 text-center">
                                            <p className="text-xs text-gray-500 font-medium uppercase mb-1">61 - 90 Days</p>
                                            <p className="font-bold text-orange-600">{formatMoney(agingData['61-90'])}</p>
                                        </div>
                                        <div className="p-3 text-center bg-red-50">
                                            <p className="text-xs text-red-600 font-medium uppercase mb-1">90+ Days</p>
                                            <p className="font-bold text-red-700">{formatMoney(agingData['>90'])}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="mt-8 pt-6 border-t border-gray-100 text-center text-xs text-gray-400">
                                This is a computer generated statement.
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};
