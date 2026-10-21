// components/chat/Markdown.tsx — renders an AI reply. react-markdown never
// renders raw HTML from the text, so a reply can't inject markup or scripts.
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const components: Components = {
  p: (props) => <p className="mb-3 last:mb-0" {...props} />,
  ul: (props) => <ul className="mb-3 list-disc space-y-1 pl-5 last:mb-0" {...props} />,
  ol: (props) => <ol className="mb-3 list-decimal space-y-1 pl-5 last:mb-0" {...props} />,
  h1: (props) => <h3 className="mb-2 mt-4 text-base font-semibold first:mt-0" {...props} />,
  h2: (props) => <h3 className="mb-2 mt-4 text-base font-semibold first:mt-0" {...props} />,
  h3: (props) => <h4 className="mb-2 mt-3 font-semibold first:mt-0" {...props} />,
  a: (props) => <a className="underline underline-offset-2" target="_blank" rel="noreferrer" {...props} />,
  blockquote: (props) => <blockquote className="mb-3 border-l-2 pl-3 text-muted-foreground" {...props} />,
  pre: (props) => <pre className="mb-3 overflow-x-auto rounded-lg bg-muted p-3 text-xs last:mb-0" {...props} />,
  code: ({ className, ...props }) =>
    // Fenced blocks get a language-* class; inline code doesn't.
    className ? <code className={className} {...props} /> : <code className="rounded bg-muted px-1 py-0.5 text-[0.9em]" {...props} />,
  table: (props) => (
    <div className="mb-3 overflow-x-auto">
      <table className="w-full border-collapse text-left text-xs" {...props} />
    </div>
  ),
  th: (props) => <th className="border-b px-2 py-1 font-semibold" {...props} />,
  td: (props) => <td className="border-b px-2 py-1" {...props} />,
};

export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {children}
    </ReactMarkdown>
  );
}
