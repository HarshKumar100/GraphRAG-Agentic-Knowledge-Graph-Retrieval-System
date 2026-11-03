import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar.jsx';
import ChatWindow from './components/ChatWindow.jsx';
import KnowledgeGraphViz from './components/KnowledgeGraphViz.jsx';
import {
  getThreads,
  createNewThread,
  getThreadMessages,
  sendMessage,
  uploadPdf,
  getGraphData,
} from './api.js';

/**
 * Main application component.
 * Manages threads, messages, graph data, and document info state.
 */
export default function App() {
  const [threads, setThreads] = useState([]);
  const [currentThreadId, setCurrentThreadId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showGraph, setShowGraph] = useState(false);
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [documentInfo, setDocumentInfo] = useState(null);
  const [error, setError] = useState(null);

  // Auto-dismiss error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // On mount: fetch threads and select or create one
  useEffect(() => {
    async function init() {
      try {
        const data = await getThreads();
        const threadList = data.threads || [];
        if (threadList.length > 0) {
          setThreads(threadList);
          setCurrentThreadId(threadList[0]);
        } else {
          const newThread = await createNewThread();
          setThreads([newThread.thread_id]);
          setCurrentThreadId(newThread.thread_id);
        }
      } catch (err) {
        console.error('Failed to initialize threads:', err);
        // Try creating a new thread even if listing failed
        try {
          const newThread = await createNewThread();
          setThreads([newThread.thread_id]);
          setCurrentThreadId(newThread.thread_id);
        } catch (err2) {
          setError('Failed to connect to the backend. Make sure the server is running on localhost:8000.');
        }
      }
    }
    init();
  }, []);

  // When currentThreadId changes, load messages and graph data
  useEffect(() => {
    if (!currentThreadId) return;

    async function loadThread() {
      try {
        const msgData = await getThreadMessages(currentThreadId);
        setMessages(msgData.messages || []);
      } catch (err) {
        console.error('Failed to load messages:', err);
        setMessages([]);
      }

      try {
        const gData = await getGraphData(currentThreadId);
        setGraphData(gData || { nodes: [], edges: [] });
      } catch (err) {
        console.error('Failed to load graph data:', err);
        setGraphData({ nodes: [], edges: [] });
      }
    }

    loadThread();
  }, [currentThreadId]);

  // Select a thread from the sidebar
  const handleSelectThread = useCallback((threadId) => {
    setCurrentThreadId(threadId);
    setDocumentInfo(null);
  }, []);

  // Create a new chat thread
  const handleNewChat = useCallback(async () => {
    try {
      const newThread = await createNewThread();
      setThreads((prev) => [newThread.thread_id, ...prev]);
      setCurrentThreadId(newThread.thread_id);
      setMessages([]);
      setGraphData({ nodes: [], edges: [] });
      setDocumentInfo(null);
    } catch (err) {
      console.error('Failed to create new thread:', err);
      setError('Failed to create a new chat thread.');
    }
  }, []);

  // Send a chat message
  const handleSendMessage = useCallback(
    async (messageText) => {
      if (!currentThreadId || !messageText.trim()) return;

      // Optimistically add user message
      const userMsg = { role: 'user', content: messageText };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      try {
        const result = await sendMessage(currentThreadId, messageText);

        // Add assistant response with sources and graph entities
        const assistantMsg = {
          role: 'assistant',
          content: result.response,
          sources: result.sources,
          graph_entities_used: result.graph_entities_used,
        };
        setMessages((prev) => [...prev, assistantMsg]);

        // Refresh graph data after each message (new entities may have appeared)
        try {
          const gData = await getGraphData(currentThreadId);
          setGraphData(gData || { nodes: [], edges: [] });
        } catch (graphErr) {
          // Non-critical, ignore
        }
      } catch (err) {
        console.error('Failed to send message:', err);
        setError('Failed to get a response. Please try again.');
      } finally {
        setIsLoading(false);
      }
    },
    [currentThreadId]
  );

  // Upload a PDF
  const handleUploadPdf = useCallback(
    async (file) => {
      if (!currentThreadId) return;

      try {
        const result = await uploadPdf(file, currentThreadId);
        if (result.success) {
          setDocumentInfo({
            filename: result.filename,
            pages: result.pages,
            chunks: result.chunks,
            entities: result.entities,
            relationships: result.relationships,
          });

          // Refresh graph data after upload
          try {
            const gData = await getGraphData(currentThreadId);
            setGraphData(gData || { nodes: [], edges: [] });
          } catch (graphErr) {
            // Non-critical
          }

          // Add a system-style message about the upload
          const toolMsg = {
            role: 'tool',
            content: result.message || `Successfully processed "${result.filename}": ${result.pages} pages, ${result.chunks} chunks, ${result.entities} entities, ${result.relationships} relationships extracted.`,
            tool_name: 'PDF Upload',
          };
          setMessages((prev) => [...prev, toolMsg]);
        } else {
          setError('PDF upload failed. Please try again.');
        }
        return result;
      } catch (err) {
        console.error('Failed to upload PDF:', err);
        setError('Failed to upload PDF. Please try again.');
        throw err;
      }
    },
    [currentThreadId]
  );

  // Toggle knowledge graph panel
  const handleToggleGraph = useCallback(() => {
    setShowGraph((prev) => !prev);
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-950">
      {/* Error toast */}
      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-red-900/90 border border-red-700 text-red-100 px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-message-fade-in">
          <span className="text-sm">{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-300 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      {/* Sidebar */}
      <Sidebar
        threads={threads}
        currentThreadId={currentThreadId}
        onSelectThread={handleSelectThread}
        onNewChat={handleNewChat}
        documentInfo={documentInfo}
      />

      {/* Main chat area */}
      <ChatWindow
        messages={messages}
        isLoading={isLoading}
        onSendMessage={handleSendMessage}
        onUploadPdf={handleUploadPdf}
        showGraph={showGraph}
        onToggleGraph={handleToggleGraph}
        currentThreadId={currentThreadId}
        documentInfo={documentInfo}
      />

      {/* Knowledge Graph panel */}
      {showGraph && (
        <KnowledgeGraphViz
          graphData={graphData}
          onClose={() => setShowGraph(false)}
        />
      )}
    </div>
  );
}
