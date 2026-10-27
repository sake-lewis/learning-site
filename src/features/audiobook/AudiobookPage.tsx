// Audiobook page (spec F16): list of books, new book form, book detail.
import { useCallback, useEffect, useState } from 'react';
import { useT } from '../../app/i18n.ts';
import { useVoices } from '../../app/voices.ts';
import { db, type Book } from '../../db/schema.ts';
import { BookCover } from './BookCover.tsx';
import { BookDetail } from './BookDetail.tsx';
import { deleteBook } from './books.ts';
import { NewBook } from './NewBook.tsx';
import { useRunner } from './runner.ts';

interface BookRow {
  book: Book;
  done: number;
  total: number;
}

export function AudiobookPage() {
  const t = useT();
  const refreshVoices = useVoices((s) => s.refresh);
  const runnerBook = useRunner((s) => s.bookId);
  const [rows, setRows] = useState<BookRow[]>([]);
  const [view, setView] = useState<{ kind: 'list' } | { kind: 'new' } | { kind: 'book'; id: string }>({ kind: 'list' });

  const reload = useCallback(async () => {
    const books = await db.books.orderBy('createdAt').reverse().toArray();
    setRows(
      await Promise.all(
        books.map(async (book) => ({
          book,
          total: await db.bookSegments.where('bookId').equals(book.id).count(),
          done: await db.bookSegments.where('bookId').equals(book.id).filter((s) => s.status === 'done').count(),
        })),
      ),
    );
  }, []);

  useEffect(() => {
    void refreshVoices();
  }, [refreshVoices]);

  useEffect(() => {
    if (view.kind === 'list') void reload();
  }, [view, reload, runnerBook]);

  const remove = async (row: BookRow) => {
    if (!window.confirm(t('book.deleteConfirm', { name: row.book.title }))) return;
    await deleteBook(row.book.id);
    await reload();
  };

  return (
    <div className="page">
      <div className="page-inner">
        <header className="page-head">
          <div>
            <h1>{t('book.title')}</h1>
            <p className="page-sub">{t('book.intro')}</p>
          </div>
          {view.kind === 'list' && (
            <button type="button" className="btn btn-primary btn-lg" onClick={() => setView({ kind: 'new' })}>
              {t('book.new')}
            </button>
          )}
        </header>

        {view.kind === 'new' && <NewBook onCreated={(id) => setView({ kind: 'book', id })} onCancel={() => setView({ kind: 'list' })} />}
        {view.kind === 'book' && <BookDetail id={view.id} onBack={() => setView({ kind: 'list' })} />}
        {view.kind === 'list' && (
          <div className="stack">
            {rows.length === 0 ? (
              <p className="empty">{t('book.empty')}</p>
            ) : (
              <ul className="list">
                {rows.map((row) => (
                  <li key={row.book.id} className="book-row" style={runnerBook === row.book.id ? { background: 'var(--accent-soft)' } : undefined}>
                    <div className="voice-card-head">
                      <div className="identity">
                        <BookCover title={row.book.title} />
                        <div style={{ minWidth: 0 }}>
                          <p className="voice-card-name">{row.book.title}</p>
                          <p className="meta-list voice-card-meta">
                            <span>{row.book.voiceName}</span>
                            <span>{t('book.chapterCount', { n: row.book.chapters.length })}</span>
                            <span className="num">{t('book.chapterProgress', { done: row.done, total: row.total })}</span>
                          </p>
                        </div>
                      </div>
                      <div className="row-actions">
                        <button type="button" className="btn btn-sm btn-primary" onClick={() => setView({ kind: 'book', id: row.book.id })}>
                          {t('book.open')}
                        </button>
                        <button type="button" className="btn btn-sm btn-ghost danger-text" onClick={() => void remove(row)}>
                          {t('book.delete')}
                        </button>
                      </div>
                    </div>
                    <div className="progress" aria-hidden="true">
                      <div className="progress-bar" style={{ width: `${row.total ? (row.done / row.total) * 100 : 0}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
