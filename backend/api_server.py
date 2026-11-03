"""
FastAPI Server - REST API for the GraphRAG Chatbot.

This module provides HTTP endpoints for chat, PDF upload, thread management,
and knowledge graph visualization. CORS is enabled for all origins.
"""

import uuid
import json
from typing import List, Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage, SystemMessage

import sys
from pathlib import Path

# Add current and parent directory to sys.path for robust imports
current_dir = Path(__file__).resolve().parent
parent_dir = current_dir.parent
for p in (str(current_dir), str(parent_dir)):
    if p not in sys.path:
        sys.path.insert(0, p)

try:
    from backend.langgraph_graphrag import chatbot, retrieve_all_threads, get_graph_rag_engine
except ImportError:
    from langgraph_graphrag import chatbot, retrieve_all_threads, get_graph_rag_engine

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(title="GraphRAG Chatbot API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Get the shared GraphRAG engine instance
graph_rag_engine = get_graph_rag_engine()

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    """Request body for the chat endpoint."""
    thread_id: str
    message: str


class ChatResponse(BaseModel):
    """Response body for the chat endpoint."""
    response: str
    sources: list = []
    graph_entities_used: list = []


class ThreadResponse(BaseModel):
    """Response body for listing threads."""
    threads: List[str]


class NewThreadResponse(BaseModel):
    """Response body for creating a new thread."""
    thread_id: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok"}


@app.post("/api/upload-pdf")
async def upload_pdf(file: UploadFile = File(...), thread_id: str = Form(...)):
    """
    Upload a PDF document and ingest it into the GraphRAG engine for a specific thread.

    The PDF is processed into chunks, a vector store is created, and a knowledge graph
    is built with entities and relationships extracted by the LLM.

    Args:
        file: The uploaded PDF file.
        thread_id: The conversation thread ID to associate the document with.

    Returns:
        Ingestion statistics including filename, pages, chunks, entities, and relationships.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    try:
        file_bytes = await file.read()
        result = graph_rag_engine.ingest_pdf(
            file_bytes=file_bytes,
            thread_id=thread_id,
            filename=file.filename
        )
        return {
            "success": True,
            "status": "success",
            "message": f"Successfully ingested '{file.filename}'",
            "filename": result["filename"],
            "pages": result["pages"],
            "chunks": result["chunks"],
            "entities": result["entities"],
            "relationships": result["relationships"],
            "stats": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process PDF: {str(e)}")


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Send a message to the chatbot and get a response.

    The chatbot uses LangGraph with GraphRAG tools to answer questions.
    If a document has been uploaded, the chatbot can search it using
    combined vector + knowledge graph retrieval.

    Args:
        request: ChatRequest with thread_id and message.

    Returns:
        ChatResponse with the AI response, sources, and graph entities used.
    """
    try:
        config = {"configurable": {"thread_id": request.thread_id}}

        result = chatbot.invoke(
            {"messages": [HumanMessage(content=request.message)]},
            config=config
        )

        # Extract the final AI response from messages
        ai_response = ""
        sources = []
        graph_entities_used = []

        # Walk through messages to find the last AI message and any tool results
        for msg in result["messages"]:
            if isinstance(msg, AIMessage) and msg.content:
                ai_response = msg.content
            elif isinstance(msg, ToolMessage):
                # Try to parse tool content for GraphRAG source info
                try:
                    if isinstance(msg.content, str):
                        tool_data = json.loads(msg.content)
                    elif isinstance(msg.content, dict):
                        tool_data = msg.content
                    else:
                        continue

                    if isinstance(tool_data, dict):
                        if "sources" in tool_data:
                            sources = tool_data["sources"]
                        if "graph_entities_used" in tool_data:
                            graph_entities_used = tool_data["graph_entities_used"]
                except (json.JSONDecodeError, TypeError):
                    pass

        if not ai_response:
            ai_response = "I'm sorry, I wasn't able to generate a response. Please try again."

        return ChatResponse(
            response=ai_response,
            sources=sources,
            graph_entities_used=graph_entities_used
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")


@app.get("/api/threads", response_model=ThreadResponse)
async def get_threads():
    """
    Retrieve all conversation thread IDs.

    Returns:
        ThreadResponse with a list of thread_id strings.
    """
    threads = retrieve_all_threads()
    return ThreadResponse(threads=threads)


@app.post("/api/threads/new", response_model=NewThreadResponse)
async def create_new_thread():
    """
    Create a new conversation thread with a unique UUID.

    Returns:
        NewThreadResponse with the generated thread_id.
    """
    thread_id = str(uuid.uuid4())
    return NewThreadResponse(thread_id=thread_id)


@app.get("/api/threads/{thread_id}/messages")
async def get_thread_messages(thread_id: str):
    """
    Get all messages in a conversation thread.

    Uses the LangGraph checkpointer to load the conversation state and
    converts messages to a serializable format.

    Args:
        thread_id: The conversation thread ID.

    Returns:
        List of message dicts with role, content, and optional tool_name.
    """
    try:
        config = {"configurable": {"thread_id": thread_id}}
        state = chatbot.get_state(config)

        messages = []
        if state and state.values and "messages" in state.values:
            for msg in state.values["messages"]:
                if isinstance(msg, HumanMessage):
                    messages.append({
                        "role": "user",
                        "content": msg.content
                    })
                elif isinstance(msg, AIMessage):
                    # Skip AI messages that are just tool calls with no text content
                    content = msg.content if msg.content else ""
                    if msg.tool_calls:
                        # Include tool call info if there's no text content
                        if not content:
                            tool_names = [tc.get("name", "unknown") for tc in msg.tool_calls]
                            content = f"[Calling tools: {', '.join(tool_names)}]"
                    messages.append({
                        "role": "assistant",
                        "content": content
                    })
                elif isinstance(msg, ToolMessage):
                    # Truncate long tool outputs for display
                    content = msg.content if isinstance(msg.content, str) else json.dumps(msg.content)
                    if len(content) > 2000:
                        content = content[:2000] + "... [truncated]"
                    messages.append({
                        "role": "tool",
                        "content": content,
                        "tool_name": msg.name if hasattr(msg, "name") else "unknown"
                    })
                elif isinstance(msg, SystemMessage):
                    # Skip system messages from the output
                    continue

        return {"messages": messages}

    except Exception as e:
        # If thread doesn't exist yet, return empty
        return {"messages": []}


@app.get("/api/graph/{thread_id}")
async def get_knowledge_graph(thread_id: str):
    """
    Get the knowledge graph data for visualization.

    Returns the nodes and edges of the knowledge graph built during PDF ingestion.

    Args:
        thread_id: The conversation thread ID.

    Returns:
        dict with 'nodes' and 'edges' lists for graph visualization.
    """
    graph_data = graph_rag_engine.get_graph_data(thread_id)
    return graph_data


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
