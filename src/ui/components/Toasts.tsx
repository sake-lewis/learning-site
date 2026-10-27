import { useT } from '../../app/i18n.ts';
import { useToasts } from '../../app/stores.ts';
import { CloseIcon } from '../icons.tsx';

export function Toasts() {
  const t = useT();
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.kind}`}>
          <span className="toast-icon" aria-hidden="true" />
          <p>{toast.text}</p>
          <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => dismiss(toast.id)} aria-label={t('toast.dismiss')}>
            <CloseIcon />
          </button>
        </div>
      ))}
    </div>
  );
}
