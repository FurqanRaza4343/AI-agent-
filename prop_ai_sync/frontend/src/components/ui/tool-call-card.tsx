import * as React from 'react';
import { cn } from '../../lib/utils';
import { ChevronRight, Check, Loader2, AlertTriangle, Search, FileText, Globe, Terminal, Database } from 'lucide-react';
import type { ToolCallInfo } from '../../useAgentChat';

interface ToolCallCardProps extends ToolCallInfo {
  /** Start expanded. Default: false */
  defaultExpanded?: boolean;
  className?: string;
}

function formatDuration(ms?: number): string {
  if (ms === undefined || ms === null) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/** Pick the best icon for a tool based on its name. */
function getToolIcon(toolName: string) {
  const name = toolName.toLowerCase();
  if (name.includes('search') || name.includes('query')) return Search;
  if (name.includes('read') || name.includes('fetch') || name.includes('get_page')) return FileText;
  if (name.includes('web') || name.includes('browse') || name.includes('url')) return Globe;
  if (name.includes('sql') || name.includes('database') || name.includes('db')) return Database;
  return Terminal;
}

/** Extract the primary argument value to show inline in the collapsed header. */
function getPrimaryArg(args?: Record<string, any>): string | null {
  if (!args || typeof args !== 'object') return null;
  // Common primary arg names in order of priority
  for (const key of ['query', 'url', 'search', 'input', 'prompt', 'command', 'cmd', 'message', 'text', 'name', 'path', 'filename']) {
    if (args[key] && typeof args[key] === 'string') {
      const val = args[key] as string;
      return val.length > 60 ? val.slice(0, 57) + '...' : val;
    }
  }
  // Fallback: first string value
  for (const val of Object.values(args)) {
    if (typeof val === 'string' && val.length > 0) {
      return val.length > 60 ? val.slice(0, 57) + '...' : val;
    }
  }
  return null;
}

/** Render args as formatted key-value pairs instead of raw JSON. */
function ArgsDisplay({ args }: { args: Record<string, any> }) {
  const entries = Object.entries(args).filter(([, v]) => v !== undefined && v !== null);
  if (entries.length === 0) return null;

  return (
    <div className="space-y-1">
      {entries.map(([key, value]) => (
        <div key={key} className="flex gap-2 text-xs">
          <span className="text-muted-foreground shrink-0 font-medium min-w-[60px]">{key}</span>
          <span className="text-foreground break-all">
            {typeof value === 'string'
              ? value
              : typeof value === 'number' || typeof value === 'boolean'
                ? String(value)
                : JSON.stringify(value)}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Smart result rendering — adapts to the shape of the data. */
function ResultDisplay({ result }: { result: any }) {
  const [expanded, setExpanded] = React.useState(false);

  // String result — render as text with truncation
  if (typeof result === 'string') {
    const needsTruncation = result.length > 300;
    const displayText = !expanded && needsTruncation ? result.slice(0, 300) + '...' : result;
    return (
      <div>
        <pre className="text-xs whitespace-pre-wrap break-words text-foreground/80 leading-relaxed">{displayText}</pre>
        {needsTruncation && (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="text-xs text-primary hover:underline mt-1"
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>
    );
  }

  // Array of objects with title/url — render as search results list
  if (Array.isArray(result) && result.length > 0 && result[0] && typeof result[0] === 'object' && ('title' in result[0] || 'url' in result[0])) {
    const items = expanded ? result : result.slice(0, 5);
    return (
      <div className="space-y-1.5">
        {items.map((item: any, i: number) => (
          <div key={i} className="text-xs">
            {item.url ? (
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">
                {item.title || item.url}
              </a>
            ) : (
              <span className="font-medium text-foreground">{item.title || JSON.stringify(item)}</span>
            )}
            {item.snippet && <p className="text-muted-foreground mt-0.5 line-clamp-2">{item.snippet}</p>}
          </div>
        ))}
        {!expanded && result.length > 5 && (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
            className="text-xs text-primary hover:underline"
          >
            Show all {result.length} results
          </button>
        )}
      </div>
    );
  }

  // Array of primitives — render as simple list
  if (Array.isArray(result)) {
    const items = expanded ? result : result.slice(0, 8);
    return (
      <div className="space-y-0.5">
        {items.map((item: any, i: number) => (
          <div key={i} className="text-xs text-foreground/80">
            {typeof item === 'string' ? item : JSON.stringify(item)}
          </div>
        ))}
        {!expanded && result.length > 8 && (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
            className="text-xs text-primary hover:underline"
          >
            Show all {result.length} items
          </button>
        )}
      </div>
    );
  }

  // Object — render as key-value pairs
  if (typeof result === 'object' && result !== null) {
    const entries = Object.entries(result);
    if (entries.length <= 6) {
      return <ArgsDisplay args={result} />;
    }
    // Large objects fall back to formatted JSON
    const formatted = JSON.stringify(result, null, 2);
    const lines = formatted.split('\n');
    const displayText = !expanded && lines.length > 10 ? lines.slice(0, 10).join('\n') + '\n...' : formatted;
    return (
      <div>
        <pre className="text-xs whitespace-pre-wrap break-all text-foreground/80 leading-relaxed">{displayText}</pre>
        {lines.length > 10 && (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="text-xs text-primary hover:underline mt-1"
          >
            {expanded ? 'Show less' : `Show all (${lines.length} lines)`}
          </button>
        )}
      </div>
    );
  }

  // Primitive fallback
  return <span className="text-xs text-foreground/80">{String(result)}</span>;
}

export function ToolCallCard({
  tool,
  args,
  result,
  durationMs,
  status,
  defaultExpanded = false,
  className,
}: ToolCallCardProps) {
  const [expanded, setExpanded] = React.useState(defaultExpanded);

  const statusConfig = {
    pending: {
      icon: Loader2,
      color: 'text-amber-600 dark:text-amber-400',
      borderColor: 'border-border/60',
      animate: true,
    },
    success: {
      icon: Check,
      color: 'text-emerald-600 dark:text-emerald-400',
      borderColor: 'border-border/60',
      animate: false,
    },
    error: {
      icon: AlertTriangle,
      color: 'text-red-600 dark:text-red-400',
      borderColor: 'border-red-200 dark:border-red-800/50',
      animate: false,
    },
  };

  const config = statusConfig[status] || statusConfig.pending;
  const StatusIcon = config.icon;
  const ToolIcon = getToolIcon(tool);
  const primaryArg = getPrimaryArg(args);

  return (
    <div className={cn('rounded-lg border text-sm transition-colors bg-muted/30', config.borderColor, className)}>
      {/* Collapsed header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 rounded-lg transition-colors"
      >
        <ToolIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="font-medium text-foreground">{tool}</span>
        {primaryArg && (
          <span className="text-muted-foreground truncate text-xs italic">"{primaryArg}"</span>
        )}
        <span className="ml-auto flex items-center gap-1.5 shrink-0">
          {durationMs !== undefined && durationMs > 0 && (
            <span className="text-xs text-muted-foreground">{formatDuration(durationMs)}</span>
          )}
          <StatusIcon className={cn('h-3.5 w-3.5', config.color, config.animate && 'animate-spin')} />
          <ChevronRight className={cn('h-3 w-3 text-muted-foreground transition-transform', expanded && 'rotate-90')} />
        </span>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-border/40 pt-2 mt-0">
          {args && Object.keys(args).length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Input</div>
              <ArgsDisplay args={args} />
            </div>
          )}
          {result !== undefined && (
            <div>
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Output</div>
              <ResultDisplay result={result} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
