
import React, { useState, useEffect } from 'react';
import { Shield, Search, Filter, Download, User, RefreshCw, Calendar } from 'lucide-react';
import { getAllAuditLogs } from '../utils/db';
import { AuditLog } from '../types';
import { useAuth } from '../contexts/AuthContext';

export const AuditModule = () => {
    const { hasPermission } = useAuth();
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Filters
    const [search, setSearch] = useState('');
    const [selectedModule, setSelectedModule] = useState('All');
    const [selectedAction, setSelectedAction] = useState('All');
    const [dateFilter, setDateFilter] = useState('');

    useEffect(() => {
        loadLogs();
    }, []);

    useEffect(() => {
        filterLogs();
    }, [logs, search, selectedModule, selectedAction, dateFilter]);

    const loadLogs = async () => {
        setLoading(true);
        const data = await getAllAuditLogs();
        // Sort descending
        setLogs(data.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
        setLoading(false);
    };

    const filterLogs = () => {
        let result = logs;

        if (search) {
            const s = search.toLowerCase();
            result = result.filter(l => 
                l.userName.toLowerCase().includes(s) || 
                l.description.toLowerCase().includes(s) ||
                l.module.toLowerCase().includes(s)
            );
        }

        if (selectedModule !== 'All') {
            result = result.filter(l => l.module === selectedModule);
        }

        if (selectedAction !== 'All') {
            result = result.filter(l => l.action === selectedAction);
        }

        if (dateFilter) {
            result = result.filter(l => l.timestamp.startsWith(dateFilter));
        }

        setFilteredLogs(result);
    };

    const getActionColor = (action: string) => {
        switch(action) {
            case 'CREATE': return 'bg-green-100 text-green-800';
            case 'UPDATE': return 'bg-blue-100 text-blue-800';
            case 'DELETE': return 'bg-red-100 text-red-800';
            case 'LOGIN': return 'bg-purple-100 text-purple-800';
            case 'LOGOUT': return 'bg-gray-100 text-gray-800';
            case 'EXPORT': return 'bg-yellow-100 text-yellow-800';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    const modules = ['All', ...Array.from(new Set(logs.map(l => l.module)))];
    const actions = ['All', 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'VIEW'];

    const downloadCSV = () => {
        let csv = "Timestamp,User,Action,Module,Description\n";
        filteredLogs.forEach(l => {
            csv += `"${l.timestamp}","${l.userName}","${l.action}","${l.module}","${l.description}"\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    if (!hasPermission('audit:view')) {
        return <div className="p-8 text-center text-red-500">Access Denied</div>;
    }

    return (
        <div className="space-y-6 animate-fade-in max-w-full">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Shield className="w-7 h-7 text-gray-700" />
                        System Audit Trail
                    </h1>
                    <p className="text-gray-500 mt-1">Track user activities and system changes.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={loadLogs} className="p-2 bg-white border rounded-lg hover:bg-gray-50 text-gray-600">
                        <RefreshCw className="w-5 h-5"/>
                    </button>
                    <button onClick={downloadCSV} className="flex items-center px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 shadow-sm text-sm">
                        <Download className="w-4 h-4 mr-2" /> Export Logs
                    </button>
                </div>
            </header>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col lg:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input 
                        type="text" 
                        placeholder="Search user, module or details..." 
                        className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 w-full outline-none"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                
                <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0">
                    <select 
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                        value={selectedModule}
                        onChange={e => setSelectedModule(e.target.value)}
                    >
                        {modules.map(m => <option key={m} value={m}>{m === 'All' ? 'All Modules' : m}</option>)}
                    </select>

                    <select 
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                        value={selectedAction}
                        onChange={e => setSelectedAction(e.target.value)}
                    >
                        {actions.map(a => <option key={a} value={a}>{a === 'All' ? 'All Actions' : a}</option>)}
                    </select>

                    <input 
                        type="date" 
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                        value={dateFilter}
                        onChange={e => setDateFilter(e.target.value)}
                    />
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Timestamp</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">User</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Action</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Module</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Description</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {loading ? (
                            <tr><td colSpan={5} className="px-6 py-12 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600 mx-auto"></div></td></tr>
                        ) : filteredLogs.length === 0 ? (
                            <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">No logs found matching criteria.</td></tr>
                        ) : filteredLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {new Date(log.timestamp).toLocaleString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <div className="h-6 w-6 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-xs font-bold mr-2">
                                            {log.userName.charAt(0)}
                                        </div>
                                        <span className="text-sm font-medium text-gray-900">{log.userName}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getActionColor(log.action)}`}>
                                        {log.action}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                    {log.module}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-700">
                                    {log.description}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-500">
                    Showing {filteredLogs.length} of {logs.length} records
                </div>
            </div>
        </div>
    );
};
