import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { api } from '../api/client';
import { playChime } from '../ready-alert';

interface Board {
  shopName: string;
  acceptingOrders: boolean;
  ready: string[];
  preparing: string[];
  queue: { ordersAhead: number; estimatedMinutes: number };
}

/**
 * Full-screen board for a TV or second monitor at the counter. Shows only
 * pickup tokens, never names or files, and chimes when a token turns ready.
 */
export const NowServingBoard: React.FC<{ shopCode: string }> = ({ shopCode }) => {
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState('');
  const [clock, setClock] = useState(new Date());
  const [qr, setQr] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  const previousReady = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  useEffect(() => {
    const shopUrl = `${window.location.origin}/p/${shopCode}`;
    QRCode.toDataURL(shopUrl, { margin: 1, width: 400, color: { dark: '#0F172A', light: '#FFFFFF' } }).then(setQr).catch(() => setQr(null));
    document.title = 'Now serving — Inklly';
  }, [shopCode]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await api.getDisplayBoard(shopCode);
        if (!active) return;
        const readyNow = new Set<string>(data.ready);
        if (previousReady.current) {
          const newlyReady = [...readyNow].filter((token) => !previousReady.current!.has(token));
          if (newlyReady.length) {
            setFresh(new Set(newlyReady));
            if (soundOn) playChime();
            setTimeout(() => setFresh(new Set()), 12_000);
          }
        }
        previousReady.current = readyNow;
        setBoard(data);
        setError('');
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Board unavailable');
      }
    };
    void load();
    const poll = window.setInterval(load, 5000);
    const tick = window.setInterval(() => setClock(new Date()), 15_000);
    return () => { active = false; window.clearInterval(poll); window.clearInterval(tick); };
  }, [shopCode, soundOn]);

  const goFullscreen = () => {
    setSoundOn(true);
    void document.documentElement.requestFullscreen?.().catch(() => undefined);
  };

  if (error && !board) {
    return <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-8 text-center"><p className="text-2xl">{error}</p></main>;
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col select-none" onClick={() => !soundOn && goFullscreen()}>
      <header className="flex items-center justify-between px-10 py-6 border-b border-white/10">
        <div>
          <h1 className="text-4xl font-black tracking-tight !text-white">{board?.shopName || 'Loading…'}</h1>
          <p className="text-lg text-slate-400">{board?.acceptingOrders === false ? 'Online orders paused' : `Queue: ${board?.queue.ordersAhead ?? 0} · about ${board?.queue.estimatedMinutes ?? 0} min`}</p>
        </div>
        <div className="text-right">
          <p className="text-4xl font-bold tabular-nums">{clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
          {!soundOn && <p className="text-sm text-amber-300">Click anywhere for full screen and sound</p>}
        </div>
      </header>

      <div className="flex-1 grid grid-cols-[1fr_1.4fr_auto] gap-0">
        <section className="p-10 border-r border-white/10">
          <h2 className="text-2xl font-bold uppercase tracking-widest !text-amber-300 mb-6">Being prepared</h2>
          <div className="flex flex-wrap gap-4">
            {board?.preparing.length ? board.preparing.map((token) => (
              <span key={token} className="text-5xl font-black font-mono text-slate-300 bg-white/5 rounded-2xl px-6 py-4">{token}</span>
            )) : <p className="text-2xl text-slate-500">No orders in the queue</p>}
          </div>
        </section>
        <section className="p-10 bg-emerald-950/40">
          <h2 className="text-2xl font-bold uppercase tracking-widest !text-emerald-300 mb-6">Ready — please collect</h2>
          <div className="flex flex-wrap gap-5">
            {board?.ready.length ? board.ready.map((token) => (
              <span key={token} className={`text-7xl font-black font-mono rounded-3xl px-8 py-5 transition-all ${fresh.has(token) ? 'bg-emerald-400 text-slate-950 animate-pulse' : 'bg-emerald-500/15 text-emerald-300'}`}>{token}</span>
            )) : <p className="text-2xl text-slate-500">Nothing waiting for pickup</p>}
          </div>
        </section>
        <aside className="w-72 p-8 flex flex-col items-center justify-center gap-4 border-l border-white/10">
          {qr && <img src={qr} alt="Scan to order prints" className="w-56 h-56 rounded-2xl bg-white p-3" />}
          <p className="text-xl font-bold text-center">Scan to print<br /><span className="text-base font-normal text-slate-400">from your phone</span></p>
        </aside>
      </div>
      <footer className="px-10 py-3 text-sm text-slate-500 border-t border-white/10">Show your token at the counter · Powered by Inklly</footer>
    </main>
  );
};
