import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../auth/auth.store';
import { readAssistantConversation, saveAssistantConversation, type ConversationDraft, type AssistantMessage } from './assistant-conversation.storage';

type Transcript = { owner: string; token: string; ready: boolean; messages: AssistantMessage[] };
const emptyMessages: AssistantMessage[] = [];
const emptyDraft: ConversationDraft = { text: '', preview: null, feedback: '', stalePreview: false };

export function useAssistantConversation(snapshot: ConversationDraft, restore: (value: ConversationDraft) => void) {
  const owner = useAuthStore(state => state.profile?.id);
  const token = useAuthStore(state => state.token);
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [storageError, setStorageError] = useState(false);
  const edits = useRef(0);
  const saved = useRef(snapshot); saved.current = snapshot;
  const onRestore = useRef(restore); onRestore.current = restore;
  const current = () => useAuthStore.getState().profile?.id === owner && useAuthStore.getState().token === token;
  const hasScope = (value: Transcript | null): value is Transcript =>
    value !== null && value.owner === owner && value.token === token;
  const messages = hasScope(transcript) ? transcript.messages : emptyMessages;
  const ready = hasScope(transcript) && transcript.ready;
  useEffect(() => {
    let active = true;
    const version = edits.current;
    setStorageError(false);
    if (!owner || !token) { setTranscript(null); return; }
    setTranscript({ owner, token, ready: false, messages: [] });
    void readAssistantConversation(owner, () => active && current()).then(value => {
      if (!active || !current()) return;
      setTranscript(existing => hasScope(existing)
        ? { ...existing, ready: true, messages: value ? [...value.messages, ...existing.messages] : existing.messages }
        : existing);
      if (version === edits.current) onRestore.current(value ?? emptyDraft);
    }).catch(() => { if (active && current()) setStorageError(true); });
    return () => { active = false; };
  }, [owner, token]);
  const serialized = JSON.stringify(snapshot);
  useEffect(() => {
    if (!ready || !owner || !token || !current()) return;
    void saveAssistantConversation(owner, { ...saved.current, messages }, current).catch(() => {
      if (current()) setStorageError(true);
    });
  }, [serialized, messages, ready, owner, token]);
  return {
    messages, storageError,
    edited: () => { edits.current++; },
    append: (role: 'user' | 'assistant', text: string) => {
      if (!text.trim() || !current() || !owner || !token) return;
      edits.current++;
      setTranscript(existing => {
        const previous = hasScope(existing) ? existing : { owner, token, ready: false, messages: [] };
        const latest = previous.messages.at(-1);
        if (role === 'user' && latest?.role === role && latest.text === text) return previous;
        return { ...previous, messages: [...previous.messages, { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, role, text }] };
      });
    },
  };
}
