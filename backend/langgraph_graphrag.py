"""
LangGraph GraphRAG Workflow - Defines the LangGraph chatbot with GraphRAG tools.

This module sets up a LangGraph StateGraph workflow that integrates GraphRAG document
search, web search, calculator, and stock price tools. The chatbot uses SQLite-based
checkpointing for conversation persistence across threads.
"""

import sqlite3
import json
from typing import Annotated
from typing_extensions import TypedDict

import requests
from dotenv import load_dotenv
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage, AIMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langchain_community.tools import DuckDuckGoSearchRun
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition
from langgraph.checkpoint.sqlite import SqliteSaver

import sys
from pathlib import Path

# Add current and parent directory to sys.path for robust imports
current_dir = Path(__file__).resolve().parent
parent_dir = current_dir.parent
for p in (str(current_dir), str(parent_dir)):
    if p not in sys.path:
        sys.path.insert(0, p)

try:
    from backend.graphrag_engine import GraphRAGEngine
except ImportError:
    from graphrag_engine import GraphRAGEngine

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------
load_dotenv()

api_key = os.getenv("OPENAI_API_KEY") or "sk-placeholder-api-key"
llm = ChatOpenAI(model="gpt-4o-mini", api_key=api_key)
graph_rag_engine = GraphRAGEngine()

# ---------------------------------------------------------------------------
# Tool definitions
# ---------------------------------------------------------------------------

@tool
def graph_rag_search(query: str, thread_id: str) -> dict:
    """Search the uploaded document using GraphRAG. Retrieves information by combining
    vector similarity search with knowledge graph traversal for multi-hop reasoning.
    Always provide the thread_id."""
    if not graph_rag_engine.has_document(thread_id):
        return {
            "error": "No document has been uploaded for this thread. Please upload a PDF first.",
            "context": "",
            "sources": [],
            "graph_entities_used": [],
            "traversal_paths": []
        }

    result = graph_rag_engine.graph_enhanced_retrieval(query, thread_id)
    return result


@tool
def web_search(query: str) -> str:
    """Search the web for current information using DuckDuckGo.
    Use this for questions about current events, general knowledge, or topics
    not covered by uploaded documents."""
    try:
        search = DuckDuckGoSearchRun()
        results = search.run(query)
        return results
    except Exception as e:
        return f"Web search failed: {str(e)}"


@tool
def calculator(first_num: float, second_num: float, operation: str) -> dict:
    """Perform a mathematical calculation. Supported operations: add, subtract, multiply, divide.

    Args:
        first_num: The first number.
        second_num: The second number.
        operation: One of 'add', 'subtract', 'multiply', 'divide'.
    """
    operations = {
        "add": lambda a, b: a + b,
        "subtract": lambda a, b: a - b,
        "multiply": lambda a, b: a * b,
        "divide": lambda a, b: a / b if b != 0 else "Error: Division by zero",
    }

    if operation not in operations:
        return {"error": f"Unknown operation: {operation}. Use add, subtract, multiply, or divide."}

    result = operations[operation](first_num, second_num)
    return {"result": result, "operation": f"{first_num} {operation} {second_num}"}


@tool
def get_stock_price(symbol: str) -> dict:
    """Get the current stock price for a given ticker symbol using Alpha Vantage.

    Args:
        symbol: The stock ticker symbol (e.g., AAPL, GOOGL, MSFT).
    """
    import os
    api_key = os.getenv("ALPHA_VANTAGE_API_KEY", "demo")
    url = "https://www.alphavantage.co/query"
    params = {
        "function": "GLOBAL_QUOTE",
        "symbol": symbol,
        "apikey": api_key
    }

    try:
        response = requests.get(url, params=params, timeout=10)
        data = response.json()

        if "Global Quote" in data and data["Global Quote"]:
            quote = data["Global Quote"]
            return {
                "symbol": quote.get("01. symbol", symbol),
                "price": quote.get("05. price", "N/A"),
                "change": quote.get("09. change", "N/A"),
                "change_percent": quote.get("10. change percent", "N/A"),
                "volume": quote.get("06. volume", "N/A"),
                "latest_trading_day": quote.get("07. latest trading day", "N/A")
            }
        else:
            return {"error": f"No data found for symbol: {symbol}", "raw": data}
    except Exception as e:
        return {"error": f"Failed to fetch stock price: {str(e)}"}


