export function getMerchantNotificationPresentation(tone) {
  if (tone === 'error') {
    return {
      role: 'alert',
      ariaLive: 'assertive',
      className: 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/80 dark:text-rose-100',
    };
  }
  if (tone === 'success') {
    return {
      role: 'status',
      ariaLive: 'polite',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-100',
    };
  }
  return {
    role: 'status',
    ariaLive: 'polite',
    className: 'border-indigo-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100',
  };
}
