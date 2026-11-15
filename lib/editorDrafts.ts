// Memory-only recovery for marks when browser Back unmounts an editor. Never persisted to disk.
const drafts = new Map<string, string>();
export const readEditorDraft = (key: string) => drafts.get(key);
export const writeEditorDraft = (key: string, value: string | null) => { if(value === null) drafts.delete(key); else drafts.set(key,value); };
export const clearEditorDrafts = () => drafts.clear();