# ---------------------------------------------------------------------------
# State definition
# ---------------------------------------------------------------------------

class ChatState(TypedDict):
    """State schema for the chatbot graph."""
    messages: Annotated[list[BaseMessage], add_messages]


# ---------------------------------------------------------------------------
# Tool list and LLM binding
# ---------------------------------------------------------------------------

tools = [graph_rag_search, web_search, calculator, get_stock_price]
llm_with_tools = llm.bind_tools(tools)

# ---------------------------------------------------------------------------
# Graph nodes
# ---------------------------------------------------------------------------

def chat_node(state: ChatState, config: dict) -> dict:
    """
    Main chat node that processes messages through the LLM with tools.

    Extracts the thread_id from config and builds a system message that instructs
    the LLM about available tools and how to use graph_rag_search with the correct
    thread_id for document-related questions.
    """
    # Extract thread_id from config
    thread_id = config.get("configurable", {}).get("thread_id", "default")

    # Check if a document has been uploaded for this thread
    has_doc = graph_rag_engine.has_document(thread_id)
    doc_info = ""
    if has_doc:
        metadata = graph_rag_engine.get_metadata(thread_id)
        doc_info = (
            f"\n\nA document has been uploaded for this conversation: "
            f"'{metadata.get('filename', 'unknown')}' "
            f"({metadata.get('pages', '?')} pages, {metadata.get('chunks', '?')} chunks, "
            f"{metadata.get('entities', '?')} entities in the knowledge graph). "
            f"When the user asks questions about the document, use the graph_rag_search tool "
            f"with thread_id='{thread_id}'. The graph_rag_search tool combines vector similarity "
            f"search with knowledge graph traversal for multi-hop reasoning."
        )

    system_message = SystemMessage(content=(
        "You are a helpful AI assistant with access to several tools:\n"
        "1. **graph_rag_search**: Search uploaded documents using GraphRAG (vector + knowledge graph). "
        f"Always pass thread_id='{thread_id}' when using this tool.\n"
        "2. **web_search**: Search the web for current information.\n"
        "3. **calculator**: Perform math calculations (add, subtract, multiply, divide).\n"
        "4. **get_stock_price**: Get current stock prices by ticker symbol.\n\n"
        "When answering questions about an uploaded document, always use graph_rag_search first. "
        "Provide clear, well-structured answers based on the retrieved context. "
        "If the tool returns sources, reference them in your answer."
        f"{doc_info}"
    ))

    # Prepend system message to the conversation
    messages = [system_message] + state["messages"]

    response = llm_with_tools.invoke(messages)
    return {"messages": [response]}


# ---------------------------------------------------------------------------
# Tool node
# ---------------------------------------------------------------------------

tool_node = ToolNode(tools)

# ---------------------------------------------------------------------------
# Graph construction
# ---------------------------------------------------------------------------

conn = sqlite3.connect(database="graphrag_chatbot.db", check_same_thread=False)
checkpointer = SqliteSaver(conn=conn)

graph = StateGraph(ChatState)
graph.add_node("chat_node", chat_node)
graph.add_node("tools", tool_node)
graph.add_edge(START, "chat_node")
graph.add_conditional_edges("chat_node", tools_condition)
graph.add_edge("tools", "chat_node")

chatbot = graph.compile(checkpointer=checkpointer)

# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def retrieve_all_threads() -> list:
    """
    Retrieve all unique thread IDs from the checkpointer database.

    Returns:
        List of thread_id strings.
    """
    try:
        all_threads = set()
        for checkpoint in checkpointer.list(None):
            cfg = getattr(checkpoint, "config", {})
            if isinstance(cfg, dict):
                tid = cfg.get("configurable", {}).get("thread_id")
                if tid:
                    all_threads.add(str(tid))
        return list(all_threads)
    except Exception:
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT DISTINCT thread_id FROM checkpoints")
            rows = cursor.fetchall()
            return [str(row[0]) for row in rows]
        except Exception:
            return []


def get_graph_rag_engine() -> GraphRAGEngine:
    """
    Return the global GraphRAGEngine instance.

    Returns:
        The shared GraphRAGEngine instance used by the chatbot.
    """
    return graph_rag_engine
