import React, { useState } from "react";
import { Copy, Check, Code } from "lucide-react";

interface Block {
  type: "code" | "text";
  content: string;
  language?: string;
}

// Safely highlight code blocks using high-speed, well-formed regex tokenization
function getHighlightedCodeHTML(code: string, language: string): string {
  const lines = code.split("\n");
  const escapedLines = lines.map((line) => {
    // 1. Escaping HTML to satisfy safety constraints and prevent broken page trees
    let escaped = line
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    const lowerLang = language.toLowerCase();
    
    // Skip highlighting if plaintext
    if (lowerLang === "plaintext" || lowerLang === "" || lowerLang === "text") {
      return escaped;
    }

    // Protect single-line comments first to avoid formatting rules touching them
    let commentPlaceholder: string | null = null;
    const commentRegex = /(\/\/.*|#.*|\/\*[\s\S]*?\*\/)/;
    const commentMatch = escaped.match(commentRegex);
    if (commentMatch) {
      commentPlaceholder = commentMatch[0];
      escaped = escaped.replace(commentRegex, "___COMMENT_PLACEHOLDER___");
    }

    // Apply regex highlighting tokens
    // Protect strings
    const stringList: string[] = [];
    escaped = escaped.replace(/(["'])(.*?)\1/g, (match) => {
      stringList.push(match);
      return `___STRING_${stringList.length - 1}___`;
    });

    // Keywords
    escaped = escaped.replace(
      /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|import|export|from|class|extends|new|this|typeof|instanceof|in|of|await|async|try|catch|finally|throw|default|interface|type|public|private|protected|package|null|undefined)\b/g,
      '<span class="syntax-keyword">$1</span>'
    );

    // Booleans
    escaped = escaped.replace(/\b(true|false)\b/g, '<span class="syntax-boolean">$1</span>');

    // Numbers
    escaped = escaped.replace(/\b(\d+)\b/g, '<span class="syntax-number">$1</span>');

    // Builtins & Types
    escaped = escaped.replace(
      /\b(console|window|document|process|Array|Object|String|Number|Boolean|Set|Map|Promise|any|void|unknown|never|Record|string|number|boolean|list|dict|def|import|from|as|print|elif|try|except|with)\b/g,
      '<span class="syntax-builtin">$1</span>'
    );

    // Functions
    escaped = escaped.replace(/\b(\w+)(?=\()/g, '<span class="syntax-function">$1</span>');

    // Restore strings
    stringList.forEach((str, idx) => {
      escaped = escaped.replace(`___STRING_${idx}___`, `<span class="syntax-string">${str}</span>`);
    });

    // Restore comments
    if (commentPlaceholder) {
      escaped = escaped.replace("___COMMENT_PLACEHOLDER___", `<span class="syntax-comment">${commentPlaceholder}</span>`);
    }

    return escaped;
  });

  return escapedLines.join("\n");
}

interface CodeBlockProps {
  code: string;
  language: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ code, language }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  const highlightedHTML = getHighlightedCodeHTML(code, language);

  return (
    <div className="my-4 rounded-xl bg-[#141414] border border-white/10 overflow-hidden select-text text-sm">
      <div className="flex items-center justify-between px-4 py-2.5 bg-white/5 border-b border-white/5 text-[10px] uppercase tracking-widest text-[#ededed]/40 select-none">
        <div className="flex items-center gap-1.5 font-medium font-mono text-white/60">
          <Code className="w-3.5 h-3.5 text-white/40" />
          <span>{language || "plaintext"}</span>
        </div>
        <button
          onClick={handleCopy}
          id={`copy-btn-${Math.random().toString(36).substr(2, 5)}`}
          className="text-[10px] text-white/40 hover:text-white uppercase tracking-wider font-semibold transition-colors cursor-pointer"
        >
          {copied ? (
            <span className="text-emerald-400">Copied</span>
          ) : (
            <span>Copy</span>
          )}
        </button>
      </div>
      <div className="p-4 overflow-x-auto font-mono text-[13.5px] leading-relaxed text-[#ededed]/90 antialiased select-text">
        <pre className="whitespace-pre scrollbar-thin">
          <code dangerouslySetInnerHTML={{ __html: highlightedHTML }} />
        </pre>
      </div>
    </div>
  );
};

// Formatted rich text renderer supporting headers, inline coding, bolding, lists and paragraphs
const TextRenderer: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  let currentList: { type: "bullet" | "ordered"; items: React.ReactNode[] } | null = null;

  const pushListIfExist = (key: string) => {
    if (currentList) {
      if (currentList.type === "bullet") {
        elements.push(
          <ul key={`ul-${key}`} className="my-3 list-disc pl-6 space-y-1 select-text">
            {currentList.items}
          </ul>
        );
      } else {
        elements.push(
          <ol key={`ol-${key}`} className="my-3 list-decimal pl-6 space-y-1 select-text">
            {currentList.items}
          </ol>
        );
      }
      currentList = null;
    }
  };

  const parseInlineStyles = (lineStr: string): React.ReactNode[] => {
    // 1. Escaping markup brackets
    let temp = lineStr;
    const parts: React.ReactNode[] = [];
    
    // Custom inline regex tokenizer for code `` `code` `` and bold `**text**` and italics `*text*`
    const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(temp)) !== null) {
      // Add text before match
      if (match.index > lastIndex) {
        parts.push(temp.substring(lastIndex, match.index));
      }

      const matchStr = match[0];
      if (matchStr.startsWith("`") && matchStr.endsWith("`")) {
        // Inline code space
        parts.push(
          <code
            key={match.index}
            className="px-1.5 py-0.5 mx-0.5 text-[0.85em] font-mono font-medium rounded border border-[#2d2d31] bg-[#1a1a1c] text-[#f43f5e] select-all"
          >
            {matchStr.slice(1, -1)}
          </code>
        );
      } else if (matchStr.startsWith("**") && matchStr.endsWith("**")) {
        parts.push(<strong key={match.index} className="font-semibold text-white">{matchStr.slice(2, -2)}</strong>);
      } else if (matchStr.startsWith("*") && matchStr.endsWith("*")) {
        parts.push(<em key={match.index} className="italic text-zinc-200">{matchStr.slice(1, -1)}</em>);
      }

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < temp.length) {
      parts.push(temp.substring(lastIndex));
    }

    return parts.length > 0 ? parts : [lineStr];
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (trimmed === "") {
      pushListIfExist(`gap-${i}`);
      continue;
    }

    // Headers
    if (trimmed.startsWith("#") && !trimmed.startsWith("##")) {
      pushListIfExist(`h1-${i}`);
      const h1Text = trimmed.replace(/^#\s*/, "");
      elements.push(
        <h1 key={`h1-${i}`} className="text-xl font-semibold text-white mt-5 mb-2.5 font-sans tracking-tight leading-snug">
          {parseInlineStyles(h1Text)}
        </h1>
      );
    } else if (trimmed.startsWith("##") && !trimmed.startsWith("###")) {
      pushListIfExist(`h2-${i}`);
      const h2Text = trimmed.replace(/^##\s*/, "");
      elements.push(
        <h2 key={`h2-${i}`} className="text-lg font-semibold text-white mt-4 mb-2 font-sans tracking-tight">
          {parseInlineStyles(h2Text)}
        </h2>
      );
    } else if (trimmed.startsWith("###")) {
      pushListIfExist(`h3-${i}`);
      const h3Text = trimmed.replace(/^###\s*/, "");
      elements.push(
        <h3 key={`h3-${i}`} className="text-md font-semibold text-zinc-100 mt-3.5 mb-1.5 font-sans">
          {parseInlineStyles(h3Text)}
        </h3>
      );
    }
    // Bullet Lists
    else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      if (!currentList || currentList.type !== "bullet") {
        pushListIfExist(`bullet-init-${i}`);
        currentList = { type: "bullet", items: [] };
      }
      const itemText = trimmed.replace(/^[-*]\s+/, "");
      currentList.items.push(
        <li key={`li-${i}`} className="text-zinc-300 pl-0.5 leading-relaxed select-text font-serif">
          {parseInlineStyles(itemText)}
        </li>
      );
    }
    // Ordered Lists
    else if (/^\d+\.\s+/.test(trimmed)) {
      if (!currentList || currentList.type !== "ordered") {
        pushListIfExist(`ordered-init-${i}`);
        currentList = { type: "ordered", items: [] };
      }
      const itemText = trimmed.replace(/^\d+\.\s+/, "");
      currentList.items.push(
        <li key={`li-${i}`} className="text-zinc-300 pl-0.5 leading-relaxed select-text font-serif">
          {parseInlineStyles(itemText)}
        </li>
      );
    }
    // Standard Paragraph lines
    else {
      pushListIfExist(`p-init-${i}`);
      elements.push(
        <p key={`p-${i}`} className="mb-3.5 last:mb-0 text-zinc-300 leading-relaxed text-[15.5px] md:text-[16px] font-serif select-text">
          {parseInlineStyles(rawLine)}
        </p>
      );
    }
  }

  pushListIfExist(`final`);

  return <div className="prose-claude text-[#e4e4e7] antialiased select-text">{elements}</div>;
};

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  if (!content) return null;

  // Split content into alternative text blocks and code blocks
  const blocks: Block[] = [];
  const regex = /```(\w*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      blocks.push({
        type: "text",
        content: content.substring(lastIndex, match.index),
      });
    }
    blocks.push({
      type: "code",
      language: match[1] || "javascript",
      content: match[2],
    });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < content.length) {
    blocks.push({
      type: "text",
      content: content.substring(lastIndex),
    });
  }

  return (
    <div className="flex flex-col space-y-1 select-text antialiased">
      {blocks.map((block, index) => {
        if (block.type === "code") {
          return (
            <CodeBlock
              key={`code-${index}`}
              code={block.content}
              language={block.language || "javascript"}
            />
          );
        } else {
          return <TextRenderer key={`text-${index}`} text={block.content} />;
        }
      })}
    </div>
  );
};
