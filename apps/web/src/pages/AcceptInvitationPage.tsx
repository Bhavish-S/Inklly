import React, { useState } from 'react';
import { Logo } from '../components/icons';
import { api } from '../api/client';

interface AcceptInvitationPageProps { onNavigate: (path: string) => void; }

export const AcceptInvitationPage: React.FC<AcceptInvitationPageProps> = ({ onNavigate }) => {
  const token = new URLSearchParams(window.location.hash.slice(1)).get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      return setError('Use at least 12 characters, including upper and lower case letters, a number, and a symbol.');
    }
    if (password !== confirmation) return setError('The passwords do not match.');
    setSubmitting(true);
    try {
      await api.acceptOwnerInvitation(token, password);
      window.history.replaceState({}, '', window.location.pathname);
      setAccepted(true);
      setPassword('');
      setConfirmation('');
    } catch (err: any) {
      setError(err.message || 'This setup link is invalid or expired. Ask the Inklly administrator for a new invitation.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="min-h-[75vh] bg-ink-app dark:bg-ink-dark-app px-4 py-16 flex items-center justify-center text-ink-text dark:text-ink-dark-text">
      <div className="w-full max-w-md rounded-3xl border border-ink-border dark:border-ink-dark-border bg-ink-surface dark:bg-ink-dark-surface p-8 shadow-sm">
        <button type="button" onClick={() => onNavigate('/')} aria-label="Go to Inklly home" className="mb-8 cursor-pointer"><Logo size={22} /></button>
        {accepted ? (
          <div role="status" aria-live="polite">
            <h1 className="text-2xl font-bold text-ink-text dark:text-ink-dark-text">Account setup complete</h1>
            <p className="mt-3 text-sm text-ink-text-secondary dark:text-ink-dark-text-secondary">Your account is ready. Sign in with your email and the password you just created.</p>
            <button type="button" onClick={() => onNavigate('/login')} className="mt-6 w-full rounded-xl bg-brand hover:bg-brand-hover px-4 py-3 text-sm font-semibold text-white shadow-brand transition-all cursor-pointer">Continue to sign in</button>
          </div>
        ) : !token ? (
          <div role="alert">
            <h1 className="text-2xl font-bold text-ink-text dark:text-ink-dark-text">Invitation link required</h1>
            <p className="mt-3 text-sm text-ink-text-secondary dark:text-ink-dark-text-secondary">Open the private setup link shared with you by the shop owner or Inklly team.</p>
            <button type="button" onClick={() => onNavigate('/login')} className="mt-6 text-sm font-semibold text-brand hover:underline cursor-pointer">Go to sign in</button>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-ink-text dark:text-ink-dark-text">Set up your account</h1>
            <p className="mt-2 text-sm text-ink-text-secondary dark:text-ink-dark-text-secondary">Use at least 12 characters, including upper and lower case letters, a number, and a symbol. This invitation can only be used once.</p>
            {error && <div role="alert" aria-live="polite" className="mt-4 rounded-xl border border-status-danger/20 bg-status-danger-bg p-3 text-sm text-status-danger">{error}</div>}
            <form onSubmit={submit} className="mt-6 space-y-4">
              <label className="block text-xs font-semibold text-ink-text dark:text-ink-dark-text">Password
                <input autoComplete="new-password" type="password" required minLength={12} maxLength={1024} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 block w-full rounded-[10px] border border-ink-border dark:border-ink-dark-border px-3 py-2 text-sm text-ink-text dark:text-ink-dark-text bg-ink-surface dark:bg-ink-dark-elevated focus:border-brand focus:ring-2 focus:ring-brand/20 outline-hidden transition-all" />
              </label>
              <label className="block text-xs font-semibold text-ink-text dark:text-ink-dark-text">Confirm password
                <input autoComplete="new-password" type="password" required minLength={12} maxLength={1024} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-1 block w-full rounded-[10px] border border-ink-border dark:border-ink-dark-border px-3 py-2 text-sm text-ink-text dark:text-ink-dark-text bg-ink-surface dark:bg-ink-dark-elevated focus:border-brand focus:ring-2 focus:ring-brand/20 outline-hidden transition-all" />
              </label>
              <button type="submit" disabled={submitting} className="w-full rounded-xl bg-brand hover:bg-brand-hover px-4 py-3 text-sm font-semibold text-white shadow-brand transition-all disabled:opacity-60 cursor-pointer">{submitting ? 'Saving password…' : 'Activate account'}</button>
            </form>
          </>
        )}
      </div>
    </section>
  );
};
