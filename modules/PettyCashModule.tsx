
import React, { useState, useEffect, useMemo } from 'react';
import { Coins, Plus, Minus, Search, Calendar, Trash2, ArrowUpRight, ArrowDownRight, Coffee, Truck, FileText, Wrench, MoreHorizontal, Filter, X } from 'lucide-react';
import { PettyCashEntry } from '../types';
import { getAllPettyCash, savePettyCash, deletePettyCash } from '../utils/db';
import { useAuth } from '../contexts/AuthContext';

export const PettyCashModule = () => {
  const [entries, setEntries] = useState<PettyCashEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const { hasPermission, currentUser } = useAuth();
  
  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const data = await getAllPettyCash();
    // Sort by date descending
    setEntries(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    setLoading(false);
  };

  const handleSave = async (entry: PettyCashEntry) => {
    await savePettyCash(entry);
    loadData();
    setShowAddModal(false);
  };

  const handleDelete = async (id: number) => {
    if(confirm('Are you sure you want to delete this entry?')) {
        await deletePettyCash(id);
        loadData();
    }
  };

  // Calculations
  const stats = useMemo(() => {
      const today = new Date().toISOString().split('T')[0];
      const currentMonth = today.slice(0, 7);

      const balance = entries.reduce((acc, curr) => acc + (curr.type === 'Receipt' ? curr.amount : -curr.amount), 0);
      
      const spentToday = entries
        .filter(e => e.date === today && e.type === 'Payment')
        .reduce((acc, curr) => acc + curr.amount, 0);

      const spentMonth = entries
        .filter(e => e.date.startsWith(currentMonth) && e.type === 'Payment')
        .reduce((acc, curr) => acc + curr.amount, 0);

      return { balance, spentToday, spentMonth };
  }, [entries]);

  const filteredEntries = entries.filter(e => {
      const matchesSearch = e.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            e.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDate = dateFilter ? e.date === dateFilter : true;
      return matchesSearch && matchesDate;
  });

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);

  return (
    <div className="space-y-6 animate-fade-in max-w-full">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Coins className="w-7 h-7 text-yellow-600" />
            Petty Cash Book
          </h1>
          <p className="text-gray-500 mt-1">Track daily office expenses and cash flow.</p>
        </div>
        <div>
            {hasPermission('petty_cash:manage') && (
                <button 
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 shadow-sm transition-colors text-sm font-medium"
                >
                    <Plus className="w-4 h-4 mr-2" /> New Entry
                </button>
            )}
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-6 text-white shadow-lg">
              <p className="text-gray-400 text-sm font-medium uppercase">Cash In Hand</p>
              <h2 className="text-3xl font-bold mt-2">{formatCurrency(stats.balance)}</h2>
              <p className="text-xs text-gray-400 mt-2">Current available balance</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex justify-between items-start">
                  <div>
                      <p className="text-gray-500 text-sm font-medium uppercase">Spent Today</p>
                      <h2 className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(stats.spentToday)}</h2>
                  </div>
                  <div className="p-2 bg-red-50 text-red-600 rounded-lg"><ArrowUpRight className="w-5 h-5"/></div>
              </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex justify-between items-start">
                  <div>
                      <p className="text-gray-500 text-sm font-medium uppercase">This Month</p>
                      <h2 className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(stats.spentMonth)}</h2>
                  </div>
                  <div className="p-2 bg-orange-50 text-orange-600 rounded-lg"><Calendar className="w-5 h-5"/></div>
              </div>
          </div>
      </div>

      {/* Filters & Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col md:flex-row gap-4 justify-between items-center">
              <div className="flex items-center gap-2">
                  <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input 
                        type="text" 
                        placeholder="Search description..." 
                        className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-yellow-500 focus:border-yellow-500 w-64"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                      />
                  </div>
                  <input 
                    type="date" 
                    className="border border-gray-300 rounded-lg p-2 text-sm"
                    value={dateFilter}
                    onChange={e => setDateFilter(e.target.value)}
                  />
                  {(searchTerm || dateFilter) && (
                      <button onClick={() => { setSearchTerm(''); setDateFilter(''); }} className="p-2 text-red-500 hover:bg-red-50 rounded-lg" title="Clear Filters">
                          <Filter className="w-4 h-4" />
                      </button>
                  )}
              </div>
              <div className="text-sm text-gray-500">
                  Showing {filteredEntries.length} entries
              </div>
          </div>

          <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                      <tr>
                          <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Date</th>
                          <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Description</th>
                          <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Category</th>
                          <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Cash In</th>
                          <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Cash Out</th>
                          <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Action</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                      {loading ? (
                          <tr><td colSpan={6} className="px-6 py-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600 mx-auto"></div></td></tr>
                      ) : filteredEntries.length === 0 ? (
                          <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">No entries found.</td></tr>
                      ) : (
                          // Compute running balance in reverse for display? No, usually ledger shows balance. 
                          // Simpler: Just list transactions.
                          filteredEntries.map(entry => (
                              <tr key={entry.id} className="hover:bg-gray-50">
                                  <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                                      {new Date(entry.date).toLocaleDateString()}
                                  </td>
                                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                      {entry.description}
                                      {entry.voucherNo && <span className="block text-xs text-gray-400 font-mono">Ref: {entry.voucherNo}</span>}
                                  </td>
                                  <td className="px-6 py-4">
                                      <CategoryBadge category={entry.category} />
                                  </td>
                                  <td className="px-6 py-4 text-right text-sm font-bold text-green-600">
                                      {entry.type === 'Receipt' ? formatCurrency(entry.amount) : '-'}
                                  </td>
                                  <td className="px-6 py-4 text-right text-sm font-bold text-red-600">
                                      {entry.type === 'Payment' ? formatCurrency(entry.amount) : '-'}
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                      {hasPermission('petty_cash:manage') && (
                                          <button onClick={() => entry.id && handleDelete(entry.id)} className="text-gray-400 hover:text-red-600 transition-colors">
                                              <Trash2 className="w-4 h-4" />
                                          </button>
                                      )}
                                  </td>
                              </tr>
                          ))
                      )}
                  </tbody>
              </table>
          </div>
      </div>

      {showAddModal && <AddEntryModal onClose={() => setShowAddModal(false)} onSave={handleSave} currentUser={currentUser} />}
    </div>
  );
};

const CategoryBadge = ({ category }: { category: string }) => {
    let colorClass = 'bg-gray-100 text-gray-800';
    let Icon = MoreHorizontal;

    switch(category) {
        case 'Refreshments': colorClass = 'bg-orange-100 text-orange-800'; Icon = Coffee; break;
        case 'Transport': colorClass = 'bg-blue-100 text-blue-800'; Icon = Truck; break;
        case 'Stationery': colorClass = 'bg-purple-100 text-purple-800'; Icon = FileText; break;
        case 'Maintenance': colorClass = 'bg-slate-100 text-slate-800'; Icon = Wrench; break;
        case 'Cash Top-up': colorClass = 'bg-green-100 text-green-800'; Icon = ArrowDownRight; break;
    }

    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
            <Icon className="w-3 h-3 mr-1" />
            {category}
        </span>
    );
};

const AddEntryModal = ({ onClose, onSave, currentUser }: { onClose: () => void, onSave: (e: PettyCashEntry) => void, currentUser: any }) => {
    const [formData, setFormData] = useState<Partial<PettyCashEntry>>({
        date: new Date().toISOString().split('T')[0],
        type: 'Payment',
        category: 'Refreshments',
        amount: 0,
        description: '',
        submittedBy: currentUser?.name || 'Unknown'
    });

    const categories = ['Refreshments', 'Transport', 'Stationery', 'Maintenance', 'Cleaning', 'Courier', 'Miscellaneous'];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                    <h3 className="font-bold text-gray-900">New Petty Cash Entry</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
                </div>
                
                <form onSubmit={(e) => { e.preventDefault(); if(formData.amount && formData.description) onSave(formData as PettyCashEntry); }} className="p-6 space-y-4">
                    
                    {/* Toggle Type */}
                    <div className="flex bg-gray-100 p-1 rounded-lg mb-4">
                        <button 
                            type="button"
                            onClick={() => setFormData({...formData, type: 'Payment', category: 'Refreshments'})}
                            className={`flex-1 py-2 text-sm font-bold rounded-md flex items-center justify-center gap-2 transition-all ${formData.type === 'Payment' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500'}`}
                        >
                            <ArrowUpRight className="w-4 h-4" /> Expense
                        </button>
                        <button 
                            type="button"
                            onClick={() => setFormData({...formData, type: 'Receipt', category: 'Cash Top-up'})}
                            className={`flex-1 py-2 text-sm font-bold rounded-md flex items-center justify-center gap-2 transition-all ${formData.type === 'Receipt' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500'}`}
                        >
                            <ArrowDownRight className="w-4 h-4" /> Cash In
                        </button>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
                        <input 
                            type="date" 
                            required 
                            className="w-full border rounded-lg p-2 text-sm" 
                            value={formData.date}
                            onChange={e => setFormData({...formData, date: e.target.value})}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                        {formData.type === 'Receipt' ? (
                            <input type="text" disabled value="Cash Top-up" className="w-full border rounded-lg p-2 text-sm bg-gray-100 text-gray-500" />
                        ) : (
                            <select 
                                className="w-full border rounded-lg p-2 text-sm"
                                value={formData.category}
                                onChange={e => setFormData({...formData, category: e.target.value})}
                            >
                                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                        <input 
                            type="text" 
                            required 
                            className="w-full border rounded-lg p-2 text-sm" 
                            placeholder={formData.type === 'Receipt' ? "Received from Main Safe" : "e.g. Tea and Biscuits"}
                            value={formData.description}
                            onChange={e => setFormData({...formData, description: e.target.value})}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Amount (₹)</label>
                            <input 
                                type="number" 
                                required 
                                min="1"
                                className="w-full border rounded-lg p-2 text-lg font-bold" 
                                value={formData.amount || ''}
                                onChange={e => setFormData({...formData, amount: parseFloat(e.target.value)})}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Voucher No (Opt)</label>
                            <input 
                                type="text" 
                                className="w-full border rounded-lg p-2 text-sm" 
                                placeholder="Ref #"
                                value={formData.voucherNo || ''}
                                onChange={e => setFormData({...formData, voucherNo: e.target.value})}
                            />
                        </div>
                    </div>

                    <button type="submit" className={`w-full py-3 rounded-lg text-white font-bold shadow-lg mt-4 ${formData.type === 'Receipt' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
                        Save Entry
                    </button>
                </form>
            </div>
        </div>
    );
};
