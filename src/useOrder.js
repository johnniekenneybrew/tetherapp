import { useState, useCallback, useRef, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { prefsApi } from './api';

function applyOrder(orderIds, items) {
  if (!orderIds || !orderIds.length) return items;
  const map = {};
  for (const x of items) map[x.id] = x;
  const ordered = orderIds.map(id => map[id]).filter(Boolean);
  const extra = items.filter(x => !orderIds.includes(x.id));
  return [...ordered, ...extra];
}

export function useOrder(storageKey, items) {
  const { user } = useUser();
  const userId = user?.id || "";
  const scopedKey = userId ? `${userId}_${storageKey}` : storageKey;
  const scopedKeyRef = useRef(scopedKey);
  scopedKeyRef.current = scopedKey;
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  // Init from localStorage for instant render
  const [orderIds, setOrderIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem(scopedKey)) || null; }
    catch { return null; }
  });

  // Sync from Notion on mount — cross-device source of truth
  useEffect(() => {
    if (!userId) return;
    prefsApi.get(storageKey, userId)
      .then(({ value }) => {
        if (value && Array.isArray(value)) {
          try { localStorage.setItem(scopedKeyRef.current, JSON.stringify(value)); } catch {}
          setOrderIds(value);
        }
      })
      .catch(() => {});
  }, [storageKey, userId]);

  const ordered = applyOrder(orderIds, items);

  const reorder = useCallback((fromId, toId) => {
    if (fromId === toId) return;
    setOrderIds(prev => {
      const ids = applyOrder(prev, items).map(x => x.id);
      const from = ids.indexOf(fromId);
      const to = ids.indexOf(toId);
      if (from === -1 || to === -1) return prev;
      const next = [...ids];
      next.splice(from, 1);
      next.splice(to, 0, fromId);
      // Save locally for instant feedback
      try { localStorage.setItem(scopedKeyRef.current, JSON.stringify(next)); } catch {}
      // Save to Notion for cross-device sync
      const uid = userIdRef.current;
      if (uid) prefsApi.set(storageKey, next, uid).catch(console.error);
      return next;
    });
  }, [items, storageKey]);

  return { ordered, reorder };
}
