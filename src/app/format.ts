export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) return `${total} s`;
  if (total >= 3600) {
    // Round to the minute first, so 1 h 59 min 30 s reads "2 h 00 min", never "1 h 60 min".
    const minutes = Math.round(total / 60);
    const h = Math.floor(minutes / 60);
    const m = String(minutes % 60).padStart(2, '0');
    return `${h} h ${m} min`;
  }
  const m = Math.floor(total / 60);
  const s = String(total % 60).padStart(2, '0');
  return `${m} min ${s} s`;
}

/** A safe file name from a title: letters, digits and dashes only. */
export function slugify(title: string): string {
  return (
    title
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'timbre'
  );
}

export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** e.g. timbre-2026-10-27-1432-kore.wav */
export function audioFileName(voice: string, at: number): string {
  const d = new Date(at);
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `timbre-${stamp}-${voice.toLowerCase().replace(/[^a-z0-9_-]/g, '')}.wav`;
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
