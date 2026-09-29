import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { LocalBackend } from './backend/local';
import type { Backend } from './backend/types';
import { IS_REMOTE } from './config';
import type { DB, User } from './types';

// Supabase yapılandırıldıysa canlı backend, değilse cihaz içi demo backend kullanılır.
function createBackend(): Backend {
  if (IS_REMOTE) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SupabaseBackend } = require('./backend/supabase') as typeof import('./backend/supabase');
    return new SupabaseBackend();
  }
  return new LocalBackend();
}

const backend = createBackend();

interface StoreValue {
  ready: boolean;
  /** Başlangıçta sunucuya ulaşılamadıysa hata mesajı. */
  initError: string | null;
  db: DB;
  me: User | null;
  /** 'remote': veriler Supabase'de; 'local': cihaz içi demo modu. */
  mode: Backend['mode'];
  /** Tüm veri işlemleri buradan yapılır (bkz. backend/types.ts). */
  actions: Backend;
  retryInit: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>(() => backend.snapshot());
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const sync = () => {
      setDb(backend.snapshot());
      setSessionId(backend.sessionUserId());
    };
    const unsubscribe = backend.subscribe(sync);
    backend
      .init()
      .then(() => {
        sync();
        setInitError(null);
      })
      .catch((e: unknown) => {
        console.warn('LezzetKAT başlatılamadı', e);
        setInitError(e instanceof Error ? e.message : 'Sunucuya ulaşılamadı.');
      })
      .finally(() => setReady(true));
    return unsubscribe;
  }, [attempt]);

  const me = useMemo(() => {
    const u = sessionId ? db.users.find((x) => x.id === sessionId) : undefined;
    return u && u.active ? u : null;
  }, [db.users, sessionId]);

  const value = useMemo<StoreValue>(
    () => ({
      ready,
      initError,
      db,
      me,
      mode: backend.mode,
      actions: backend,
      retryInit: () => {
        setReady(false);
        setAttempt((n) => n + 1);
      },
    }),
    [ready, initError, db, me],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}

/** Oturum açmış kullanıcının okunmamış bildirim ve mesaj sayıları. */
export function useUnread() {
  const { db, me } = useStore();
  return useMemo(() => {
    if (!me) return { notifications: 0, messages: 0 };
    return {
      notifications: db.notifications.filter((n) => n.userId === me.id && !n.read).length,
      messages: db.messages.filter((m) => m.receiverId === me.id && !m.read).length,
    };
  }, [db.notifications, db.messages, me]);
}

/** Kullanıcının engellediği kişilerin kimlikleri. */
export function useBlockedIds() {
  const { db, me } = useStore();
  return useMemo(() => new Set(me ? db.blocks.filter((b) => b.blockerId === me.id).map((b) => b.blockedId) : []), [db.blocks, me]);
}
