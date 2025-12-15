
import React, { useState, useEffect } from 'react';
import { Calendar, Clock, UserCheck, UserX, ChevronLeft, ChevronRight, CheckCircle, Search, Edit2, Filter, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getAllAttendance, getAttendanceByDate, getAttendanceByUserAndDate, saveAttendance, getAllUsers } from '../utils/db';
import { AttendanceRecord, User } from '../types';

export const AttendanceModule = () => {
  const { currentUser, hasPermission } = useAuth();
  const [activeView, setActiveView] = useState<'daily' | 'my-attendance'>('daily');
  
  // Set default view based on role
  useEffect(() => {
      if (hasPermission('attendance:manage')) {
          setActiveView('daily');
      } else {
          setActiveView('my-attendance');
      }
  }, [hasPermission]);

  return (
    <div className="space-y-6 animate-fade-in max-w-full">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Clock className="w-7 h-7 text-indigo-600" />
            Attendance Management
          </h1>
          <p className="text-gray-500 mt-1">Track daily check-ins, view history, and manage employee presence.</p>
        </div>
        <div className="flex bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
           {hasPermission('attendance:manage') && (
               <button
                 onClick={() => setActiveView('daily')}
                 className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                   activeView === 'daily' 
                     ? 'bg-indigo-50 text-indigo-700 shadow-sm' 
                     : 'text-gray-600 hover:bg-gray-50'
                 }`}
               >
                 Daily Register
               </button>
           )}
           <button
             onClick={() => setActiveView('my-attendance')}
             className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
               activeView === 'my-attendance' 
                 ? 'bg-indigo-50 text-indigo-700 shadow-sm' 
                 : 'text-gray-600 hover:bg-gray-50'
             }`}
           >
             My Attendance
           </button>
        </div>
      </header>

      {activeView === 'daily' && hasPermission('attendance:manage') ? (
          <DailyRegister />
      ) : (
          <MyAttendance user={currentUser} />
      )}
    </div>
  );
};

const MonthCalendar = ({ selectedDate, onSelect, onClose }: { selectedDate: string, onSelect: (d: string) => void, onClose: () => void }) => {
    const [viewDate, setViewDate] = useState(new Date(selectedDate));

    const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    const days = [];
    for (let i = 0; i < firstDay; i++) {
        days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
        days.push(new Date(year, month, i));
    }

    const isSameDay = (d1: Date, d2: Date) => d1.getDate() === d2.getDate() && d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();
    const currentSelected = new Date(selectedDate);
    const today = new Date();

    return (
        <div className="absolute top-12 left-0 z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-4 w-72 animate-fade-in">
            <div className="flex justify-between items-center mb-4">
                <button onClick={() => setViewDate(new Date(year, month - 1, 1))} className="p-1 hover:bg-gray-100 rounded"><ChevronLeft className="w-4 h-4" /></button>
                <span className="font-semibold text-gray-700">{viewDate.toLocaleDateString('default', { month: 'long', year: 'numeric' })}</span>
                <button onClick={() => setViewDate(new Date(year, month + 1, 1))} className="p-1 hover:bg-gray-100 rounded"><ChevronRight className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-2 text-center text-xs font-medium text-gray-400">
                <div>Su</div><div>Mo</div><div>Tu</div><div>We</div><div>Th</div><div>Fr</div><div>Sa</div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
                {days.map((day, idx) => {
                    if (!day) return <div key={`empty-${idx}`}></div>;
                    const isSelected = isSameDay(day, currentSelected);
                    const isToday = isSameDay(day, today);
                    return (
                        <button 
                            key={idx}
                            onClick={() => {
                                // Adjust for timezone offset to ensure correct string date
                                const offset = day.getTimezoneOffset();
                                const adjustedDate = new Date(day.getTime() - (offset*60*1000));
                                onSelect(adjustedDate.toISOString().split('T')[0]);
                                onClose();
                            }}
                            className={`
                                w-8 h-8 flex items-center justify-center rounded-full text-sm transition-colors
                                ${isSelected ? 'bg-indigo-600 text-white' : 
                                  isToday ? 'bg-indigo-50 text-indigo-600 font-bold border border-indigo-200' : 
                                  'hover:bg-gray-100 text-gray-700'}
                            `}
                        >
                            {day.getDate()}
                        </button>
                    );
                })}
            </div>
            <div className="mt-4 flex justify-between border-t border-gray-100 pt-3">
                <button onClick={() => {
                    const todayStr = new Date().toISOString().split('T')[0];
                    onSelect(todayStr);
                    onClose();
                }} className="text-xs text-indigo-600 font-medium hover:underline">
                    Go to Today
                </button>
                <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-700">Close</button>
            </div>
        </div>
    );
};

