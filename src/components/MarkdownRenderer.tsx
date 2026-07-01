import React from 'react';

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  if (!content) return null;

  // Process text block into paragraphs, headers, and lists
  const lines = content.split('\n');
  const renderedElements: React.ReactNode[] = [];

  let keyIndex = 0;
  let inList = false;
  let listItems: React.ReactNode[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      renderedElements.push(
        <ul key={`list-${keyIndex++}`} className="list-disc pl-5 my-2 space-y-1 text-gray-700 dark:text-gray-300">
          {listItems}
        </ul>
      );
      listItems = [];
    }
    inList = false;
  };

  const formatInlineStyles = (text: string) => {
    // Escape standard regex characters if any issues, but here we do basic bold, italic, and inline code
    const parts: React.ReactNode[] = [];
    let currentText = text;
    let index = 0;

    // Split text by bold (**), italic (*), and code (`) tokens
    // We can use a simple stateful tokenizer
    while (currentText.length > 0) {
      // Find the first occurrence of **, *, or `
      const boldIdx = currentText.indexOf('**');
      const italicIdx = currentText.indexOf('*');
      const codeIdx = currentText.indexOf('`');

      const matches = [
        { type: 'bold', index: boldIdx, length: 2 },
        { type: 'italic', index: italicIdx, length: 1 },
        { type: 'code', index: codeIdx, length: 1 }
      ].filter(m => m.index !== -1).sort((a, b) => a.index - b.index);

      if (matches.length === 0) {
        parts.push(<span key={index++}>{currentText}</span>);
        break;
      }

      const match = matches[0];
      // Push text before the match
      if (match.index > 0) {
        parts.push(<span key={index++}>{currentText.substring(0, match.index)}</span>);
      }

      const postMatchText = currentText.substring(match.index + match.length);
      const endIdx = postMatchText.indexOf(match.type === 'bold' ? '**' : match.type === 'italic' ? '*' : '`');

      if (endIdx === -1) {
        // Unclosed tag, treat as plain text
        parts.push(<span key={index++}>{currentText.substring(match.index, match.index + match.length)}</span>);
        currentText = postMatchText;
      } else {
        const innerText = postMatchText.substring(0, endIdx);
        if (match.type === 'bold') {
          parts.push(<strong key={index++} className="font-semibold text-gray-900 dark:text-white">{innerText}</strong>);
        } else if (match.type === 'italic') {
          parts.push(<em key={index++} className="italic text-gray-800 dark:text-gray-200">{innerText}</em>);
        } else {
          parts.push(
            <code key={index++} className="bg-gray-100 dark:bg-gray-800 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded text-xs font-mono">
              {innerText}
            </code>
          );
        }
        currentText = postMatchText.substring(endIdx + match.length);
      }
    }

    return parts;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Check code blocks
    if (line.startsWith('```')) {
      flushList();
      let codeContent = '';
      i++; // Move past starting ```
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeContent += lines[i] + '\n';
        i++;
      }
      renderedElements.push(
        <pre key={`code-block-${keyIndex++}`} className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3 my-2 overflow-x-auto text-xs font-mono text-gray-800 dark:text-gray-200 leading-relaxed">
          <code>{codeContent}</code>
        </pre>
      );
      continue;
    }

    // Headers
    if (line.startsWith('# ')) {
      flushList();
      renderedElements.push(
        <h1 key={`h1-${keyIndex++}`} className="text-xl font-bold text-gray-900 dark:text-white mt-4 mb-2 tracking-tight">
          {formatInlineStyles(line.substring(2))}
        </h1>
      );
    } else if (line.startsWith('## ')) {
      flushList();
      renderedElements.push(
        <h2 key={`h2-${keyIndex++}`} className="text-lg font-bold text-gray-900 dark:text-white mt-3 mb-1.5 tracking-tight border-b border-gray-100 dark:border-gray-800 pb-1">
          {formatInlineStyles(line.substring(3))}
        </h2>
      );
    } else if (line.startsWith('### ')) {
      flushList();
      renderedElements.push(
        <h3 key={`h3-${keyIndex++}`} className="text-base font-semibold text-gray-900 dark:text-white mt-2.5 mb-1">
          {formatInlineStyles(line.substring(4))}
        </h3>
      );
    }
    // Blockquotes
    else if (line.startsWith('> ')) {
      flushList();
      renderedElements.push(
        <blockquote key={`quote-${keyIndex++}`} className="border-l-4 border-gray-300 dark:border-gray-700 pl-4 py-1 my-2 italic text-gray-600 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-900/30 pr-2 rounded-r">
          {formatInlineStyles(line.substring(2))}
        </blockquote>
      );
    }
    // Bullet lists
    else if (line.startsWith('- ') || line.startsWith('* ')) {
      inList = true;
      listItems.push(
        <li key={`li-${keyIndex++}`} className="ml-1">
          {formatInlineStyles(line.substring(2))}
        </li>
      );
    } else if (line.match(/^\d+\.\s/)) {
      // Numbered lists
      flushList();
      const dotIdx = line.indexOf('.');
      renderedElements.push(
        <div key={`num-list-${keyIndex++}`} className="flex items-start my-1 text-gray-700 dark:text-gray-300 pl-2">
          <span className="font-semibold text-gray-500 mr-2 min-w-[18px] text-right">{line.substring(0, dotIdx + 1)}</span>
          <span className="flex-1">{formatInlineStyles(line.substring(dotIdx + 1).trim())}</span>
        </div>
      );
    }
    // Plain paragraphs or empty lines
    else {
      if (line === '') {
        flushList();
      } else {
        if (inList) {
          // If in a list block and line doesn't start with standard bullet, append as a sub-item block
          listItems.push(
            <div key={`li-sub-${keyIndex++}`} className="ml-4 text-sm text-gray-500 mt-0.5">
              {formatInlineStyles(line)}
            </div>
          );
        } else {
          renderedElements.push(
            <p key={`p-${keyIndex++}`} className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed my-1.5">
              {formatInlineStyles(line)}
            </p>
          );
        }
      }
    }
  }

  // Final flush of remaining list items
  flushList();

  return <div className="space-y-1">{renderedElements}</div>;
}
