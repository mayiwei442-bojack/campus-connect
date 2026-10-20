type StoredMessage = { id: string; conversation_id: string; created_at: string };

// A history request may finish after a Realtime event or a send acknowledgement.
export function mergeMessageHistory<T extends StoredMessage>(
  conversationId: string,
  history: T[],
  current: T[],
): T[] {
  const messages = new Map<string, T>();
  for (const message of [...history, ...current]) {
    if (message.conversation_id === conversationId) messages.set(message.id, message);
  }
  return [...messages.values()].sort((a, b) =>
    a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
  );
}
