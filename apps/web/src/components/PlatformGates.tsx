import type { ReactNode } from 'react';
import { usePlatformConfig } from '../platform-config';

function Notice({ title, body, onHome }: { title: string; body: string; onHome: () => void }) {
  return (
    <div className="mx-auto my-16 max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">{title}</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{body}</p>
      <button type="button" onClick={onHome} className="mt-6 min-h-[44px] rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white">Back to home</button>
    </div>
  );
}

/** Hides the shop map when the admin switches map discovery off. */
export function MapGate({ children, onHome }: { children: ReactNode; onHome: () => void }) {
  const config = usePlatformConfig();
  if (config?.featureFlags.map_discovery === false) {
    return <Notice title="Shop map is unavailable" body="Scan the QR code at your print shop to order your prints." onHome={onHome} />;
  }
  return <>{children}</>;
}

/** Shows a notice instead of the sign-up form when the admin pauses new shops. */
export function SignupGate({ children, onHome }: { children: ReactNode; onHome: () => void }) {
  const config = usePlatformConfig();
  if (config?.signupsOpen === false) {
    return <Notice title="Sign-ups are paused" body={`New shop sign-ups are paused for now.${config.supportContacts.whatsapp || config.supportContacts.phone ? ` Contact us on ${config.supportContacts.whatsapp || config.supportContacts.phone}.` : ' Please check back soon.'}`} onHome={onHome} />;
  }
  return <>{children}</>;
}
