// src/useAgentChat.ts - Agent conversation state management hook.
import { useState, useCallback, useRef, useEffect } from 'react';
import { streamCall } from './api';

// --- Types ---

export type ToolCallStatus = 'pending' | 'success' | 'error';

export interface ToolCallInfo {
  callId: string;
  tool: string;
  args: Record<string, any>;
  result?: any;
  durationMs?: number;
  status: ToolCallStatus;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  toolCalls?: ToolCallInfo[];
  thinking?: string;
  isStreaming?: boolean;
  status?: string;
}

export interface UseAgentChatOptions {
  /** Backend streaming function name. Default: "chat_streaming" */
  streamFunc?: string;
  /** Optional conversation ID for persistent conversations */
  conversationId?: string;
  /** Pre-populate messages (e.g., loaded conversation history). When this reference
   *  changes the hook replaces its internal messages array with the new value. */
  initialMessages?: ChatMessage[];
  /** Called after a complete assistant response. Use for persistence (save to DB),
   *  cache invalidation, or sidebar updates. */
  onMessageComplete?: (userMessage: string, assistantMessage: string, conversationId?: string) => void;
  /** Called when an error occurs */
  onError?: (error: Error) => void;
}

export interface UseAgentChatReturn {
  messages: ChatMessage[];
  /** Direct state setter — use to externally reset messages (e.g., on conversation switch) */
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  sendMessage: (text: string) => Promise<void>;
  isStreaming: boolean;
  stopGeneration: () => void;
  error: string | null;
  clearMessages: () => void;
}

// --- Hook ---

let idCounter = 0;
function generateId(): string {
  return `msg_${Date.now()}_${++idCounter}`;
}

