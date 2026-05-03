import * as React from 'react';
import { cn } from '../../lib/utils';
import { ToolCallCard } from './tool-call-card';
import type { ChatMessage as ChatMessageType } from '../../useAgentChat';
import { ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatMessageProps extends ChatMessageType {
  /** Whether to show tool calls inline within the message. Default: true */
  showToolCallsInline?: boolean;
  className?: string;
}

/** Custom markdown component overrides for well-formatted AI responses. */
const markdownComponents: Record<string, React.FC<any>> = {
  p: ({ node, ...props }: any) => <p {...props} className="mb-3 last:mb-0 leading-relaxed" />,
  h1: ({ node, ...props }: any) => <h1 {...props} className="text-xl font-bold mt-5 mb-2" />,
  h2: ({ node, ...props }: any) => <h2 {...props} className="text-lg font-semibold mt-4 mb-2" />,
  h3: ({ node, ...props }: any) => <h3 {...props} className="text-base font-semibold mt-3 mb-1.5" />,
  h4: ({ node, ...props }: any) => <h4 {...props} className="text-sm font-semibold mt-2 mb-1" />,
  ul: ({ node, ...props }: any) => <ul {...props} className="list-disc pl-5 mb-3 last:mb-0 space-y-1" />,
  ol: ({ node, ...props }: any) => <ol {...props} className="list-decimal pl-5 mb-3 last:mb-0 space-y-1" />,
  li: ({ node, ...props }: any) => <li {...props} className="leading-relaxed" />,
  blockquote: ({ node, ...props }: any) => (
    <blockquote {...props} className="border-l-4 border-primary/40 pl-4 py-1 my-3 bg-muted/30 rounded-r-md italic text-muted-foreground" />
  ),
  hr: ({ node, ...props }: any) => <hr {...props} className="my-4 border-t border-border" />,
  a: ({ node, href, children, ...props }: any) => (
    <a {...props} href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
      {children}
    </a>
  ),
  table: ({ node, ...props }: any) => (
    <div className="my-3 overflow-x-auto rounded-lg border border-border">
      <table {...props} className="w-full border-collapse text-sm" />
    </div>
  ),
  thead: ({ node, ...props }: any) => <thead {...props} className="bg-muted/50" />,
  th: ({ node, ...props }: any) => (
    <th {...props} className="border-b border-border px-3 py-2 text-left font-semibold text-foreground" />
  ),
  td: ({ node, ...props }: any) => (
    <td {...props} className="border-b border-border/50 px-3 py-2 text-foreground" />
  ),
  tr: ({ node, ...props }: any) => <tr {...props} className="hover:bg-muted/30 transition-colors" />,
  code: ({ node, className, children, ...props }: any) => {
    const match = /language-(\w+)/.exec(className || '');
    const codeString = String(children).replace(/\n$/, '');
    const isBlock = !!match || codeString.includes('\n');

    if (isBlock) {
      return <code className={className} {...props}>{children}</code>;
    }
    // Inline code
    return (
      <code {...props} className="bg-muted/70 text-orange-600 dark:text-orange-400 px-1.5 py-0.5 rounded text-[0.85em] font-mono border border-border/30">
        {children}
      </code>
    );
  },
  pre: ({ node, children, ...props }: any) => {
    return (
      <pre {...props} className="my-3 p-4 bg-muted/40 rounded-lg overflow-x-auto border border-border/50 text-sm font-mono leading-relaxed">
        {children}
      </pre>
    );
  },
};

function MarkdownContent({ content }: { content: string }) {
  try {
    return (
      <div className="text-sm text-foreground">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {content || ''}
        </ReactMarkdown>
      </div>
    );
  } catch {
    return <pre className="whitespace-pre-wrap text-sm leading-relaxed">{content}</pre>;
  }
}

function ThinkingBlock({ content }: { content: string }) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <button
      onClick={() => setExpanded(!expanded)}
      className="w-full text-left mb-3 rounded-lg bg-muted/50 border border-border/50 px-3 py-2 text-xs text-muted-foreground hover:bg-muted/70 transition-colors"
    >
      <div className="flex items-center gap-1.5">
        <ChevronDown className={cn('h-3 w-3 transition-transform', expanded && 'rotate-180')} />
        <span className="font-medium">Thinking</span>
      </div>
      {expanded && (
        <pre className="mt-2 whitespace-pre-wrap text-xs opacity-80">{content}</pre>
      )}
    </button>
  );
}

export function ChatMessage({
  role,
  content,
  toolCalls,
  thinking,
  isStreaming,
  status,
  showToolCallsInline = true,
  className,
}: ChatMessageProps) {
  const isUser = role === 'user';

  // User messages: right-aligned bubble with primary color
  if (isUser) {
    return (
      <div className={cn('flex justify-end', className)}>
        <div className="max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-3 bg-primary text-primary-foreground">
          <p className="text-sm whitespace-pre-wrap">{content}</p>
        </div>
      </div>
    );
  }

  // Assistant messages: full-width, no bubble — content renders directly
  return (
    <div className={cn('w-full', className)}>
      {/* Thinking block */}
      {thinking && <ThinkingBlock content={thinking} />}

      {/* Status indicator */}
      {status && !content && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-1">
          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          <span>{status}</span>
        </div>
      )}

      {/* Message content — rendered as markdown, no bounding box */}
      {content && <MarkdownContent content={content} />}

      {/* Streaming cursor */}
      {isStreaming && !content && !status && (
        <div className="flex items-center gap-1 py-2">
          <div className="h-2 w-2 rounded-full bg-foreground/40 animate-pulse" />
          <div className="h-2 w-2 rounded-full bg-foreground/40 animate-pulse [animation-delay:150ms]" />
          <div className="h-2 w-2 rounded-full bg-foreground/40 animate-pulse [animation-delay:300ms]" />
        </div>
      )}

      {/* Inline tool calls */}
      {showToolCallsInline && toolCalls && toolCalls.length > 0 && (
        <div className="my-3 space-y-2">
          {toolCalls.map(tc => (
            <ToolCallCard key={tc.callId} {...tc} />
          ))}
        </div>
      )}
    </div>
  );
}
