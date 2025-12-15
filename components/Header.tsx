import React from 'react';
import { Menu, Bell, Search, ChevronDown, User as UserIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface HeaderProps {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({ isSidebarOpen, toggleSidebar }) => {
  const { currentUser, currentRole, logout } = useAuth();
  const [showProfileMenu, setShowProfileMenu] = React.useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full flex-shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6 shadow-sm transition-all">
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <Menu className="h-6 w-6" />
        </button>
        
        {/* Global Search */}
        <div className="hidden md:block relative w-64 lg:w-96 transition-all">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search className="w-4 h-4 text-gray-400" />
            </div>
            <input 
                type="text" 
                className="block w-full rounded-lg border border-gray-300 bg-gray-50 pl-10 p-2 text-sm text-gray-900 focus:border-blue-500 focus:bg-white focus:ring-blue-500 outline-none transition-colors" 
                placeholder="Search invoices, reports..." 
            />
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Notifications */}
        <button className="relative rounded-full p-2 text-gray-500 hover:bg-gray-100 transition-colors">
          <Bell className="h-6 w-6" />
          <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white"></span>
        </button>

        {/* Profile Dropdown */}
        <div className="relative">
            <button 
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-3 rounded-full border border-gray-200 bg-gray-50 py-1 pl-1 pr-3 hover:bg-gray-100 transition-colors"
            >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                    {currentUser?.name.charAt(0)}
                </div>
                <div className="hidden text-left md:block">
                    <p className="text-xs font-semibold text-gray-700">{currentUser?.name}</p>
                    <p className="text-[10px] text-gray-500 uppercase leading-none">{currentRole?.name || 'User'}</p>
                </div>
                <ChevronDown className="h-4 w-4 text-gray-400" />
            </button>

            {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-48 origin-top-right rounded-lg bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none animate-fade-in">
                    <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-sm text-gray-900">Signed in as</p>
                        <p className="text-sm font-medium text-gray-900 truncate">{currentUser?.email}</p>
                    </div>
                    <a href="#" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Your Profile</a>
                    <a href="#" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Settings</a>
                    <button 
                        onClick={logout}
                        className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                        Sign out
                    </button>
                </div>
            )}
        </div>
      </div>
    </header>
  );
};
