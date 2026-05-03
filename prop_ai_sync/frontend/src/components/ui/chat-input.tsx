import * as React from 'react';
import { cn } from '../../lib/utils';
import { Send, Square } from 'lucide-react';

interface ChatInputProps {
  /** Called when the user submits a message */
  onSend: (text: string) => void;
  /** Whether the agent is currently streaming */
  isStreaming?: boolean;
  /** Called when the user clicks the stop button */
  onStop?: () => void;
  /** Placeholder text */
  placeholder?: string;
  /** Disable the input entirely */
  disabled?: boolean;
  className?: string;
}

export function ChatInput({
  onSend,
  isStreaming = false,
  onStop,
  placeholder = 'Type a message...',
  disabled = false,
  className,
}: ChatInputProps) {
  const [value, setValue] = React.useState('');
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  React.useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }, [value]);

  const handleSubmit = React.useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isStreaming || disabled) return;
    onSend(trimmed);
    setValue('');
    // Reset height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, isStreaming, disabled, onSend]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  return (
    <div className={cn('flex items-end gap-2', className)}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled || isStreaming}
        rows={1}
        className={cn(
          'flex-1 resize-none overflow-hidden rounded-xl border border-input bg-background px-4 py-3 text-sm',
          'placeholder:text-muted-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'min-h-[44px] max-h-[200px]',
        )}
      />
      {isStreaming ? (
        <button
          onClick={onStop}
          className={cn(
            'shrink-0 h-11 w-11 rounded-xl flex items-center justify-center',
            'bg-destructive text-destructive-foreground',
            'hover:bg-destructive/90 transition-colors',
          )}
          title="Stop generating"
        >
          <Square className="h-4 w-4" />
        </button>
      ) : (
        <button
          onClick={handleSubmit}
          disabled={!value.trim() || disabled}
          className={cn(
            'shrink-0 h-11 w-11 rounded-xl flex items-center justify-center',
            'bg-primary text-primary-foreground',
            'hover:bg-primary/90 transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
          title="Send message"
        >
          <Send className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
