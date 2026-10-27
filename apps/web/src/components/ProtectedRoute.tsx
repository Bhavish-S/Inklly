import React, { useEffect, useState } from 'react';
import { ShieldIcon, LockIcon } from './icons';
import { api } from '../api/client';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  fallbackPath?: string;
  onNavigate: (path: string) => void;
  requiredRoleName?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  fallbackPath = '/login',
  onNavigate,
  requiredRoleName = 'account',
}) => {
  const [checking, setChecking] = useState<boolean>(true);
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    async function verifyAuth() {
      try {
        const token = localStorage.getItem('inklly_token');
        if (!token) {
          if (isMounted) {
            setIsAuthorized(false);
            setChecking(false);
          }
          return;
        }

        // Live verification with the backend
        const res = await api.getMe();
        if (!isMounted) return;

        if (!res || !res.user) {
          localStorage.removeItem('inklly_token');
          localStorage.removeItem('inklly_user');
          localStorage.removeItem('inklly_shop');
          setIsAuthorized(false);
          setChecking(false);
          return;
        }

        // Sync validated user and shop into localStorage
        localStorage.setItem('inklly_user', JSON.stringify(res.user));
        if (res.shop) {
          localStorage.setItem('inklly_shop', JSON.stringify(res.shop));
        }

        const user = res.user;

        // PLATFORM_OWNER has global wildcard access
        if (user.role === 'PLATFORM_OWNER' || user.role === 'PLATFORM_ADMIN') {
          setIsAuthorized(true);
          setChecking(false);
          return;
        }

        // Check specific role requirements
        if (allowedRoles && allowedRoles.length > 0) {
          if (!allowedRoles.includes(user.role)) {
            setIsAuthorized(false);
            setChecking(false);
            return;
          }
        }

        setIsAuthorized(true);
        setChecking(false);
      } catch {
        if (isMounted) {
          // Token is invalid, expired, or backend rejected it. Purge invalid session!
          localStorage.removeItem('inklly_token');
          localStorage.removeItem('inklly_user');
          localStorage.removeItem('inklly_shop');
          setIsAuthorized(false);
          setChecking(false);
        }
      }
    }

    verifyAuth();

    return () => {
      isMounted = false;
    };
  }, [allowedRoles]);

  if (checking) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          Verifying security session...
        </p>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#0B0F19] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#131B2E] border border-slate-800 rounded-3xl p-8 text-center space-y-6 shadow-2xl animate-fadeIn">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-[#A9B6FF] flex items-center justify-center mx-auto text-2xl font-black shadow-inner">
            <LockIcon size={28} />
          </div>

          <div className="space-y-2">
            <div className="inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/15 text-rose-400 border border-rose-500/30">
              Authentication Required
            </div>
            <h2 className="text-xl font-extrabold text-white">Restricted Dashboard</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              This workspace is protected. Please sign in with verified <strong className="text-slate-200">{requiredRoleName}</strong> credentials to continue.
            </p>
          </div>

          <div className="pt-2 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => onNavigate(fallbackPath)}
              className="w-full py-3 bg-[#4D64E6] hover:bg-indigo-600 text-white font-bold rounded-xl text-xs transition-all shadow-lg shadow-indigo-600/25 cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Sign In to Your Account</span>
              <span>→</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="w-full py-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-all cursor-pointer"
            >
              Return to Homepage
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
