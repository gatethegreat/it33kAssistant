import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <h1 className="text-[15px] font-semibold text-[var(--text-primary)] mt-4 mb-2">{children}</h1>,
        h2: ({ children }) => <h2 className="text-[14px] font-semibold text-[var(--text-primary)] mt-4 mb-2">{children}</h2>,
        h3: ({ children }) => <h3 className="text-[13px] font-semibold text-[var(--text-primary)] mt-3 mb-1.5">{children}</h3>,
        h4: ({ children }) => <h4 className="text-[13px] font-medium text-[var(--text-secondary)] mt-2 mb-1">{children}</h4>,
        p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold text-[var(--text-primary)]">{children}</strong>,
        em: ({ children }) => <em className="italic text-[var(--text-secondary)]">{children}</em>,
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-[var(--accent-text)] hover:underline underline-offset-2">
            {children}
          </a>
        ),
        ul: ({ children }) => <ul className="list-disc list-outside pl-5 mb-2 space-y-0.5">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-outside pl-5 mb-2 space-y-0.5">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        code: ({ className, children }) => {
          const isBlock = className?.includes("language-");
          if (isBlock) {
            return (
              <code className="block text-[12px] font-mono text-[var(--text-secondary)]">{children}</code>
            );
          }
          return (
            <code className="rounded-md bg-[var(--bg-elevated)] px-1.5 py-0.5 text-[12px] font-mono text-[var(--text-secondary)]">{children}</code>
          );
        },
        pre: ({ children }) => (
          <pre className="rounded-md bg-[var(--bg-base)] border border-[var(--border-subtle)] p-3 mb-2 overflow-x-auto text-[12px]">
            {children}
          </pre>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-[var(--border-strong)] pl-3 my-2 text-[var(--text-tertiary)] italic">{children}</blockquote>
        ),
        hr: () => <hr className="border-[var(--border-subtle)] my-3" />,
        table: ({ children }) => (
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[12px] border-collapse">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead className="border-b border-[var(--border-default)]">{children}</thead>,
        th: ({ children }) => <th className="text-left px-2 py-1.5 font-medium text-[var(--text-primary)]">{children}</th>,
        td: ({ children }) => <td className="px-2 py-1.5 border-t border-[var(--border-subtle)] text-[var(--text-tertiary)]">{children}</td>,
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
