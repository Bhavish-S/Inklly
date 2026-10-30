import React, { useRef, useState } from 'react';
import { api } from '../api/client';
import { SendIcon, CheckIcon } from './icons';

export interface EnquiryFormProps {
  variant?: 'A' | 'B';
  onSuccess?: () => void;
  className?: string;
}

export const EnquiryForm: React.FC<EnquiryFormProps> = ({ variant = 'A', onSuccess, className = '' }) => {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState('');
  const idempotencyKey = useRef(crypto.randomUUID());

  const resetForm = () => {
    setSubmitted(false);
    setName('');
    setPhone('');
    setEmail('');
    setMessage('');
    setWebsite('');
    setError('');
    idempotencyKey.current = crypto.randomUUID();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.submitEnquiry({
        source: variant === 'B' ? 'CONTACT' : 'HOME',
        name,
        phone,
        email,
        message,
        website,
      }, idempotencyKey.current);
      setSubmitted(true);
      onSuccess?.();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'We could not send your enquiry. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="bg-status-success-bg border border-status-success/30 rounded-2xl p-8 text-center text-status-success animate-fade-in" role="status" aria-live="polite">
        <div className="w-12 h-12 rounded-full bg-status-success text-white flex items-center justify-center mx-auto mb-3 shadow-sm">
          <CheckIcon size={24} />
        </div>
        <h4 className="text-xl font-bold text-ink-text dark:text-ink-dark-text mb-1">Enquiry received</h4>
        <p className="text-sm text-ink-text-secondary dark:text-ink-dark-text-secondary max-w-sm mx-auto mb-4">
          Thanks, <span className="font-semibold text-ink-text dark:text-ink-dark-text">{name}</span>. We have saved your message and will follow up using the contact details you provided.
        </p>
        <button type="button" onClick={resetForm} className="text-xs font-semibold text-brand hover:underline cursor-pointer">
          Send another message
        </button>
      </div>
    );
  }

  const fieldClass = 'w-full px-3.5 py-2.5 rounded-[10px] border border-ink-border dark:border-ink-dark-border focus:border-brand focus:ring-2 focus:ring-brand/20 text-sm text-ink-text dark:text-ink-dark-text placeholder:text-ink-text-muted dark:placeholder:text-ink-dark-text-muted outline-hidden transition-all bg-ink-surface dark:bg-ink-dark-elevated';

  return (
    <form onSubmit={handleSubmit} className={`space-y-4 ${className}`}>
      <div>
        <label htmlFor={`enquiry-name-${variant}`} className="block text-xs font-bold text-ink-text dark:text-ink-dark-text mb-1.5">
          Your name <span className="text-status-danger">*</span>
        </label>
        <input id={`enquiry-name-${variant}`} type="text" autoComplete="name" required minLength={2} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Amit Sharma" className={fieldClass} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor={`enquiry-phone-${variant}`} className="block text-xs font-bold text-ink-text dark:text-ink-dark-text mb-1.5">
            Phone / WhatsApp <span className="text-status-danger">*</span>
          </label>
          <input id={`enquiry-phone-${variant}`} type="tel" autoComplete="tel" required minLength={7} maxLength={24} value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Phone number" className={fieldClass} />
        </div>
        <div>
          <label htmlFor={`enquiry-email-${variant}`} className="block text-xs font-bold text-ink-text dark:text-ink-dark-text mb-1.5">
            Email address <span className="text-ink-text-muted dark:text-ink-dark-text-muted font-normal">(Optional)</span>
          </label>
          <input id={`enquiry-email-${variant}`} type="email" autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="amit@example.com" className={fieldClass} />
        </div>
      </div>

      <div>
        <label htmlFor={`enquiry-message-${variant}`} className="block text-xs font-bold text-ink-text dark:text-ink-dark-text mb-1.5">
          How can we help? <span className="text-status-danger">*</span>
        </label>
        <textarea id={`enquiry-message-${variant}`} required minLength={10} maxLength={2000} rows={3} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Tell us about your print shop and what you are looking for..." className={`${fieldClass} resize-none`} />
      </div>

      <div aria-hidden="true" className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden">
        <label htmlFor={`enquiry-website-${variant}`}>Leave this field empty</label>
        <input id={`enquiry-website-${variant}`} tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
      </div>

      {error && <p role="alert" className="text-sm text-status-danger bg-status-danger-bg border border-status-danger/20 rounded-lg px-3 py-2">{error}</p>}

      <button type="submit" disabled={loading} className="w-full py-3 bg-brand hover:bg-brand-hover disabled:opacity-60 text-white rounded-[10px] font-semibold text-sm shadow-brand transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-wait">
        <SendIcon size={16} />
        {loading ? 'Sending…' : 'Send enquiry'}
      </button>
    </form>
  );
};
