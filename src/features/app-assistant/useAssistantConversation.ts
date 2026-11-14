import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../auth/auth.store';
import { readAssistantConversation, saveAssistantConversation, clearAssistantConversation, type ConversationDraft, type AssistantMessage } from './assistant-conversation.storage';

export function useAssistantConversation(snapshot: ConversationDraft, restore: (value: ConversationDraft) => void) {
  const owner = useAuthStore(state => state.profile?.id);
  const token = useAuthStore(state => state.token);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [storageError, setStorageError] = useState(false);
  const [ready, setReady] = useState(false);
  const edits = useRef(0);
  const loadGeneration = useRef(0);
  const saved = useRef(snapshot); saved.current = snapshot;
  const onRestore = useRef(restore); onRestore.current = restore;
  const current = () => useAuthStore.getState().profile?.id === owner && useAuthStore.getState().token === token;
  useEffect(() => {
    let active = true;
    const generation = ++loadGeneration.current;
    const version = edits.current;
    setReady(false); setMessages([]); setStorageError(false);
    if (!owner || !token) return;
    void readAssistantConversation(owner, () => active && current()).then(value => {
      if (!active || !current() || generation !== loadGeneration.current) return;
      if (value) {
        setMessages(existing => [...value.messages, ...existing].slice(-24));
        if (version === edits.current) onRestore.current(value);
      }
      setReady(true);
    }).catch(() => { if (active && current()) { setStorageError(true); setReady(false); } });
    return () => { active = false; };
  }, [owner, token]);
  const serialized = JSON.stringify({ ...snapshot, messages });
  useEffect(() => {
    if (!ready || !owner || !token || !current()) return;
    void saveAssistantConversation(owner, { ...saved.current, messages }, current).catch(() => {
      if (current()) setStorageError(true);
    });
  }, [serialized, ready, owner, token]);
  return {
    messages, storageError,
    edited: () => { edits.current++; },
    append: (role: 'user' | 'assistant', text: string) => {
      if (!text.trim()) return;
      edits.current++;
      setMessages(previous => role === 'user' && previous.at(-1)?.role === role && previous.at(-1)?.text === text ? previous
        : [...previous, { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, role, text }].slice(-24));
    },
    clear: async () => {
      edits.current++; loadGeneration.current++;
      if (owner) await clearAssistantConversation(owner);
      if (current()) { setMessages([]); setReady(true); }
    },
  };
}
