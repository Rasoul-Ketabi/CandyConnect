import React, { useState } from 'react';
import { login } from '../services/api';
import { Candy, User, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';

interface LoginPageProps { onLogin: () => void; }

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await login(username, password);
      if (res.success && res.token) {
        sessionStorage.setItem('cc_auth', 'true');
        sessionStorage.setItem('cc_token', res.token);
        onLogin();
      } else {
        setError(res.message || 'Invalid username or password');
        setLoading(false);
      }
    } catch {
      setError('Connection failed. Is the server running?');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBEFE0] dark:bg-slate-900 flex items-center justify-center p-4 transition-colors">
      <div className="w-full max-w-sm mx-auto">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-orange-400 to-orange-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-300/40 dark:shadow-orange-900/40">
            <Candy className="w-10 h-10 text-white" strokeWidth={2} />
          </div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-slate-200 tracking-tight">CandyConnect</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Server Panel</p>
        </div>

        {/* Login Card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl shadow-orange-200/30 dark:shadow-slate-900/50 p-6 space-y-5 border border-slate-200/50 dark:border-slate-700/50">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 flex items-center gap-2.5">
              <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0" />
              <p className="text-red-700 dark:text-red-300 text-sm font-medium">{error}</p>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Username</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <User className="w-[18px] h-[18px]" strokeWidth={1.8} />
                </span>
                <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Enter admin username" className="w-full pl-11 pr-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-200 text-base transition-colors" disabled={loading} autoComplete="username" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Password</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <Lock className="w-[18px] h-[18px]" strokeWidth={1.8} />
                </span>
                <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" className="w-full pl-11 pr-12 py-3 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-200 text-base transition-colors" disabled={loading} autoComplete="current-password" />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 transition-colors" tabIndex={-1}>
                  {showPass ? <EyeOff className="w-[18px] h-[18px]" strokeWidth={1.8} /> : <Eye className="w-[18px] h-[18px]" strokeWidth={1.8} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className={`w-full py-3.5 rounded-xl text-white font-bold text-lg transition-all duration-200 ${loading ? 'bg-orange-400 cursor-not-allowed' : 'bg-orange-500 hover:bg-orange-600 active:scale-[0.98] shadow-lg shadow-orange-300/40 dark:shadow-orange-900/40'}`}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Authenticating...</span>
                </span>
              ) : 'Login'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
