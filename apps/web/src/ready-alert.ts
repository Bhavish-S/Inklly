/** Small attention helpers used when an order changes state (no assets needed). */

let audioContext: AudioContext | null = null;

/** A short two-note chime generated with Web Audio. */
export function playChime(): void {
  try {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return;
    audioContext = audioContext || new Ctor();
    const ctx = audioContext;
    if (ctx.state === 'suspended') void ctx.resume();
    [880, 1318.5].forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      const start = ctx.currentTime + index * 0.18;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.4);
    });
  } catch { /* sound is a nicety */ }
}

/** Unlocks audio on iOS/Android; call from a user tap. */
export function primeAudio(): void {
  try {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return;
    audioContext = audioContext || new Ctor();
    if (audioContext.state === 'suspended') void audioContext.resume();
  } catch { /* ignore */ }
}

export function vibrate(pattern: number[] = [200, 100, 200]): void {
  try { navigator.vibrate?.(pattern); } catch { /* unsupported */ }
}

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  return (await Notification.requestPermission()) === 'granted';
}

/** Shows a system notification when allowed; falls back silently. */
export function showNotification(title: string, body: string, tag: string): void {
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  try {
    const options = { body, tag, icon: '/icon-192.png', badge: '/icon-192.png', data: { url: window.location.href } } as NotificationOptions;
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.getRegistration().then((registration) => {
        if (registration) void registration.showNotification(title, options);
        else new Notification(title, options);
      }).catch(() => { new Notification(title, options); });
    } else {
      new Notification(title, options);
    }
  } catch { /* some browsers require a service worker */ }
}
