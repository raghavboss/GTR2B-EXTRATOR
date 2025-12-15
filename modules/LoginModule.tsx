
import React, { useState } from 'react';
import { Lock, Mail, ShieldCheck, AlertCircle, ArrowRight, Building2, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const LoginModule = () => {
  const { login, loginExternal } = useAuth();
  const [activeTab, setActiveTab] = useState<'staff' | 'partner'>('staff');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      let result;
      if (activeTab === 'staff') {
          result = await login(email, password);
      } else {
          result = await loginExternal(email, password);
      }

      if (!result.success) {
        setError(result.error || 'Login failed');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
         <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-600/20 rounded-full blur-[100px]"></div>
         <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-600/20 rounded-full blur-[100px]"></div>
      </div>

      <div className="w-full max-w-md z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-xl shadow-blue-900/40 mb-4">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">TaxAnalyst ERP</h1>
          <p className="text-slate-400 mt-2">Secure Corporate Access Portal</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-100">
              <button 
                onClick={() => { setActiveTab('staff'); setError(null); }}
                className={`flex-1 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'staff' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:text-gray-700'}`}
              >
                  <User className="w-4 h-4" /> Staff Login
              </button>
              <button 
                onClick={() => { setActiveTab('partner'); setError(null); }}
                className={`flex-1 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'partner' ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50/50' : 'text-gray-500 hover:text-gray-700'}`}
              >
                  <Building2 className="w-4 h-4" /> Partner Portal
              </button>
          </div>

          <div className="p-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-6">
                {activeTab === 'staff' ? 'Sign in to your account' : 'Customer / Vendor Login'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                    placeholder={activeTab === 'staff' ? "name@company.com" : "partner@email.com"}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-100 animate-fade-in">
                  <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full flex items-center justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all disabled:opacity-70 disabled:cursor-wait ${
                    activeTab === 'staff' 
                    ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500' 
                    : 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500'
                }`}
              >
                {isSubmitting ? 'Signing in...' : 'Sign In'}
                {!isSubmitting && <ArrowRight className="ml-2 w-4 h-4" />}
              </button>
            </form>
          </div>
          <div className="bg-gray-50 px-8 py-4 border-t border-gray-100">
             <div className="text-xs text-center text-gray-500">
                {activeTab === 'staff' ? (
                    <>Default Login: <span className="font-mono bg-gray-200 px-1 rounded">admin@corp.com</span> / <span className="font-mono bg-gray-200 px-1 rounded">admin123</span></>
                ) : (
                    <>Contact finance department for credentials</>
                )}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};
