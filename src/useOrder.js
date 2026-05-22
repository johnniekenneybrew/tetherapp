import { useState, useCallback, useRef } from 'react';
import { useUser } from '@clerk/clerk-react';

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
  const scopedKey = user?.id ? `${user.id}_${storageKey}` : storageKey;
  const scopedKeyRef = useRef(scopedKey);
  scopedKeyRef.current = scopedKey;

  const [orderIds, setOrderIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem(scopedKey)) || null; }
    catch { return null; }
  });

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
      try { localStorage.setItem(scopedKeyRef.current, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [items, storageKey]);

  return { ordered, reorder };
}
