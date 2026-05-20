import { Phone } from 'lucide-react';

interface Props {
  phone?: string | null;
  className?: string;
  iconSize?: number;
  showIcon?: boolean;
}

/**
 * Renders a phone number as a tappable tel: link.
 * On mobile, tapping opens the native dialer directly.
 */
export function PhoneLink({ phone, className = '', iconSize = 12, showIcon = true }: Props) {
  if (!phone) return <span className={`text-slate-400 ${className}`}>—</span>;
  const clean = phone.replace(/\D/g, '');
  return (
    <a
      href={`tel:${clean}`}
      className={`inline-flex items-center gap-1 text-navy-700 hover:text-emerald-600 active:text-emerald-700 transition-colors ${className}`}
      onClick={e => e.stopPropagation()}
    >
      {showIcon && <Phone size={iconSize} className="flex-shrink-0 opacity-70" />}
      {phone}
    </a>
  );
}
