import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Wrench, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Single message bubble – supports user, assistant, and tool messages.
 * Displays markdown content, sources, and graph entity tags.
 */
export default function MessageBubble({ message }) {
  const { role, content, sources, graph_entities_used, tool_name } = message;
  const [showSources, setShowSources] = useState(false);

  // --- Tool messages ---
  if (role === 'tool') {
    return (
      <div className="animate-message-fade-in flex justify-start">
        <div className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 max-w-[80%] text-sm">
          <div className="flex items-center gap-2 mb-1.5">
            <Wrench className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              {tool_name || 'Tool'}
            </span>
          </div>
          <p className="text-gray-300 whitespace-pre-wrap">{content}</p>
        </div>
      </div>
    );
  }

  // --- User messages ---
  if (role === 'user') {
    return (
      <div className="animate-message-fade-in flex flex-col items-end">
        <span className="text-xs text-gray-500 mb-1 mr-1">You</span>
        <div className="bg-indigo-600 rounded-2xl px-4 py-3 max-w-[70%] text-white">
          <p className="whitespace-pre-wrap">{content}</p>
        </div>
      </div>
    );
  }

  // --- Assistant messages ---
  const hasSources = sources && sources.length > 0;
  const hasEntities =
    graph_entities_used && graph_entities_used.length > 0;

  return (
    <div className="animate-message-fade-in flex flex-col items-start">
      <span className="text-xs text-gray-500 mb-1 ml-1">Assistant</span>
      <div className="bg-gray-800 rounded-2xl px-4 py-3 max-w-[70%] text-gray-100">
        {/* Markdown content */}
        <div className="prose prose-invert prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-li:my-0.5 prose-pre:bg-gray-900 prose-pre:rounded-lg prose-code:text-indigo-300">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>

        {/* Graph entities used */}
        {hasEntities && (
          <div className="mt-3 pt-3 border-t border-gray-700">
            <p className="text-xs text-gray-400 mb-1.5">
              Knowledge Graph Entities Used:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {graph_entities_used.map((entity, i) => (
                <span
                  key={i}
                  className="bg-purple-900/50 text-purple-300 rounded-full px-2 py-1 text-xs"
                >
                  {entity}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Collapsible sources */}
        {hasSources && (
          <div className="mt-3 pt-3 border-t border-gray-700">
            <button
              onClick={() => setShowSources(!showSources)}
              className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              {showSources ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
              Sources ({sources.length})
            </button>

            {showSources && (
              <div className="mt-2 space-y-2">
                {sources.map((src, i) => (
                  <div
                    key={i}
                    className="border-l-2 border-indigo-500 pl-3 py-1"
                  >
                    <p className="text-xs text-gray-400 mb-0.5">
                      {src.source_file && (
                        <span className="text-indigo-400">{src.source_file}</span>
                      )}
                      {src.page != null && (
                        <span className="ml-1">— Page {src.page}</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-300 line-clamp-3">
                      {src.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