export function useAgentChat(options: UseAgentChatOptions = {}): UseAgentChatReturn {
  const {
    streamFunc = 'chat_streaming',
    conversationId,
    initialMessages,
    onMessageComplete,
    onError,
  } = options;

  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages || []);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bufferRef = useRef<string>('');
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assistantIdRef = useRef<string>('');
  const lastUserMessageRef = useRef<string>('');
  const messageCompleteCalledRef = useRef<boolean>(false);

  // Sync with initialMessages when the reference changes (conversation switch)
  useEffect(() => {
    if (initialMessages) {
      setMessages(initialMessages);
    }
  }, [initialMessages]);

  // Flush buffered text to the current assistant message
  const flushBuffer = useCallback(() => {
    const buffered = bufferRef.current;
    if (!buffered || !assistantIdRef.current) return;
    bufferRef.current = '';

    setMessages(prev => prev.map(msg =>
      msg.id === assistantIdRef.current
        ? { ...msg, content: msg.content + buffered }
        : msg
    ));
  }, []);

  // Schedule a buffered flush (coalesces rapid deltas)
  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current) return; // already scheduled
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;
      flushBuffer();
    }, 50);
  }, [flushBuffer]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;

    setError(null);
    setIsStreaming(true);
    lastUserMessageRef.current = text.trim();
    messageCompleteCalledRef.current = false;

    // Add user message
    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: text.trim(),
      timestamp: Date.now(),
    };

    // Add placeholder assistant message
    const assistantId = generateId();
    assistantIdRef.current = assistantId;
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      toolCalls: [],
      isStreaming: true,
    };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    bufferRef.current = '';

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      await streamCall({
        func: streamFunc,
        args: {
          message: text.trim(),
          ...(conversationId ? { conversation_id: conversationId } : {}),
        },
        onChunk: (chunk: any) => {
          if (abortController.signal.aborted) return;

          const type = chunk.type;

          // Legacy chunk (no type field) — treat as status
          if (!type) {
            const statusText = chunk.status || chunk.content || '';
            if (statusText) {
              setMessages(prev => prev.map(msg =>
                msg.id === assistantId
                  ? { ...msg, status: statusText }
                  : msg
              ));
            }
            return;
          }

          switch (type) {
            case 'status':
              setMessages(prev => prev.map(msg =>
                msg.id === assistantId
                  ? { ...msg, status: chunk.content || '' }
                  : msg
              ));
              break;

            case 'thinking':
              setMessages(prev => prev.map(msg =>
                msg.id === assistantId
                  ? { ...msg, thinking: (msg.thinking || '') + (chunk.content || '') }
                  : msg
              ));
              break;

            case 'tool_call':
              setMessages(prev => prev.map(msg => {
                if (msg.id !== assistantId) return msg;
                const tc: ToolCallInfo = {
                  callId: chunk.call_id || '',
                  tool: chunk.tool || '',
                  args: chunk.args || {},
                  status: 'pending',
                };
                return { ...msg, toolCalls: [...(msg.toolCalls || []), tc] };
              }));
              break;

            case 'tool_result':
              setMessages(prev => prev.map(msg => {
                if (msg.id !== assistantId) return msg;
                const updatedCalls = (msg.toolCalls || []).map(tc =>
                  tc.callId === chunk.call_id
                    ? {
                        ...tc,
                        result: chunk.result,
                        durationMs: chunk.duration_ms,
                        status: (chunk.status || 'success') as ToolCallStatus,
                      }
                    : tc
                );
                return { ...msg, toolCalls: updatedCalls };
              }));
              break;

            case 'message':
              // Buffer incremental text for smooth rendering
              if (chunk.delta) {
                bufferRef.current += chunk.content || '';
                scheduleFlush();
              } else {
                // Non-delta message: set content directly
                flushBuffer();
                setMessages(prev => prev.map(msg =>
                  msg.id === assistantId
                    ? { ...msg, content: chunk.content || '' }
                    : msg
                ));
              }
              break;

            case 'message_complete': {
              // Flush any remaining buffer, then set final content
              bufferRef.current = '';
              if (flushTimerRef.current) {
                clearTimeout(flushTimerRef.current);
                flushTimerRef.current = null;
              }
              const assistantContent = chunk.content || '';
              setMessages(prev => prev.map(msg =>
                msg.id === assistantId
                  ? { ...msg, content: assistantContent, isStreaming: false }
                  : msg
              ));
              // Fire onMessageComplete callback
              if (!messageCompleteCalledRef.current) {
                messageCompleteCalledRef.current = true;
                onMessageComplete?.(lastUserMessageRef.current, assistantContent, conversationId);
              }
              break;
            }

            case 'error':
              setError(chunk.content || 'An error occurred');
              setMessages(prev => prev.map(msg =>
                msg.id === assistantId
                  ? { ...msg, isStreaming: false }
                  : msg
              ));
              break;

            case 'done':
              // Flush any remaining buffer
              if (bufferRef.current) {
                flushBuffer();
              }
              if (flushTimerRef.current) {
                clearTimeout(flushTimerRef.current);
                flushTimerRef.current = null;
              }
              setMessages(prev => {
                const updated = prev.map(msg =>
                  msg.id === assistantId
                    ? { ...msg, isStreaming: false }
                    : msg
                );
                // If message_complete was never received, fire onMessageComplete with accumulated content
                if (!messageCompleteCalledRef.current) {
                  messageCompleteCalledRef.current = true;
                  const assistantMsg = updated.find(m => m.id === assistantId);
                  if (assistantMsg && assistantMsg.content) {
                    onMessageComplete?.(lastUserMessageRef.current, assistantMsg.content, conversationId);
                  }
                }
                return updated;
              });
              break;

            default:
              // Unknown event type — ignore gracefully
              console.log('[AGENT_CHAT] Unknown event type:', type);
              break;
          }
        },
        onError: (err: Error) => {
          setError(err.message);
          onError?.(err);
        },
      });
    } catch (err: any) {
      if (!abortController.signal.aborted) {
        setError(err.message || 'Stream failed');
        onError?.(err);
      }
    } finally {
      // Ensure streaming state is cleaned up
      setIsStreaming(false);
      abortRef.current = null;
      assistantIdRef.current = '';
      // Final flush
      if (bufferRef.current) {
        flushBuffer();
      }
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      // Mark any still-streaming message as done
      setMessages(prev => prev.map(msg =>
        msg.isStreaming ? { ...msg, isStreaming: false } : msg
      ));
    }
  }, [isStreaming, streamFunc, conversationId, onError, onMessageComplete, scheduleFlush, flushBuffer]);

  const stopGeneration = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsStreaming(false);
    // Mark current assistant message as not streaming
    setMessages(prev => prev.map(msg =>
      msg.isStreaming ? { ...msg, isStreaming: false } : msg
    ));
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    setMessages,
    sendMessage,
    isStreaming,
    stopGeneration,
    error,
    clearMessages,
  };
}
