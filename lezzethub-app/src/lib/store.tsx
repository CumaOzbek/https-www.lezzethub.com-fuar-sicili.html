import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import * as api from './api';
import { DB_VERSION, createSeed } from './seed';
import type { DB, User } from './types';

const DB_KEY = 'lezzethub.db';
const SESSION_KEY = 'lezzethub.session';

export const hashPassword = (password: string) =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `lezzethub:${password}`);

interface StoreValue {
  ready: boolean;
  db: DB;
  me: User | null;
  /** DB taslağı üzerinde değişiklik yapar ve kalıcılaştırır. api.ApiError fırlatabilir. */
  mutate: <T>(fn: (draft: DB) => T) => T;
  login: (email: string, password: string) => Promise<User>;
  register: (input: api.RegisterInput) => Promise<User>;
  changePassword: (current: string, next: string) => Promise<void>;
  logout: () => void;
  resetDemo: () => Promise<void>;
}

const empty: DB = { version: DB_VERSION, users: [], listings: [], orders: [], messages: [], payments: [], notifications: [] };

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>(empty);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const dbRef = useRef(db);

  const commit = useCallback((next: DB) => {
    dbRef.current = next;
    setDb(next);
    AsyncStorage.setItem(DB_KEY, JSON.stringify(next)).catch((e) => console.warn('LezzetHub: veriler kaydedilemedi', e));
  }, []);

  const setSession = useCallback((id: string | null) => {
    setSessionId(id);
    if (id) AsyncStorage.setItem(SESSION_KEY, id).catch(() => {});
    else AsyncStorage.removeItem(SESSION_KEY).catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      let loaded: DB | null = null;
      try {
        const raw = await AsyncStorage.getItem(DB_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as DB;
          if (parsed.version === DB_VERSION) loaded = parsed;
        }
      } catch {}
      if (!loaded) loaded = await createSeed(hashPassword);
      commit(loaded);
      try {
        const sid = await AsyncStorage.getItem(SESSION_KEY);
        if (sid && loaded.users.some((u) => u.id === sid && u.active)) setSessionId(sid);
      } catch {}
      setReady(true);
    })();
  }, [commit]);

  const mutate = useCallback(
    <T,>(fn: (draft: DB) => T): T => {
      const draft = JSON.parse(JSON.stringify(dbRef.current)) as DB;
      const result = fn(draft);
      commit(draft);
      return result;
    },
    [commit],
  );

  const me = useMemo(() => {
    const u = sessionId ? db.users.find((x) => x.id === sessionId) : undefined;
    return u && u.active ? u : null;
  }, [db.users, sessionId]);

  const value = useMemo<StoreValue>(
    () => ({
      ready,
      db,
      me,
      mutate,
      login: async (email, password) => {
        const user = api.login(dbRef.current, email, await hashPassword(password));
        setSession(user.id);
        return user;
      },
      register: async (input) => {
        api.validateRegister(dbRef.current, input);
        const hash = await hashPassword(input.password);
        const user = mutate((d) => api.register(d, input, hash));
        setSession(user.id);
        return user;
      },
      changePassword: async (current, next) => {
        if (!me) throw new api.ApiError('Oturum bulunamadı.');
        const [c, n] = await Promise.all([hashPassword(current), hashPassword(next)]);
        mutate((d) => api.changePassword(d, me.id, c, n, next.length));
      },
      logout: () => setSession(null),
      resetDemo: async () => {
        commit(await createSeed(hashPassword));
        setSession(null);
      },
    }),
    [ready, db, me, mutate, setSession, commit],
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