const DailyRegister = () => {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [employees, setEmployees] = useState<User[]>([]);
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    
    // Filters
    const [statusFilter, setStatusFilter] = useState<'All' | 'Present' | 'Absent' | 'Leave' | 'Half-Day'>('All');
    const [showCalendar, setShowCalendar] = useState(false);

    useEffect(() => {
        loadData();
    }, [date]);

    const loadData = async () => {
        setLoading(true);
        const [allUsers, att] = await Promise.all([getAllUsers(), getAttendanceByDate(date)]);
        setEmployees(allUsers);
        setRecords(att);
        setLoading(false);
    };

    const toggleStatus = async (userId: number, currentStatus: string) => {
        const record = records.find(r => r.userId === userId);
        const newStatus = currentStatus === 'Present' ? 'Absent' : 'Present';
        
        const newRecord: AttendanceRecord = record ? { ...record, status: newStatus as any } : {
            userId,
            date,
            status: newStatus as any,
            checkIn: newStatus === 'Present' ? new Date().toISOString() : undefined
        };

        if (newStatus === 'Absent') {
            delete newRecord.checkIn;
            delete newRecord.checkOut;
        }

        await saveAttendance(newRecord);
        loadData();
    };

    const filteredEmployees = employees.filter(e => {
        const matchesSearch = e.isActive && e.name.toLowerCase().includes(search.toLowerCase());
        if (!matchesSearch) return false;

        if (statusFilter === 'All') return true;

        const record = records.find(r => r.userId === e.id);
        const status = record?.status || 'Absent';
        
        return status === statusFilter;
    });

    const presentCount = records.filter(r => r.status === 'Present' || r.status === 'Half-Day').length;

    return (
        <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-sm text-gray-500">Total Staff</p>
                        <p className="text-2xl font-bold text-gray-900">{employees.filter(e => e.isActive).length}</p>
                    </div>
                    <div className="p-2 bg-gray-100 rounded-lg"><UserCheck className="w-5 h-5 text-gray-600"/></div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-sm text-gray-500">Present Today</p>
                        <p className="text-2xl font-bold text-green-600">{presentCount}</p>
                    </div>
                    <div className="p-2 bg-green-50 rounded-lg"><CheckCircle className="w-5 h-5 text-green-600"/></div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-sm text-gray-500">Absent</p>
                        <p className="text-2xl font-bold text-red-600">{employees.filter(e => e.isActive).length - presentCount}</p>
                    </div>
                    <div className="p-2 bg-red-50 rounded-lg"><UserX className="w-5 h-5 text-red-600"/></div>
                </div>
            </div>

            {/* Controls */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col lg:flex-row gap-4 justify-between items-center">
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
                    {/* Date Navigation & Calendar */}
                    <div className="flex items-center gap-2 relative">
                        <button onClick={() => {
                            const d = new Date(date);
                            d.setDate(d.getDate() - 1);
                            setDate(d.toISOString().split('T')[0]);
                        }} className="p-1.5 hover:bg-gray-100 rounded-lg border border-gray-200"><ChevronLeft className="w-4 h-4 text-gray-600"/></button>
                        
                        <div className="relative">
                            <button 
                                onClick={() => setShowCalendar(!showCalendar)}
                                className="flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white hover:bg-gray-50 focus:ring-2 focus:ring-indigo-200 transition-all min-w-[140px] justify-between"
                            >
                                <span className="font-medium text-gray-700">
                                    {new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                </span>
                                <Calendar className="w-4 h-4 text-gray-500" />
                            </button>
                            {showCalendar && (
                                <MonthCalendar 
                                    selectedDate={date} 
                                    onSelect={(d) => setDate(d)} 
                                    onClose={() => setShowCalendar(false)} 
                                />
                            )}
                        </div>

                        <button onClick={() => {
                            const d = new Date(date);
                            d.setDate(d.getDate() + 1);
                            setDate(d.toISOString().split('T')[0]);
                        }} className="p-1.5 hover:bg-gray-100 rounded-lg border border-gray-200"><ChevronRight className="w-4 h-4 text-gray-600"/></button>
                    </div>

                    {/* Status Filter */}
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        {['All', 'Present', 'Absent', 'Leave'].map((status) => (
                            <button
                                key={status}
                                onClick={() => setStatusFilter(status as any)}
                                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                                    statusFilter === status 
                                    ? 'bg-white text-indigo-600 shadow-sm' 
                                    : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                {status}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="relative w-full lg:w-auto">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input 
                        type="text" 
                        placeholder="Search employee..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500 w-full lg:w-64"
                    />
                </div>
            </div>

            {/* List */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Employee</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Check In</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Check Out</th>
                            <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {loading ? (
                            <tr><td colSpan={5} className="px-6 py-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div></td></tr>
                        ) : filteredEmployees.length === 0 ? (
                            <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500 italic">No employees found for this filter.</td></tr>
                        ) : filteredEmployees.map(emp => {
                            const record = records.find(r => r.userId === emp.id);
                            const status = record?.status || 'Absent';
                            return (
                                <tr key={emp.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs mr-3">
                                                {emp.name.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-gray-900">{emp.name}</div>
                                                <div className="text-xs text-gray-500">{emp.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                                            status === 'Present' ? 'bg-green-100 text-green-800' : 
                                            status === 'Leave' ? 'bg-yellow-100 text-yellow-800' :
                                            'bg-red-100 text-red-800'
                                        }`}>
                                            {status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        {record?.checkIn ? new Date(record.checkIn).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-'}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        {record?.checkOut ? new Date(record.checkOut).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-'}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button 
                                            onClick={() => emp.id && toggleStatus(emp.id, status)}
                                            className={`text-sm font-medium hover:underline ${status === 'Present' ? 'text-red-600' : 'text-green-600'}`}
                                        >
                                            Mark {status === 'Present' ? 'Absent' : 'Present'}
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const MyAttendance = ({ user }: { user: User | null }) => {
    const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [history, setHistory] = useState<AttendanceRecord[]>([]);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        loadMyData();
        return () => clearInterval(timer);
    }, [user]);

    const loadMyData = async () => {
        if (!user || !user.id) return;
        const todayStr = new Date().toISOString().split('T')[0];
        
        // Load today
        const today = await getAttendanceByUserAndDate(user.id, todayStr);
        setTodayRecord(today || null);

        // Load all (simple logic for now, ideally filter by month)
        const all = await getAllAttendance();
        const myHistory = all.filter(r => r.userId === user.id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setHistory(myHistory);
    };

    const handleCheckIn = async () => {
        if (!user || !user.id) return;
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        
        const record: AttendanceRecord = {
            userId: user.id,
            date: todayStr,
            checkIn: now.toISOString(),
            status: 'Present'
        };
        await saveAttendance(record);
        loadMyData();
    };

    const handleCheckOut = async () => {
        if (!user || !user.id || !todayRecord) return;
        const now = new Date();
        const updatedRecord: AttendanceRecord = {
            ...todayRecord,
            checkOut: now.toISOString(),
            totalHours: (now.getTime() - new Date(todayRecord.checkIn!).getTime()) / (1000 * 60 * 60)
        };
        await saveAttendance(updatedRecord);
        loadMyData();
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
                {/* Clock Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 flex flex-col items-center justify-center text-center">
                    <div className="text-gray-500 font-medium mb-2">{currentTime.toLocaleDateString(undefined, {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'})}</div>
                    <div className="text-5xl font-bold text-gray-900 mb-8 font-mono">
                        {currentTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
                    </div>
                    
                    {!todayRecord ? (
                        <button 
                            onClick={handleCheckIn}
                            className="w-full py-4 bg-indigo-600 text-white rounded-xl text-lg font-bold hover:bg-indigo-700 transition-transform active:scale-95 shadow-lg shadow-indigo-200"
                        >
                            Check In
                        </button>
                    ) : !todayRecord.checkOut ? (
                        <div className="w-full space-y-4">
                            <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm font-medium">
                                Checked In at {new Date(todayRecord.checkIn!).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </div>
                            <button 
                                onClick={handleCheckOut}
                                className="w-full py-4 bg-red-500 text-white rounded-xl text-lg font-bold hover:bg-red-600 transition-transform active:scale-95 shadow-lg shadow-red-200"
                            >
                                Check Out
                            </button>
                        </div>
                    ) : (
                        <div className="w-full bg-gray-100 text-gray-600 p-4 rounded-xl text-center">
                            <p className="font-bold text-lg">Work day completed!</p>
                            <p className="text-sm mt-1">Total: {todayRecord.totalHours?.toFixed(1)} hrs</p>
                        </div>
                    )}
                </div>

                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
                    <h3 className="font-bold text-lg mb-4">Monthly Summary</h3>
                    <div className="flex justify-between items-center text-center">
                        <div>
                            <p className="text-3xl font-bold">{history.length}</p>
                            <p className="text-xs text-indigo-100">Days Present</p>
                        </div>
                        <div>
                            <p className="text-3xl font-bold">0</p>
                            <p className="text-xs text-indigo-100">Leaves Taken</p>
                        </div>
                        <div>
                            <p className="text-3xl font-bold">0</p>
                            <p className="text-xs text-indigo-100">Late Days</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="lg:col-span-2">
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                        <h3 className="font-bold text-gray-900">Attendance History</h3>
                    </div>
                    <div className="overflow-y-auto max-h-[500px]">
                        {history.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">No attendance records found.</div>
                        ) : (
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50 sticky top-0">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Check In</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Check Out</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Hours</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {history.map((record, i) => (
                                        <tr key={i} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                                {new Date(record.date).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                {record.checkIn ? new Date(record.checkIn).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                {record.checkOut ? new Date(record.checkOut).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                {record.totalHours ? `${record.totalHours.toFixed(1)} hrs` : '-'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                    {record.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
