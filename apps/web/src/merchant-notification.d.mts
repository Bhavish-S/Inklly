export type MerchantNotificationTone = 'success' | 'error' | 'info';
export function getMerchantNotificationPresentation(tone: MerchantNotificationTone): {
  role: 'alert' | 'status';
  ariaLive: 'assertive' | 'polite';
  className: string;
};
