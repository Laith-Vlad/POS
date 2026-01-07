import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { showToast } from '../utils/toast';
import { saveSession } from '../utils/storage';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();

  const handleLogout = () => {
    dispatch({ type: 'LOGOUT' });
    saveSession('', null);
    showToast('Logged out successfully', 'success');
    navigate('/login');
  };

  const isManager = state.currentUser?.role === 'Manager';

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <nav className="bg-white/80 backdrop-blur-md shadow-md border-b border-gray-200/50 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
          <div className="flex justify-between items-center h-14 lg:h-16">
            <div className="flex items-center space-x-1 flex-1 min-w-0">
              <Link
                to="/pos"
                className="inline-flex items-center px-2 sm:px-3 py-2 text-xs sm:text-sm font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent hover:scale-105 transition-transform duration-200"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2 text-indigo-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                <span className="hidden sm:inline">POS MVP</span>
              </Link>
              <div className="hidden md:flex items-center space-x-1 ml-2">
                <Link
                  to="/pos"
                  className="inline-flex items-center px-3 lg:px-4 py-2 text-sm lg:text-base font-semibold text-gray-800 rounded-lg hover:bg-indigo-50 hover:text-indigo-700 transition-all duration-200"
                >
                  POS
                </Link>
                {isManager && (
                  <>
                    <Link
                      to="/products"
                      className="inline-flex items-center px-3 lg:px-4 py-2 text-sm lg:text-base font-semibold text-gray-800 rounded-lg hover:bg-indigo-50 hover:text-indigo-700 transition-all duration-200"
                    >
                      Products
                    </Link>
                    <Link
                      to="/inventory"
                      className="inline-flex items-center px-3 lg:px-4 py-2 text-sm lg:text-base font-semibold text-gray-800 rounded-lg hover:bg-indigo-50 hover:text-indigo-700 transition-all duration-200"
                    >
                      Inventory
                    </Link>
                    <Link
                      to="/combos"
                      className="inline-flex items-center px-3 lg:px-4 py-2 text-sm lg:text-base font-semibold text-gray-800 rounded-lg hover:bg-indigo-50 hover:text-indigo-700 transition-all duration-200"
                    >
                      Combos
                    </Link>
                    <Link
                      to="/reports"
                      className="inline-flex items-center px-3 lg:px-4 py-2 text-sm lg:text-base font-semibold text-gray-800 rounded-lg hover:bg-indigo-50 hover:text-indigo-700 transition-all duration-200"
                    >
                      Reports
                    </Link>
                    <Link
                      to="/settings"
                      className="inline-flex items-center px-3 lg:px-4 py-2 text-sm lg:text-base font-semibold text-gray-800 rounded-lg hover:bg-indigo-50 hover:text-indigo-700 transition-all duration-200"
                    >
                      Settings
                    </Link>
                    <Link
                      to="/payment-history"
                      className="inline-flex items-center px-3 lg:px-4 py-2 text-sm lg:text-base font-semibold text-gray-800 rounded-lg hover:bg-indigo-50 hover:text-indigo-700 transition-all duration-200"
                    >
                      Payment History
                    </Link>
                  </>
                )}
              </div>
              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden ml-auto px-2 py-1 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {mobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
            <div className="hidden md:flex items-center space-x-2 lg:space-x-3">
              <div className="flex items-center px-2 lg:px-3 py-1.5 lg:py-2 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-100">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse-soft"></div>
                <span className="text-xs lg:text-sm font-medium text-gray-700 hidden lg:inline">
                  {state.currentUser?.username}
                </span>
                <span className="ml-1 lg:ml-2 px-1.5 lg:px-2 py-0.5 text-xs font-semibold text-indigo-700 bg-indigo-100 rounded-full">
                  {state.currentUser?.role}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="px-2 lg:px-4 py-1.5 lg:py-2 text-xs lg:text-sm font-medium text-gray-700 rounded-lg hover:bg-red-50 hover:text-red-700 transition-all duration-200 flex items-center"
              >
                <svg className="w-4 h-4 mr-1 lg:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="hidden lg:inline">Logout</span>
              </button>
            </div>
          </div>
          {/* Mobile menu */}
          {mobileMenuOpen && (
            <div className="md:hidden border-t border-gray-200 py-2">
              <div className="flex flex-col space-y-1">
                <Link
                  to="/pos"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-indigo-50 hover:text-indigo-700 transition-all duration-200"
                >
                  POS
                </Link>
                {isManager && (
                  <>
                    <Link
                      to="/products"
                      onClick={() => setMobileMenuOpen(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-indigo-50 hover:text-indigo-700 transition-all duration-200"
                    >
                      Products
                    </Link>
                    <Link
                      to="/inventory"
                      onClick={() => setMobileMenuOpen(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-indigo-50 hover:text-indigo-700 transition-all duration-200"
                    >
                      Inventory
                    </Link>
                    <Link
                      to="/combos"
                      onClick={() => setMobileMenuOpen(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-indigo-50 hover:text-indigo-700 transition-all duration-200"
                    >
                      Combos
                    </Link>
                    <Link
                      to="/reports"
                      onClick={() => setMobileMenuOpen(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-indigo-50 hover:text-indigo-700 transition-all duration-200"
                    >
                      Reports
                    </Link>
                    <Link
                      to="/settings"
                      onClick={() => setMobileMenuOpen(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-indigo-50 hover:text-indigo-700 transition-all duration-200"
                    >
                      Settings
                    </Link>
                    <Link
                      to="/payment-history"
                      onClick={() => setMobileMenuOpen(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-indigo-50 hover:text-indigo-700 transition-all duration-200"
                    >
                      Payment History
                    </Link>
                  </>
                )}
                <div className="px-4 py-2 flex items-center justify-between border-t border-gray-200 mt-1 pt-2">
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                    <span className="text-sm font-medium text-gray-700">{state.currentUser?.username}</span>
                    <span className="ml-2 px-2 py-0.5 text-xs font-semibold text-indigo-700 bg-indigo-100 rounded-full">
                      {state.currentUser?.role}
                    </span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="px-3 py-1.5 text-sm font-medium text-red-700 rounded-lg hover:bg-red-50 transition-all duration-200"
                  >
                    Logout
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>
      <main className="max-w-7xl mx-auto py-4 lg:py-6 px-2 sm:px-4 lg:px-8 animate-fade-in">
        {children}
      </main>
    </div>
  );
}
