import React, { useRef, useEffect, useState, useCallback } from 'react';
import { X, Network } from 'lucide-react';

/**
 * Color map for different entity types.
 */
const TYPE_COLORS = {
  CONCEPT: '#6366f1',
  PERSON: '#f59e0b',
  ROLE: '#f59e0b',
  POLICY: '#10b981',
  DEPARTMENT: '#ec4899',
  PROCESS: '#8b5cf6',
};
const DEFAULT_COLOR = '#6b7280';

function getNodeColor(type) {
  if (!type) return DEFAULT_COLOR;
  const upper = type.toUpperCase();
  return TYPE_COLORS[upper] || DEFAULT_COLOR;
}

/**
 * Canvas-based force-directed knowledge graph visualization.
 */
export default function KnowledgeGraphViz({ graphData, onClose }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const animationRef = useRef(null);
  const nodesRef = useRef([]);
  const edgesRef = useRef([]);
  const hoveredNodeRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const draggingRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0 });

  const hasData =
    graphData &&
    graphData.nodes &&
    graphData.nodes.length > 0;

  // Initialize simulation nodes and edges when graphData changes
  useEffect(() => {
    if (!hasData) {
      nodesRef.current = [];
      edgesRef.current = [];
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = canvas.width;
    const height = canvas.height;

    // Create simulation nodes with initial random positions
    const simNodes = graphData.nodes.map((node, i) => ({
      ...node,
      x: width / 2 + (Math.random() - 0.5) * Math.min(width, height) * 0.6,
      y: height / 2 + (Math.random() - 0.5) * Math.min(width, height) * 0.6,
      vx: 0,
      vy: 0,
      radius: 8,
      color: getNodeColor(node.type),
    }));

    // Build a quick lookup map from node id to index
    const idToIndex = {};
    simNodes.forEach((n, i) => {
      idToIndex[n.id] = i;
    });

    const simEdges = graphData.edges
      .map((edge) => ({
        ...edge,
        sourceIdx: idToIndex[edge.source],
        targetIdx: idToIndex[edge.target],
      }))
      .filter((e) => e.sourceIdx !== undefined && e.targetIdx !== undefined);

    nodesRef.current = simNodes;
    edgesRef.current = simEdges;
  }, [graphData, hasData]);

  // Resize canvas to fill container
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
  }, []);

  // Force simulation tick
  const tick = useCallback(() => {
    const nodes = nodesRef.current;
    const edges = edgesRef.current;
    if (nodes.length === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    // --- Force calculations ---
    const alpha = 0.3;
    const repulsion = 3000;
    const springLength = 100;
    const springK = 0.01;
    const centerPull = 0.005;
    const damping = 0.85;

    // Repulsion between all node pairs
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        let dx = nodes[j].x - nodes[i].x;
        let dy = nodes[j].y - nodes[i].y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 1;
        let force = repulsion / (dist * dist);
        let fx = (dx / dist) * force;
        let fy = (dy / dist) * force;
        nodes[i].vx -= fx * alpha;
        nodes[i].vy -= fy * alpha;
        nodes[j].vx += fx * alpha;
        nodes[j].vy += fy * alpha;
      }
    }

    // Spring forces along edges
    for (const edge of edges) {
      const a = nodes[edge.sourceIdx];
      const b = nodes[edge.targetIdx];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let dist = Math.sqrt(dx * dx + dy * dy) || 1;
      let displacement = dist - springLength;
      let force = springK * displacement;
      let fx = (dx / dist) * force;
      let fy = (dy / dist) * force;
      a.vx += fx * alpha;
      a.vy += fy * alpha;
      b.vx -= fx * alpha;
      b.vy -= fy * alpha;
    }

    // Center gravity pull
    for (const node of nodes) {
      node.vx += (width / 2 - node.x) * centerPull;
      node.vy += (height / 2 - node.y) * centerPull;
    }

    // Apply velocity and damping
    for (const node of nodes) {
      if (draggingRef.current && draggingRef.current.id === node.id) {
        node.vx = 0;
        node.vy = 0;
        continue;
      }
      node.vx *= damping;
      node.vy *= damping;
      node.x += node.vx;
      node.y += node.vy;

      // Keep within bounds
      const pad = 30;
      node.x = Math.max(pad, Math.min(width - pad, node.x));
      node.y = Math.max(pad, Math.min(height - pad, node.y));
    }
  }, []);

  // Draw the graph on the canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const ctx = canvas.getContext('2d');
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    ctx.clearRect(0, 0, width, height);

    const nodes = nodesRef.current;
    const edges = edgesRef.current;

    if (nodes.length === 0) return;

    // Draw edges
    for (const edge of edges) {
      const a = nodes[edge.sourceIdx];
      const b = nodes[edge.targetIdx];

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = 'rgba(107, 114, 128, 0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Arrowhead
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      const arrowLen = 8;
      const arrowX = b.x - Math.cos(angle) * (b.radius + 4);
      const arrowY = b.y - Math.sin(angle) * (b.radius + 4);

      ctx.beginPath();
      ctx.moveTo(arrowX, arrowY);
      ctx.lineTo(
        arrowX - arrowLen * Math.cos(angle - Math.PI / 7),
        arrowY - arrowLen * Math.sin(angle - Math.PI / 7)
      );
      ctx.lineTo(
        arrowX - arrowLen * Math.cos(angle + Math.PI / 7),
        arrowY - arrowLen * Math.sin(angle + Math.PI / 7)
      );
      ctx.closePath();
      ctx.fillStyle = 'rgba(107, 114, 128, 0.5)';
      ctx.fill();

      // Edge label (only draw if long enough)
      if (edge.label) {
        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2;
        const dist = Math.sqrt(
          (b.x - a.x) ** 2 + (b.y - a.y) ** 2
        );
        if (dist > 60) {
          ctx.save();
          ctx.font = '9px sans-serif';
          ctx.fillStyle = 'rgba(156, 163, 175, 0.7)';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(
            edge.label.length > 18
              ? edge.label.slice(0, 16) + '…'
              : edge.label,
            midX,
            midY - 3
          );
          ctx.restore();
        }
      }
    }

    // Draw nodes
    const hovered = hoveredNodeRef.current;
    for (const node of nodes) {
      const isHovered = hovered && hovered.id === node.id;
      const r = isHovered ? node.radius + 3 : node.radius;

      // Glow effect for hovered node
      if (isHovered) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, r + 4, 0, Math.PI * 2);
        ctx.fillStyle = node.color + '33';
        ctx.fill();
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      ctx.fillStyle = node.color;
      ctx.fill();
      ctx.strokeStyle = isHovered ? '#ffffff' : 'rgba(0,0,0,0.3)';
      ctx.lineWidth = isHovered ? 2 : 1;
      ctx.stroke();

      // Node label
      ctx.save();
      ctx.font = isHovered ? 'bold 11px sans-serif' : '10px sans-serif';
      ctx.fillStyle = '#e5e7eb';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const labelText =
        node.label && node.label.length > 16
          ? node.label.slice(0, 14) + '…'
          : node.label || node.id;
      ctx.fillText(labelText, node.x, node.y + r + 4);
      ctx.restore();
    }
  }, []);

  // Main animation loop
  useEffect(() => {
    if (!hasData) return;

    resizeCanvas();

    let running = true;
    function loop() {
      if (!running) return;
      tick();
      draw();
      animationRef.current = requestAnimationFrame(loop);
    }
    loop();

    return () => {
      running = false;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [hasData, tick, draw, resizeCanvas]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => resizeCanvas();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [resizeCanvas]);

  // Find node under cursor
  const findNodeAt = useCallback((cx, cy) => {
    const nodes = nodesRef.current;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      const dx = cx - n.x;
      const dy = cy - n.y;
      if (dx * dx + dy * dy <= (n.radius + 4) * (n.radius + 4)) {
        return n;
      }
    }
    return null;
  }, []);

  // Get mouse position relative to canvas
  const getCanvasPos = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  // Mouse events
  const handleMouseMove = useCallback(
    (e) => {
      const pos = getCanvasPos(e);
      mouseRef.current = pos;

      if (draggingRef.current) {
        draggingRef.current.x = pos.x;
        draggingRef.current.y = pos.y;
        return;
      }

      const node = findNodeAt(pos.x, pos.y);
      hoveredNodeRef.current = node;

      if (node && node.description) {
        setTooltip({
          x: e.clientX,
          y: e.clientY,
          label: node.label || node.id,
          type: node.type,
          description: node.description,
        });
      } else {
        setTooltip(null);
      }

      // Change cursor
      if (canvasRef.current) {
        canvasRef.current.style.cursor = node ? 'grab' : 'default';
      }
    },
    [findNodeAt, getCanvasPos]
  );

  const handleMouseDown = useCallback(
    (e) => {
      const pos = getCanvasPos(e);
      const node = findNodeAt(pos.x, pos.y);
      if (node) {
        draggingRef.current = node;
        if (canvasRef.current) {
          canvasRef.current.style.cursor = 'grabbing';
        }
      }
    },
    [findNodeAt, getCanvasPos]
  );

  const handleMouseUp = useCallback(() => {
    draggingRef.current = null;
    if (canvasRef.current) {
      canvasRef.current.style.cursor = 'default';
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    draggingRef.current = null;
    hoveredNodeRef.current = null;
    setTooltip(null);
  }, []);

  const nodeCount = graphData?.nodes?.length || 0;
  const edgeCount = graphData?.edges?.length || 0;

  return (
    <div className="w-96 flex-shrink-0 bg-gray-900 border-l border-gray-800 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Network className="w-5 h-5 text-purple-400" />
          <h3 className="text-sm font-semibold text-white">Knowledge Graph</h3>
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Graph canvas area */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        {hasData ? (
          <>
            <canvas
              ref={canvasRef}
              onMouseMove={handleMouseMove}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
              className="w-full h-full"
            />

            {/* Tooltip */}
            {tooltip && (
              <div
                className="fixed z-50 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 shadow-xl pointer-events-none max-w-[220px]"
                style={{
                  left: tooltip.x + 12,
                  top: tooltip.y - 10,
                }}
              >
                <p className="text-xs font-semibold text-white mb-0.5">
                  {tooltip.label}
                </p>
                {tooltip.type && (
                  <p
                    className="text-[10px] font-medium mb-1 uppercase tracking-wide"
                    style={{ color: getNodeColor(tooltip.type) }}
                  >
                    {tooltip.type}
                  </p>
                )}
                <p className="text-[11px] text-gray-300 leading-snug">
                  {tooltip.description.length > 120
                    ? tooltip.description.slice(0, 117) + '…'
                    : tooltip.description}
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-600 px-6 text-center">
            <Network className="w-12 h-12 mb-4 opacity-30" />
            <p className="text-sm">
              Upload a PDF to see the knowledge graph
            </p>
          </div>
        )}
      </div>

      {/* Stats footer */}
      {hasData && (
        <div className="px-4 py-2.5 border-t border-gray-800 flex items-center justify-between text-xs text-gray-500">
          <span>
            {nodeCount} {nodeCount === 1 ? 'entity' : 'entities'},{' '}
            {edgeCount} {edgeCount === 1 ? 'relationship' : 'relationships'}
          </span>
          {/* Legend dots */}
          <div className="flex items-center gap-2">
            {Object.entries(TYPE_COLORS)
              .slice(0, 4)
              .map(([type, color]) => (
                <div key={type} className="flex items-center gap-1">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-[10px] capitalize">
                    {type.toLowerCase()}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
