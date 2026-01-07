import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { showToast } from '../utils/toast';
import { saveSession } from '../utils/storage';

export default function Login() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (state.currentUser) {
      navigate(state.currentUser.role === 'Manager' ? '/products' : '/pos');
    }
  }, [state.currentUser, navigate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const user = state.users.find(
      u => u.username === username && u.password === password
    );

    if (user) {
      dispatch({ type: 'LOGIN', payload: user });
      saveSession(user.id, null);
      showToast(`Welcome, ${user.username}!`, 'success');
      navigate(user.role === 'Manager' ? '/products' : '/pos');
    } else {
      showToast('Invalid credentials', 'error');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-4 animate-fade-in">
      <div className="max-w-md w-full space-y-6 lg:space-y-8 bg-white/90 backdrop-blur-lg p-6 lg:p-10 rounded-2xl shadow-2xl border border-white/20 animate-scale-in">
        <div className="text-center animate-slide-up">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl mb-4 shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </div>
          <h2 className="text-3xl font-extrabold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            POS MVP Demo
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to your account
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="animate-slide-up" style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
              <label htmlFor="username" className="block text-base font-semibold text-gray-800 mb-2">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                className="appearance-none relative block w-full px-4 py-4 text-base border-2 border-gray-300 placeholder-gray-400 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 hover:border-indigo-300 font-medium"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
              />
            </div>
            <div className="animate-slide-up" style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
              <label htmlFor="password" className="block text-base font-semibold text-gray-800 mb-2">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="appearance-none relative block w-full px-4 py-4 text-base border-2 border-gray-300 placeholder-gray-400 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 hover:border-indigo-300 font-medium"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/50 rounded-xl p-4 animate-slide-up shadow-sm" style={{ animationDelay: '0.3s', animationFillMode: 'both' }}>
            <p className="text-sm font-semibold text-blue-900 mb-3 flex items-center">
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              Demo Credentials
            </p>
            <div className="text-sm text-blue-800 space-y-2">
              <p className="flex items-center justify-between">
                <span><strong className="text-blue-900">Cashier:</strong></span>
                <span className="font-mono bg-blue-100/70 px-2 py-1 rounded text-xs">cashier / 1234</span>
              </p>
              <p className="flex items-center justify-between">
                <span><strong className="text-blue-900">Manager:</strong></span>
                <span className="font-mono bg-blue-100/70 px-2 py-1 rounded text-xs">manager / 1234</span>
              </p>
            </div>
          </div>

          <div className="animate-slide-up" style={{ animationDelay: '0.4s', animationFillMode: 'both' }}>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-4 px-6 border-2 border-indigo-700 text-base font-bold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-lg hover:shadow-xl transition-all duration-200 min-h-[56px]"
            >
              <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                <svg className="h-5 w-5 text-indigo-300 group-hover:text-indigo-200" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
              </span>
              Sign in
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
