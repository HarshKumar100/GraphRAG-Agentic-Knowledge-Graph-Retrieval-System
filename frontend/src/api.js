import axios from 'axios';

// Axios instance — baseURL is empty because Vite dev server proxies /api to the backend
const api = axios.create({
  baseURL: '',
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Check backend health.
 * GET /api/health -> { status: "ok" }
 */
export async function healthCheck() {
  const response = await api.get('/api/health');
  return response.data;
}

/**
 * Upload a PDF file for a given thread.
 * POST /api/upload-pdf (FormData: file, thread_id)
 * -> { success, filename, pages, chunks, entities, relationships, message }
 */
export async function uploadPdf(file, threadId) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('thread_id', threadId);
  const response = await api.post('/api/upload-pdf', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

/**
 * Send a chat message.
 * POST /api/chat { thread_id, message }
 * -> { response, sources, graph_entities_used }
 */
export async function sendMessage(threadId, message) {
  const response = await api.post('/api/chat', {
    thread_id: threadId,
    message: message,
  });
  return response.data;
}

/**
 * Get all thread IDs.
 * GET /api/threads -> { threads: [string] }
 */
export async function getThreads() {
  const response = await api.get('/api/threads');
  return response.data;
}

/**
 * Create a new thread.
 * POST /api/threads/new -> { thread_id: string }
 */
export async function createNewThread() {
  const response = await api.post('/api/threads/new');
  return response.data;
}

/**
 * Get messages for a thread.
 * GET /api/threads/{thread_id}/messages
 * -> { messages: [{role, content, tool_name?}] }
 */
export async function getThreadMessages(threadId) {
  const response = await api.get(`/api/threads/${threadId}/messages`);
  return response.data;
}

/**
 * Get knowledge graph data for a thread.
 * GET /api/graph/{thread_id}
 * -> { nodes: [{id, label, type, description}], edges: [{source, target, label}] }
 */
export async function getGraphData(threadId) {
  const response = await api.get(`/api/graph/${threadId}`);
  return response.data;
}
