// A small "spine" cover coloured from the book title, with the title's initials.
import { toneFor } from '../../ui/components/VoiceOrb.tsx';

export function BookCover({ title, size = 'md' }: { title: string; size?: 'md' | 'lg' }) {
  const [light, dark] = toneFor(title);
  const initials = title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  const style = { background: `linear-gradient(155deg, ${light}, ${dark})`, ...(size === 'lg' ? { width: 56, height: 72, fontSize: 13 } : {}) };
  return (
    <span className="book-cover" style={style} aria-hidden="true">
      {initials}
    </span>
  );
}
