# 🧠 GraphRAG "Super Librarian" Chatbot

A production-ready conversational AI agent powered by a hybrid **GraphRAG (Knowledge Graph + Vector Search)** pipeline built with **LangGraph**, **FastAPI**, and **React + Tailwind CSS**.

---

## 🌟 Project Highlights

- **Hybrid GraphRAG Pipeline:** Engineered a hybrid GraphRAG pipeline combining FAISS vector search with a NetworkX directed knowledge graph to retrieve semantically relevant information and connect cross-document relationships.
- **Multi-Hop Traversal & Context Synthesis:** Implemented LLM-based entity and relationship extraction with source-chunk mapping and 2-hop BFS graph traversal, enabling multi-hop retrieval across document sections and consolidating graph-discovered and vector-retrieved context.
- **Stateful Agentic Workflows:** Built a stateful AI agent using LangGraph with tool-calling workflows for document retrieval, DuckDuckGo web search, stock price APIs, and arithmetic computation; integrated SQLite checkpointing for persistent, thread-based conversation state.
- **Full-Stack Architecture & Visual Knowledge Graph:** Developed an asynchronous FastAPI backend and interactive React.js + Tailwind CSS frontend, featuring document ingestion, REST APIs, and a force-directed knowledge graph visualizer for exploring entity relationships.

---

## 💡 The Problem: Why GraphRAG?

Standard Vector RAG models break documents into isolated text chunks and index them via cosine similarity. While effective for single-topic lookup, they fail when answers span distant sections of a large document:

> **Example:** In a 1,000-page corporate manual, an employee asks:  
> *"If I resign, what happens to my unvested stocks, and who authorizes the approval?"*
> 
> - **Page 10:** Resignation notice policy  
> - **Page 200:** Stock option vesting schedules  
> - **Page 450:** Executive sign-off hierarchy  
>
> ❌ **Traditional Vector RAG** fetches isolated chunks and misses the relationship between resignation, stock forfeiture, and the approval chain.  
> ✅ **GraphRAG ("Super Librarian")** maps these concepts into an interconnected Knowledge Graph:  
> `Resignation` ➔ `Stock Vesting` ➔ `Approval Authority`.  
> By executing a **2-hop BFS graph traversal** alongside vector retrieval, the system connects all relevant sections and delivers an accurate, multi-page consolidated answer.

---

## 🏗️ Project Architecture

```text
chatbot-in-langgraph-main/
├── backend/
│   ├── api_server.py           # FastAPI REST API (Endpoints for Chat, PDF Ingestion, Graph Viz)
│   ├── graphrag_engine.py      # Core GraphRAG Engine (FAISS + NetworkX + LLM Entity Extraction)
│   ├── langgraph_graphrag.py   # LangGraph Workflow (Multi-hop reasoning + Tools + Checkpointing)
│   ├── langgraph_backend.py
│   ├── langgraph_database_backend.py
│   ├── langgraph_mcp_backend.py
│   ├── langgraph_tool_backend.py
│   ├── langraph_rag_backend.py
│   ├── requirements.txt        # Backend Python dependencies
│   └── __init__.py
│
├── frontend/                   # Modern React + Vite + Tailwind CSS Single-Page App
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js          # API proxy to localhost:8000
│   ├── tailwind.config.js
│   └── src/
│       ├── App.jsx             # Main layout (Sidebar + Chat + Graph)
│       ├── api.js              # API client methods
│       └── components/
│           ├── Sidebar.jsx     # Conversations list & Document Stats card
│           ├── ChatWindow.jsx  # Chat interface with typing indicators
│           ├── MessageBubble.jsx # Markdown, collapsible sources, purple entity badges
│           ├── PdfUploader.jsx # Drag-and-drop PDF upload modal
│           └── KnowledgeGraphViz.jsx # Canvas interactive Force-Directed Graph
│
├── .env                        # Environment variables (OpenAI API Key)
├── .env.example
├── .gitignore                  # Git ignore rules for node_modules, .env, DBs, caches
├── requirements.txt            # Python dependencies
└── README.md
```

---

## 🛠️ Tech Stack

- **AI & Graph Engine:** LangGraph, LangChain, NetworkX, FAISS (`faiss-cpu`), OpenAI (`gpt-4o-mini`, `text-embedding-3-small`)
- **Backend:** Python 3.10+, FastAPI, Uvicorn, SQLite (`SqliteSaver`), Pydantic
- **Frontend:** React 18, Vite, Tailwind CSS, Lucide React, React Dropzone, HTML5 Canvas API
- **Tools Integrated:** DuckDuckGo Search, Alpha Vantage API, Custom Calculator

---

## 🚀 Getting Started

### 1. Backend Setup

```bash
# Install Python dependencies
pip install -r requirements.txt

# Start the FastAPI server
python backend/api_server.py
```
- API Server: `http://localhost:8000`
- Interactive Swagger Docs: `http://localhost:8000/docs`

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
pnpm install

# Start development server
pnpm dev
```
- Web Application: `http://localhost:5173`

### 3. API Key Configuration

Update the `.env` file in the root folder with your OpenAI API key:
```env
OPENAI_API_KEY=your_actual_key_here
```
