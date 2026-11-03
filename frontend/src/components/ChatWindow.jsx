import React, { useState, useRef, useEffect } from 'react';
import { Send, Upload, Network, BookOpen } from 'lucide-react';
import MessageBubble from './MessageBubble.jsx';
import PdfUploader from './PdfUploader.jsx';

/**
 * Main chat window – header, message list, typing indicator, and input bar.
 */
export default function ChatWindow({
  messages,
  isLoading,
  onSendMessage,
  onUploadPdf,
  showGraph,
  onToggleGraph,
  currentThreadId,
  documentInfo,
}) {
  const [input, setInput] = useState('');
  const [showUploader, setShowUploader] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when messages change or loading state changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleUpload = async (file) => {
    const result = await onUploadPdf(file);
    if (result && result.success) {
      setShowUploader(false);
    }
    return result;
  };

  return (
    <div className="flex-1 flex flex-col h-full min-w-0 bg-gray-950">
      {/* Header bar */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-indigo-400" />
          <h2 className="text-base font-semibold text-white">GraphRAG Chat</h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowUploader(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg transition-colors duration-200 border border-gray-700"
          >
            <Upload className="w-4 h-4" />
            Upload PDF
          </button>
          <button
            onClick={onToggleGraph}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors duration-200 border ${
              showGraph
                ? 'bg-indigo-600 text-white border-indigo-500'
                : 'bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border-gray-700'
            }`}
          >
            <Network className="w-4 h-4" />
            Graph
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-gray-600">
            <BookOpen className="w-12 h-12 mb-4 opacity-40" />
            <p className="text-lg font-medium mb-1">Start a conversation</p>
            <p className="text-sm">Upload a PDF or ask a question to get started.</p>
          </div>
        )}

        {messages.map((msg, index) => (
          <MessageBubble key={index} message={msg} />
        ))}

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex items-start gap-3 animate-message-fade-in">
            <div className="bg-gray-800 rounded-2xl px-5 py-3 max-w-[70%]">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce-dot-1" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce-dot-2" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce-dot-3" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 p-4 border-t border-gray-800 bg-gray-900/30">
        <form onSubmit={handleSubmit} className="flex items-end gap-3 max-w-4xl mx-auto">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            rows={1}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-xl p-4 text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 min-h-[52px] max-h-[200px]"
            style={{ height: 'auto' }}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="flex-shrink-0 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white p-3 rounded-xl transition-colors duration-200"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>

      {/* PDF Uploader modal */}
      <PdfUploader
        isOpen={showUploader}
        onClose={() => setShowUploader(false)}
        onUpload={handleUpload}
      />
    </div>
  );
}
