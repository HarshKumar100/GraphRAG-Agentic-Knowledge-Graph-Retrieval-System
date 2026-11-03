import React from 'react';
import { Plus, Brain, FileText, MessageSquare } from 'lucide-react';

/**
 * Sidebar component – thread list, new chat button, document info, branding.
 */
export default function Sidebar({
  threads,
  currentThreadId,
  onSelectThread,
  onNewChat,
  documentInfo,
}) {
  return (
    <aside className="w-72 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="w-6 h-6 text-indigo-400" />
          <h1 className="text-lg font-semibold text-white tracking-tight">
            GraphRAG Chatbot
          </h1>
        </div>

        {/* New Chat button */}
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 px-4 rounded-xl font-medium transition-colors duration-200"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </button>
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {threads.map((threadId) => (
          <button
            key={threadId}
            onClick={() => onSelectThread(threadId)}
            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors duration-150 flex items-center gap-2 group ${
              threadId === currentThreadId
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
            }`}
          >
            <MessageSquare className="w-4 h-4 flex-shrink-0 opacity-60" />
            <span className="truncate">
              {threadId.length > 20
                ? threadId.slice(0, 8) + '...' + threadId.slice(-8)
                : threadId}
            </span>
          </button>
        ))}

        {threads.length === 0 && (
          <p className="text-gray-600 text-sm text-center py-8">
            No conversations yet
          </p>
        )}
      </div>

      {/* Document info card */}
      {documentInfo && (
        <div className="mx-3 mb-3 p-3 bg-gray-800/70 border border-gray-700 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-medium text-white truncate">
              {documentInfo.filename}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-xs text-gray-400">
            <div>
              <span className="text-gray-500">Pages:</span>{' '}
              <span className="text-gray-300">{documentInfo.pages}</span>
            </div>
            <div>
              <span className="text-gray-500">Chunks:</span>{' '}
              <span className="text-gray-300">{documentInfo.chunks}</span>
            </div>
            <div>
              <span className="text-gray-500">Entities:</span>{' '}
              <span className="text-gray-300">{documentInfo.entities}</span>
            </div>
            <div>
              <span className="text-gray-500">Relations:</span>{' '}
              <span className="text-gray-300">{documentInfo.relationships}</span>
            </div>
          </div>
        </div>
      )}

      {/* Footer branding */}
      <div className="p-4 border-t border-gray-800">
        <p className="text-xs text-gray-600 text-center">
          Powered by LangGraph + GraphRAG
        </p>
      </div>
    </aside>
  );
}
