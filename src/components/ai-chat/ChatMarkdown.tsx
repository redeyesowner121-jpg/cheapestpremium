import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check, ArrowRight, ExternalLink } from 'lucide-react';

export const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="absolute top-2 right-2 p-1 rounded bg-background/80 hover:bg-background text-muted-foreground hover:text-foreground transition-colors z-10"
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
};

export const StreamingCursor = () => (
  <span className="inline-block w-[2px] h-4 bg-primary ml-0.5 animate-pulse align-text-bottom" />
);

export const MarkdownContent = React.memo(({ content, onNavigate }: { content: string; onNavigate?: (path: string) => void }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      a: ({ href, children }) => {
        const isInternal = href && (
          href.includes('cheapest-premiums.in/products/') ||
          href.includes('cheapest-premiums.in/product/') ||
          href.includes('cheapest-premiums.lovable.app/products/') ||
          href.includes('cheapest-premiums.lovable.app/product/')
        );
        
        if (isInternal && onNavigate) {
          const url = new URL(href);
          const path = url.pathname;
          return (
            <button
              onClick={() => onNavigate(path)}
              className="inline-flex items-center gap-1 text-primary underline font-semibold hover:opacity-80 bg-primary/5 px-1.5 py-0.5 rounded-md border border-primary/15 transition-all hover:bg-primary/10"
            >
              🔗 {children}
              <ArrowRight className="w-3 h-3 inline" />
            </button>
          );
        }
        
        return (
          <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-primary underline font-medium hover:opacity-80">
            {children}
            <ExternalLink className="w-3 h-3 inline" />
          </a>
        );
      },
      strong: ({ children }) => <strong className="font-bold text-foreground">{children}</strong>,
      em: ({ children }) => <em className="italic">{children}</em>,
      h1: ({ children }) => <h1 className="text-base font-bold mb-2 mt-3 first:mt-0 text-foreground">{children}</h1>,
      h2: ({ children }) => <h2 className="text-sm font-bold mb-1.5 mt-2.5 first:mt-0 text-foreground">{children}</h2>,
      h3: ({ children }) => <h3 className="text-sm font-semibold mb-1 mt-2 first:mt-0 text-foreground">{children}</h3>,
      ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
      ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
      li: ({ children }) => <li className="text-sm leading-relaxed">{children}</li>,
      p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
      code: ({ className, children, ...props }) => {
        const isInline = !className;
        if (isInline) {
          return <code className="bg-muted px-1.5 py-0.5 rounded-md text-xs font-mono text-primary">{children}</code>;
        }
        return <code className={className} {...props}>{children}</code>;
      },
      pre: ({ children }) => {
        const codeText = (children as any)?.props?.children || '';
        return (
          <pre className="relative group/code bg-muted/80 rounded-lg border border-border/50 my-2 p-3 overflow-x-auto text-xs">
            <CopyButton text={String(codeText)} />
            {children}
          </pre>
        );
      },
      table: ({ children }) => (
        <div className="overflow-x-auto my-2">
          <table className="w-full text-xs border-collapse border border-border/50 rounded-lg overflow-hidden">{children}</table>
        </div>
      ),
      thead: ({ children }) => <thead className="bg-muted/60">{children}</thead>,
      th: ({ children }) => <th className="border border-border/50 px-2.5 py-1.5 text-left font-semibold text-foreground">{children}</th>,
      td: ({ children }) => <td className="border border-border/50 px-2.5 py-1.5">{children}</td>,
      blockquote: ({ children }) => (
        <blockquote className="border-l-3 border-primary/40 pl-3 my-2 italic text-muted-foreground bg-primary/5 py-1 rounded-r-md">{children}</blockquote>
      ),
      hr: () => <hr className="my-3 border-border/40" />,
    }}
  >
    {content}
  </ReactMarkdown>
));
MarkdownContent.displayName = 'MarkdownContent';
