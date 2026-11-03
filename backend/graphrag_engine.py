"""
GraphRAG Engine - Core knowledge graph-enhanced retrieval-augmented generation engine.

This module implements a GraphRAG system that combines traditional vector similarity
search with knowledge graph traversal for multi-hop reasoning over PDF documents.
Each thread maintains its own isolated knowledge graph, vector store, and chunk storage.
"""

import os
import json
import tempfile
import hashlib
from typing import Dict, List, Optional, Any
from collections import deque

import networkx as nx
from dotenv import load_dotenv

from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_community.vectorstores import FAISS
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from langchain_core.messages import HumanMessage, SystemMessage


class GraphRAGEngine:
    """
    Core GraphRAG engine that maintains per-thread knowledge graphs and vector stores.

    For each thread/conversation, the engine can ingest PDFs, build a knowledge graph
    of entities and relationships, and perform graph-enhanced retrieval that combines
    vector similarity search with BFS graph traversal for superior context retrieval.
    """

    def __init__(self):
        """Initialize the GraphRAG engine with LLM, embeddings, and per-thread storage."""
        load_dotenv()
        api_key = os.getenv("OPENAI_API_KEY") or "sk-placeholder-api-key"
        self.llm = ChatOpenAI(model="gpt-4o-mini", temperature=0, api_key=api_key)
        self.embeddings = OpenAIEmbeddings(model="text-embedding-3-small", api_key=api_key)

        # Per-thread storage dictionaries
        self._thread_graphs: Dict[str, nx.DiGraph] = {}         # knowledge graphs
        self._thread_vectorstores: Dict[str, FAISS] = {}        # FAISS stores
        self._thread_chunks: Dict[str, List[Document]] = {}     # raw chunks
        self._thread_metadata: Dict[str, dict] = {}             # ingestion metadata

    def ingest_pdf(self, file_bytes: bytes, thread_id: str, filename: str = None) -> dict:
        """
        Ingest a PDF document for a given thread.

        Steps:
        1. Save bytes to a temp file
        2. Load pages with PyPDFLoader
        3. Split into chunks with RecursiveCharacterTextSplitter
        4. Create FAISS vector store from chunks
        5. Extract entities and relationships from each chunk via LLM
        6. Build a NetworkX DiGraph knowledge graph
        7. Store everything in per-thread dictionaries

        Args:
            file_bytes: Raw bytes of the PDF file.
            thread_id: Unique identifier for the conversation thread.
            filename: Optional original filename for metadata.

        Returns:
            dict with keys: filename, pages, chunks, entities, relationships
        """
        # Step 1: Save bytes to a temporary file
        tmp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
        try:
            tmp_file.write(file_bytes)
            tmp_file.close()
            tmp_path = tmp_file.name

            # Step 2: Load with PyPDFLoader
            loader = PyPDFLoader(tmp_path)
            pages = loader.load()

            # Step 3: Split into chunks
            splitter = RecursiveCharacterTextSplitter(
                chunk_size=1000,
                chunk_overlap=200
            )
            chunks = splitter.split_documents(pages)

            # Add chunk index metadata
            for i, chunk in enumerate(chunks):
                chunk.metadata["chunk_index"] = i

            # Step 4: Create FAISS vector store
            vectorstore = FAISS.from_documents(chunks, self.embeddings)

            # Step 5: Extract entities and relationships from each chunk
            graph = nx.DiGraph()
            all_entities = []
            all_relationships = []

            for i, chunk in enumerate(chunks):
                extraction = self._extract_entities_from_chunk(chunk.page_content, i)
                entities = extraction.get("entities", [])
                relationships = extraction.get("relationships", [])

                # Step 6: Build the knowledge graph
                for entity in entities:
                    node_name = entity["name"].strip()
                    if not node_name:
                        continue

                    if graph.has_node(node_name):
                        # Append chunk index to existing node
                        existing_indices = graph.nodes[node_name].get("chunk_indices", [])
                        if i not in existing_indices:
                            existing_indices.append(i)
                        graph.nodes[node_name]["chunk_indices"] = existing_indices
                    else:
                        graph.add_node(
                            node_name,
                            type=entity.get("type", "CONCEPT"),
                            description=entity.get("description", ""),
                            chunk_indices=[i]
                        )

                for rel in relationships:
                    source = rel.get("source", "").strip()
                    target = rel.get("target", "").strip()
                    relation = rel.get("relation", "related_to")

                    if not source or not target:
                        continue

                    # Ensure source and target nodes exist
                    if not graph.has_node(source):
                        graph.add_node(source, type="CONCEPT", description="", chunk_indices=[i])
                    else:
                        existing_indices = graph.nodes[source].get("chunk_indices", [])
                        if i not in existing_indices:
                            existing_indices.append(i)
                        graph.nodes[source]["chunk_indices"] = existing_indices

                    if not graph.has_node(target):
                        graph.add_node(target, type="CONCEPT", description="", chunk_indices=[i])
                    else:
                        existing_indices = graph.nodes[target].get("chunk_indices", [])
                        if i not in existing_indices:
                            existing_indices.append(i)
                        graph.nodes[target]["chunk_indices"] = existing_indices

                    graph.add_edge(source, target, relation=relation)

                all_entities.extend(entities)
                all_relationships.extend(relationships)

            # Step 7: Store everything in per-thread dicts
            self._thread_graphs[thread_id] = graph
            self._thread_vectorstores[thread_id] = vectorstore
            self._thread_chunks[thread_id] = chunks

            effective_filename = filename or "uploaded_document.pdf"
            self._thread_metadata[thread_id] = {
                "filename": effective_filename,
                "pages": len(pages),
                "chunks": len(chunks),
                "entities": len(all_entities),
                "relationships": len(all_relationships),
                "file_hash": hashlib.md5(file_bytes).hexdigest()
            }

            return {
                "filename": effective_filename,
                "pages": len(pages),
                "chunks": len(chunks),
                "entities": graph.number_of_nodes(),
                "relationships": graph.number_of_edges()
            }

        finally:
            # Clean up temp file
            try:
                os.unlink(tmp_path)
            except Exception:
                pass

    def _extract_entities_from_chunk(self, chunk_text: str, chunk_index: int) -> dict:
        """
        Use the LLM to extract entities and relationships from a single text chunk.

        Args:
            chunk_text: The text content of the chunk.
            chunk_index: Index of the chunk in the document.

        Returns:
            dict with keys 'entities' (list of entity dicts) and 'relationships' (list of rel dicts).
        """
        prompt = f"""You are an expert at extracting structured knowledge from text.
Given the following text chunk from a document, extract all important entities and relationships.

Text:
{chunk_text}

Respond ONLY with valid JSON (no markdown, no explanation):
{{
  "entities": [
    {{"name": "entity name", "type": "CONCEPT|PERSON|POLICY|DEPARTMENT|PROCESS|ROLE|DOCUMENT|EVENT", "description": "brief description"}}
  ],
  "relationships": [
    {{"source": "Entity1 name", "target": "Entity2 name", "relation": "describes the relationship"}}
  ]
}}"""

        try:
            response = self.llm.invoke([HumanMessage(content=prompt)])
            response_text = response.content.strip()

            # Strip markdown code fences if present
            if response_text.startswith("```"):
                lines = response_text.split("\n")
                # Remove first and last lines (code fences)
                lines = [l for l in lines if not l.strip().startswith("```")]
                response_text = "\n".join(lines)

            result = json.loads(response_text)
            return {
                "entities": result.get("entities", []),
                "relationships": result.get("relationships", [])
            }
        except (json.JSONDecodeError, Exception) as e:
            # If LLM response isn't valid JSON, return empty results
            return {"entities": [], "relationships": []}

    def _extract_query_entities(self, query: str) -> List[str]:
        """
        Use the LLM to extract entity names from a user's query.

        Args:
            query: The user's natural language query.

        Returns:
            List of entity name strings extracted from the query.
        """
        prompt = f"""Extract the key entity names from the following query. 
Return ONLY a JSON array of strings (no markdown, no explanation).

Query: {query}

Example response: ["Entity1", "Entity2", "Entity3"]"""

        try:
            response = self.llm.invoke([HumanMessage(content=prompt)])
            response_text = response.content.strip()

            # Strip markdown code fences if present
            if response_text.startswith("```"):
                lines = response_text.split("\n")
                lines = [l for l in lines if not l.strip().startswith("```")]
                response_text = "\n".join(lines)

            entities = json.loads(response_text)
            if isinstance(entities, list):
                return [str(e) for e in entities]
            return []
        except (json.JSONDecodeError, Exception):
            return []

    def _fuzzy_node_match(self, graph: nx.DiGraph, entity_name: str) -> Optional[str]:
        """
        Match an entity name to a graph node name using case-insensitive substring matching.

        Checks both directions: whether the query entity is a substring of a graph node name,
        or whether a graph node name is a substring of the query entity.

        Args:
            graph: The NetworkX DiGraph to search.
            entity_name: The entity name to match.

        Returns:
            The matched node name, or None if no match found.
        """
        entity_lower = entity_name.lower().strip()
        if not entity_lower:
            return None

        # First try exact case-insensitive match
        for node in graph.nodes():
            if node.lower().strip() == entity_lower:
                return node

        # Then try substring matching (query entity is substring of node name)
        for node in graph.nodes():
            node_lower = node.lower().strip()
            if entity_lower in node_lower:
                return node

        # Finally try reverse substring (node name is substring of query entity)
        for node in graph.nodes():
            node_lower = node.lower().strip()
            if node_lower in entity_lower and len(node_lower) > 2:
                return node

        return None

    def graph_enhanced_retrieval(self, query: str, thread_id: str, top_k: int = 4, graph_depth: int = 2) -> dict:
        """
        Perform graph-enhanced retrieval combining vector search with knowledge graph traversal.

        This is the key method that makes GraphRAG superior to plain RAG:
        1. Vector Search: FAISS retriever gets top_k similar chunks
        2. Entity Extraction: LLM extracts entities from the query
        3. Graph Traversal: BFS from matched entities up to graph_depth hops
        4. Merge Results: Combine vector + graph-discovered chunks, deduplicate
        5. Build combined context string

        Args:
            query: The user's natural language query.
            thread_id: The conversation thread ID.
            top_k: Number of top similar chunks from vector search.
            graph_depth: Maximum BFS depth for graph traversal.

        Returns:
            dict with keys: context, sources, graph_entities_used, traversal_paths
        """
        if thread_id not in self._thread_vectorstores:
            return {
                "context": "",
                "sources": [],
                "graph_entities_used": [],
                "traversal_paths": []
            }

        vectorstore = self._thread_vectorstores[thread_id]
        graph = self._thread_graphs.get(thread_id, nx.DiGraph())
        chunks = self._thread_chunks.get(thread_id, [])

        # Step 1: Vector search
        retriever = vectorstore.as_retriever(search_kwargs={"k": top_k})
        vector_results = retriever.invoke(query)

        # Collect chunk indices from vector results
        vector_chunk_indices = set()
        for doc in vector_results:
            idx = doc.metadata.get("chunk_index")
            if idx is not None:
                vector_chunk_indices.add(idx)

        # Step 2: Extract entities from the query
        query_entities = self._extract_query_entities(query)

        # Step 3: Graph traversal - BFS from matched entities
        graph_chunk_indices = set()
        graph_entities_used = []
        traversal_paths = []

        for entity_name in query_entities:
            matched_node = self._fuzzy_node_match(graph, entity_name)
            if matched_node is None:
                continue

            graph_entities_used.append(matched_node)

            # BFS traversal up to graph_depth hops
            visited = set()
            queue = deque([(matched_node, 0, [matched_node])])
            visited.add(matched_node)

            while queue:
                current_node, depth, path = queue.popleft()

                # Collect chunk indices from current node
                node_data = graph.nodes.get(current_node, {})
                node_chunks = node_data.get("chunk_indices", [])
                for ci in node_chunks:
                    graph_chunk_indices.add(ci)

                if depth >= graph_depth:
                    continue

                # Traverse both successors and predecessors for undirected-like BFS
                neighbors = set(graph.successors(current_node)) | set(graph.predecessors(current_node))
                for neighbor in neighbors:
                    if neighbor not in visited:
                        visited.add(neighbor)
                        new_path = path + [neighbor]
                        queue.append((neighbor, depth + 1, new_path))

                        # Record the traversal path
                        edge_data = graph.edges.get((current_node, neighbor), {})
                        if not edge_data:
                            edge_data = graph.edges.get((neighbor, current_node), {})
                        relation = edge_data.get("relation", "related_to")
                        traversal_paths.append(
                            f"{current_node} --[{relation}]--> {neighbor}"
                        )

        # Step 4: Merge results - combine vector + graph chunks, deduplicate
        all_chunk_indices = vector_chunk_indices | graph_chunk_indices

        # Build list of unique source documents
        sources = []
        seen_contents = set()

        for idx in sorted(all_chunk_indices):
            if idx < len(chunks):
                doc = chunks[idx]
                content_hash = hashlib.md5(doc.page_content.encode()).hexdigest()
                if content_hash not in seen_contents:
                    seen_contents.add(content_hash)
                    sources.append({
                        "content": doc.page_content,
                        "page": doc.metadata.get("page", 0),
                        "metadata": {
                            "chunk_index": idx,
                            "source": doc.metadata.get("source", ""),
                            "retrieval_method": "vector+graph" if idx in vector_chunk_indices and idx in graph_chunk_indices
                                else "vector" if idx in vector_chunk_indices
                                else "graph"
                        }
                    })

        # Step 5: Build combined context string
        context_parts = []
        for source in sources:
            context_parts.append(source["content"])
        context = "\n\n---\n\n".join(context_parts)

        return {
            "context": context,
            "sources": sources,
            "graph_entities_used": graph_entities_used,
            "traversal_paths": traversal_paths
        }

    def get_graph_data(self, thread_id: str) -> dict:
        """
        Return the knowledge graph as JSON suitable for visualization.

        Args:
            thread_id: The conversation thread ID.

        Returns:
            dict with keys 'nodes' and 'edges', each containing lists of dicts.
        """
        graph = self._thread_graphs.get(thread_id)
        if graph is None:
            return {"nodes": [], "edges": []}

        nodes = []
        for node_name, node_data in graph.nodes(data=True):
            nodes.append({
                "id": node_name,
                "label": node_name,
                "type": node_data.get("type", "CONCEPT"),
                "description": node_data.get("description", "")
            })

        edges = []
        for source, target, edge_data in graph.edges(data=True):
            edges.append({
                "source": source,
                "target": target,
                "label": edge_data.get("relation", "related_to")
            })

        return {"nodes": nodes, "edges": edges}

    def has_document(self, thread_id: str) -> bool:
        """
        Check whether a document has been ingested for the given thread.

        Args:
            thread_id: The conversation thread ID.

        Returns:
            True if a document has been ingested, False otherwise.
        """
        return thread_id in self._thread_vectorstores

    def get_metadata(self, thread_id: str) -> dict:
        """
        Get the ingestion metadata for a given thread.

        Args:
            thread_id: The conversation thread ID.

        Returns:
            dict with ingestion metadata, or empty dict if no document ingested.
        """
        return self._thread_metadata.get(thread_id, {})
