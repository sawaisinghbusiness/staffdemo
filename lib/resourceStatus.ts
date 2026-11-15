type Failure = { path: string; hasData: boolean; status: number; retry: () => Promise<unknown> };
const entries = new Map<symbol, Failure>();
const listeners = new Set<() => void>();
let revision = 0;
const notify = () => { revision++; listeners.forEach(fn => fn()); };
export function setResourceFailure(key: symbol, failure: Failure | null) {
  if (failure) entries.set(key, failure); else if (!entries.delete(key)) return;
  notify();
}
export const subscribeResources = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const resourceRevision = () => revision;
export const resourceFailures = () => [...new Map([...entries.values()].filter(x => x.hasData && x.status !== 401).map(x => [x.path, x])).values()];
