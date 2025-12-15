
import React, { useState, useEffect, useRef } from 'react';
import { Ledger } from '../types';
import { saveLedger } from '../utils/db';
import { Check, X, Search } from 'lucide-react';

const GROUPS = [
    'Bank Accounts', 'Bank OD A/c', 'Branch / Divisions', 'Capital Account', 
    'Cash-in-Hand', 'Current Assets', 'Current Liabilities', 'Deposits (Asset)', 
    'Direct Expenses', 'Direct Incomes', 'Duties & Taxes', 'Expenses (Direct)', 
    'Expenses (Indirect)', 'Fixed Assets', 'Income (Direct)', 'Income (Indirect)', 
    'Indirect Expenses', 'Indirect Incomes', 'Investments', 'Loans & Advances (Asset)', 
    'Loans (Liability)', 'Misc. Expenses (ASSET)', 'Provisions', 'Purchase Accounts', 
    'Reserves & Surplus', 'Retained Earnings', 'Sales Accounts', 'Secured Loans', 
    'Stock-in-Hand', 'Sundry Creditors', 'Sundry Debtors', 'Suspense A/c', 'Unsecured Loans'
];

interface TallyLedgerModuleProps {
    onClose?: () => void;
}

export const TallyLedgerModule: React.FC<TallyLedgerModuleProps> = ({ onClose }) => {
    const [formData, setFormData] = useState<Partial<Ledger>>({
        name: '',
        alias: '',
        group: '',
        mailingName: '',
        address: '',
        state: 'Rajasthan',
        country: 'India',
        pincode: '',
        pan: '',
        registrationType: 'Regular',
        gstin: '',
        openingBalance: 0,
        openingBalanceType: 'Dr'
    });

    const [focusedField, setFocusedField] = useState('name');
    const [showGroups, setShowGroups] = useState(false);
    const [groupSearch, setGroupSearch] = useState('');
    const [showAccept, setShowAccept] = useState(false);

    // Refs for all inputs to manage focus
    const inputsRef = useRef<{ [key: string]: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null }>({});

    // Effect to sync Mailing Name with Ledger Name initially
    useEffect(() => {
        if (!formData.mailingName && formData.name) {
            setFormData(prev => ({ ...prev, mailingName: prev.name }));
        }
    }, [formData.name]);

    const handleKeyDown = (e: React.KeyboardEvent, fieldName: string) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            
            // Logic for next field
            let nextField = '';
            switch (fieldName) {
                case 'name': nextField = 'alias'; break;
                case 'alias': nextField = 'group'; break;
                case 'group': nextField = 'mailingName'; break;
                case 'mailingName': nextField = 'address'; break;
                case 'address': nextField = 'state'; break;
                case 'state': nextField = 'country'; break;
                case 'country': nextField = 'pincode'; break;
                case 'pincode': nextField = 'pan'; break;
                case 'pan': nextField = 'registrationType'; break;
                case 'registrationType': nextField = 'gstin'; break;
                case 'gstin': nextField = 'openingBalance'; break;
                case 'openingBalance': nextField = 'openingBalanceType'; break;
                case 'openingBalanceType': setShowAccept(true); return; // End of form
                default: break;
            }

            if (nextField) {
                setFocusedField(nextField);
                inputsRef.current[nextField]?.focus();
                if (nextField === 'group') setShowGroups(true);
            }
        }
        
        // Custom logic for Group selection navigation
        if (fieldName === 'group' && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            // In a real app, we'd handle list navigation here. 
            // For now, let's keep it simple with mouse selection or text filtering.
        }
    };

    const handleGroupSelect = (group: string) => {
        setFormData({ ...formData, group });
        setShowGroups(false);
        setFocusedField('mailingName');
        inputsRef.current['mailingName']?.focus();
    };

    const handleSave = async () => {
        if (!formData.name || !formData.group) {
            alert("Name and Under Group are mandatory.");
            setShowAccept(false);
            return;
        }
        
        await saveLedger({
            ...formData,
            currentBalance: formData.openingBalance || 0 // Initial logic
        } as Ledger);

        // Reset form for next entry
        setFormData({
            name: '', alias: '', group: '', mailingName: '', address: '',
            state: 'Rajasthan', country: 'India', pincode: '', pan: '',
            registrationType: 'Regular', gstin: '', openingBalance: 0, openingBalanceType: 'Dr'
        });
        setShowAccept(false);
        setFocusedField('name');
        inputsRef.current['name']?.focus();
        
        if (onClose) {
            // Optional: Close if used as a modal
            // onClose();
        } else {
            // Toast or notification could go here
        }
    };

    const filteredGroups = GROUPS.filter(g => g.toLowerCase().includes(groupSearch.toLowerCase()));

    return (
        <div className="flex flex-col h-[calc(100vh-8rem)] bg-[#F8F8F8] border border-gray-300 shadow-xl rounded-none font-sans relative overflow-hidden text-sm">
            
            {/* Tally Header Strip */}
            <div className="bg-[#1E3A8A] text-white px-4 py-2 flex justify-between items-center shadow-md z-20">
                <div className="font-bold tracking-wide flex items-center gap-2">
                    <span>Ledger Creation</span>
                </div>
                <button onClick={onClose} className="hover:bg-red-600 p-1 rounded transition-colors"><X className="w-4 h-4"/></button>
            </div>

            <div className="flex flex-1 overflow-hidden relative">
                {/* Main Form Area */}
                <div className="flex-1 p-8 overflow-y-auto bg-[#FFFBEB]/10"> {/* Subtle warm tint */}
                    
                    {/* Top Section: Identification */}
                    <div className="space-y-2 mb-6">
                        <div className="flex items-center">
                            <label className="w-32 font-semibold text-gray-700">Name</label>
                            <input 
                                ref={el => { inputsRef.current['name'] = el }}
                                type="text" 
                                value={formData.name}
                                onChange={e => setFormData({...formData, name: e.target.value})}
                                onKeyDown={e => handleKeyDown(e, 'name')}
                                onFocus={() => setFocusedField('name')}
                                className="bg-[#FFFFCC] border-b border-gray-400 focus:border-blue-600 outline-none px-2 py-1 w-96 font-medium text-gray-900"
                                autoFocus
                            />
                        </div>
                        <div className="flex items-center">
                            <label className="w-32 text-gray-500 italic"> (alias)</label>
                            <input 
                                ref={el => { inputsRef.current['alias'] = el }}
                                type="text" 
                                value={formData.alias}
                                onChange={e => setFormData({...formData, alias: e.target.value})}
                                onKeyDown={e => handleKeyDown(e, 'alias')}
                                onFocus={() => setFocusedField('alias')}
                                className="bg-transparent border-b border-gray-300 focus:border-blue-600 outline-none px-2 py-1 w-96 text-gray-600 italic"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-12">
                        {/* Left Column: Mailing Details */}
                        <div className="space-y-4">
                            <div className="flex items-center mb-6">
                                <label className="w-32 font-semibold text-gray-700">Under</label>
                                <input 
                                    ref={el => { inputsRef.current['group'] = el }}
                                    type="text" 
                                    value={formData.group}
                                    onChange={e => { setFormData({...formData, group: e.target.value}); setGroupSearch(e.target.value); }}
                                    onKeyDown={e => handleKeyDown(e, 'group')}
                                    onFocus={() => { setFocusedField('group'); setShowGroups(true); setGroupSearch(formData.group || ''); }}
                                    className="bg-white border border-gray-300 focus:ring-1 focus:ring-blue-500 outline-none px-2 py-1 w-full font-medium"
                                />
                            </div>

                            <div className="border border-gray-300 p-4 rounded-sm relative">
                                <span className="absolute -top-2.5 left-3 bg-[#F8F8F8] px-1 text-xs font-bold text-gray-500 uppercase tracking-wider">Mailing Details</span>
                                
                                <div className="space-y-2 mt-1">
                                    <div className="flex items-center">
                                        <label className="w-24 text-gray-600">Name</label>
                                        <input 
                                            ref={el => { inputsRef.current['mailingName'] = el }}
                                            type="text"
                                            value={formData.mailingName}
                                            onChange={e => setFormData({...formData, mailingName: e.target.value})}
                                            onKeyDown={e => handleKeyDown(e, 'mailingName')}
                                            className="bg-transparent border-b border-dotted border-gray-400 focus:border-solid focus:border-blue-500 outline-none w-full px-1"
                                        />
                                    </div>
                                    <div className="flex items-start">
                                        <label className="w-24 text-gray-600 pt-1">Address</label>
                                        <textarea 
                                            ref={el => { inputsRef.current['address'] = el }}
                                            value={formData.address}
                                            onChange={e => setFormData({...formData, address: e.target.value})}
                                            onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleKeyDown(e, 'address'); }}}
                                            rows={3}
                                            className="bg-transparent border border-gray-300 focus:border-blue-500 outline-none w-full px-2 py-1 text-sm resize-none"
                                        />
                                    </div>
                                    <div className="flex items-center">
                                        <label className="w-24 text-gray-600">State</label>
                                        <input 
                                            ref={el => { inputsRef.current['state'] = el }}
                                            type="text"
                                            value={formData.state}
                                            onChange={e => setFormData({...formData, state: e.target.value})}
                                            onKeyDown={e => handleKeyDown(e, 'state')}
                                            className="bg-transparent border-b border-dotted border-gray-400 focus:border-solid focus:border-blue-500 outline-none w-full px-1"
                                        />
                                    </div>
                                    <div className="flex items-center">
                                        <label className="w-24 text-gray-600">Country</label>
                                        <input 
                                            ref={el => { inputsRef.current['country'] = el }}
                                            type="text"
                                            value={formData.country}
                                            onChange={e => setFormData({...formData, country: e.target.value})}
                                            onKeyDown={e => handleKeyDown(e, 'country')}
                                            className="bg-transparent border-b border-dotted border-gray-400 focus:border-solid focus:border-blue-500 outline-none w-full px-1"
                                        />
                                    </div>
                                    <div className="flex items-center">
                                        <label className="w-24 text-gray-600">Pincode</label>
                                        <input 
                                            ref={el => { inputsRef.current['pincode'] = el }}
                                            type="text"
                                            value={formData.pincode}
                                            onChange={e => setFormData({...formData, pincode: e.target.value})}
                                            onKeyDown={e => handleKeyDown(e, 'pincode')}
                                            className="bg-transparent border-b border-dotted border-gray-400 focus:border-solid focus:border-blue-500 outline-none w-32 px-1"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Tax Details */}
                        <div className="space-y-4 pt-[68px]"> {/* Align with mailing details */}
                            <div className="border border-gray-300 p-4 rounded-sm relative">
                                <span className="absolute -top-2.5 left-3 bg-[#F8F8F8] px-1 text-xs font-bold text-gray-500 uppercase tracking-wider">Tax Registration Details</span>
                                
                                <div className="space-y-3 mt-1">
                                    <div className="flex items-center">
                                        <label className="w-36 text-gray-600">PAN/IT No.</label>
                                        <input 
                                            ref={el => { inputsRef.current['pan'] = el }}
                                            type="text"
                                            value={formData.pan}
                                            onChange={e => setFormData({...formData, pan: e.target.value.toUpperCase()})}
                                            onKeyDown={e => handleKeyDown(e, 'pan')}
                                            className="bg-transparent border-b border-dotted border-gray-400 focus:border-solid focus:border-blue-500 outline-none w-full px-1 uppercase"
                                        />
                                    </div>
                                    <div className="flex items-center">
                                        <label className="w-36 text-gray-600">Registration Type</label>
                                        <select 
                                            ref={el => { inputsRef.current['registrationType'] = el as any }}
                                            value={formData.registrationType}
                                            onChange={e => setFormData({...formData, registrationType: e.target.value as any})}
                                            onKeyDown={e => handleKeyDown(e, 'registrationType')}
                                            className="bg-transparent border-b border-dotted border-gray-400 focus:border-solid focus:border-blue-500 outline-none w-full px-1 text-sm"
                                        >
                                            <option value="Regular">Regular</option>
                                            <option value="Composition">Composition</option>
                                            <option value="Consumer">Consumer</option>
                                            <option value="Unregistered">Unregistered</option>
                                        </select>
                                    </div>
                                    <div className="flex items-center">
                                        <label className="w-36 text-gray-600">GSTIN/UIN</label>
                                        <input 
                                            ref={el => { inputsRef.current['gstin'] = el }}
                                            type="text"
                                            value={formData.gstin}
                                            onChange={e => setFormData({...formData, gstin: e.target.value.toUpperCase()})}
                                            onKeyDown={e => handleKeyDown(e, 'gstin')}
                                            className="bg-transparent border-b border-dotted border-gray-400 focus:border-solid focus:border-blue-500 outline-none w-full px-1 uppercase font-mono"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Section: Opening Balance */}
                    <div className="mt-8 border-t-2 border-gray-200 pt-4 flex justify-end items-center gap-4">
                        <label className="font-semibold text-gray-700">Opening Balance</label>
                        <div className="flex items-center border border-gray-300 bg-white rounded-sm overflow-hidden">
                            <span className="px-2 text-gray-500 text-xs">INR</span>
                            <input 
                                ref={el => { inputsRef.current['openingBalance'] = el }}
                                type="number" 
                                value={formData.openingBalance || ''}
                                onChange={e => setFormData({...formData, openingBalance: parseFloat(e.target.value)})}
                                onKeyDown={e => handleKeyDown(e, 'openingBalance')}
                                onFocus={() => setFocusedField('openingBalance')}
                                className="w-32 px-2 py-1 text-right outline-none font-bold"
                                placeholder="0.00"
                            />
                            <select 
                                ref={el => { inputsRef.current['openingBalanceType'] = el as any }}
                                value={formData.openingBalanceType}
                                onChange={e => setFormData({...formData, openingBalanceType: e.target.value as any})}
                                onKeyDown={e => handleKeyDown(e, 'openingBalanceType')}
                                className="bg-gray-100 border-l border-gray-300 outline-none px-2 py-1 text-sm font-semibold"
                            >
                                <option value="Dr">Dr</option>
                                <option value="Cr">Cr</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Right Panel: List of Groups */}
                {showGroups && (
                    <div className="w-64 bg-[#E0F2FE] border-l border-blue-200 absolute right-0 top-0 bottom-0 shadow-lg flex flex-col z-10 animate-slide-in-right">
                        <div className="bg-[#1E3A8A] text-white p-2 text-center text-sm font-bold">List of Groups</div>
                        <div className="p-2 border-b border-blue-200">
                            <input 
                                type="text" 
                                className="w-full text-xs p-1 border rounded" 
                                placeholder="Filter..." 
                                value={groupSearch}
                                onChange={e => setGroupSearch(e.target.value)} 
                                autoFocus
                            />
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {filteredGroups.map(g => (
                                <button 
                                    key={g}
                                    onClick={() => handleGroupSelect(g)}
                                    className="w-full text-left px-3 py-2 text-xs hover:bg-[#BFDBFE] hover:text-blue-900 border-b border-blue-100 last:border-0 transition-colors"
                                >
                                    {g}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Accept Overlay */}
            {showAccept && (
                <div className="absolute inset-0 bg-black/20 z-50 flex items-center justify-center">
                    <div className="bg-[#FFFFE0] border-2 border-[#1E3A8A] shadow-2xl p-6 w-64 text-center rounded-sm">
                        <h3 className="text-lg font-bold text-[#1E3A8A] mb-6">Accept?</h3>
                        <div className="flex justify-center gap-4">
                            <button 
                                onClick={handleSave} 
                                className="bg-[#1E3A8A] text-white px-6 py-2 rounded-sm font-bold text-sm hover:bg-blue-800 focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 outline-none"
                                autoFocus
                            >
                                Yes
                            </button>
                            <button 
                                onClick={() => { setShowAccept(false); inputsRef.current[focusedField]?.focus(); }}
                                className="bg-transparent border border-[#1E3A8A] text-[#1E3A8A] px-6 py-2 rounded-sm font-bold text-sm hover:bg-blue-50"
                            >
                                No
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
