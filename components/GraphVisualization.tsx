import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { GraphData, GraphNode, GraphLink } from '../types';

interface GraphVisualizationProps {
  data: GraphData;
  onNodeClick: (node: GraphNode | null) => void;
  selectedNode: GraphNode | null;
}

const COLORS: Record<string, string> = {
  person: '#ef4444',       // red
  organization: '#f97316', // orange
  place: '#10b981',        // green
  event: '#f59e0b',        // amber
  creativeWork: '#8b5cf6', // violet
  product: '#ec4899',      // pink
  concept: '#3b82f6',      // blue
};

const formatType = (type: string) => {
  switch(type) {
      case 'creativeWork': return 'Creative Work';
      case 'organization': return 'Organization';
      case 'product': return 'Product / Object';
      default: return type.charAt(0).toUpperCase() + type.slice(1);
  }
};

const GraphVisualization: React.FC<GraphVisualizationProps> = ({ data, onNodeClick, selectedNode }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [searchTerm, setSearchTerm] = useState('');

  // Improved Resize Observer to handle layout changes (e.g. sidebar toggle)
  useEffect(() => {
    if (!wrapperRef.current) return;
    
    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    resizeObserver.observe(wrapperRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Zoom Handlers
  const handleZoomIn = () => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(300)
        .call(zoomRef.current.scaleBy, 1.2);
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(300)
        .call(zoomRef.current.scaleBy, 0.8);
    }
  };

  const handleResetZoom = () => {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(750)
        .call(zoomRef.current.transform, d3.zoomIdentity);
    }
  };

  // Main Effect: Render the graph when data changes
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const tooltip = d3.select(tooltipRef.current);
    
    // Always clear previous render first to ensure clean state
    svg.selectAll('*').remove();

    // If no data, we are done (canvas is cleared)
    if (!data.nodes.length) return;

    const width = dimensions.width;
    const height = dimensions.height;

    // Background click handler to deselect
    svg.on('click', (event) => {
      if (event.target === svg.node()) {
        onNodeClick(null);
      }
    });

    // Define Arrow Marker
    svg.append('defs').append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 22) 
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#e2e8f0'); // Light slate (slate-200) for high visibility

    // Create a deep copy of data for d3 mutation
    const nodes: GraphNode[] = data.nodes.map(d => ({ ...d }));
    const links: GraphLink[] = data.edges.map(d => ({ ...d }));

    // Zoom setup
    const g = svg.append('g');
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
    svg.call(zoom);
    zoomRef.current = zoom;

    // Simulation setup
    const simulation = d3.forceSimulation<GraphNode>(nodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(links).id(d => d.id).distance(220)) 
      .force('charge', d3.forceManyBody().strength(-500))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide<GraphNode>().radius(d => (d.val || 5) * 5 + 25));

    // Render Links as Paths (Curves)
    const link = g.append('g')
      .attr('fill', 'none')
      .attr('stroke', '#e2e8f0') // Slate-200 for better visibility
      .selectAll('path')
      .data(links)
      .join('path')
      .attr('class', 'link')
      .attr('stroke-width', 3) // Increased thickness
      .attr('opacity', 0.9) // Increased opacity
      .attr('marker-end', 'url(#arrowhead)');

    // Link Labels (Relationships)
    const linkText = g.append('g')
      .attr('class', 'link-labels')
      .selectAll('text')
      .data(links)
      .join('text')
      .text(d => d.relation)
      .attr('font-size', '10px')
      .attr('fill', '#e2e8f0') // Match link color
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em') 
      .style('pointer-events', 'none')
      // Add halo stroke to improve readability against lines/background
      .style('paint-order', 'stroke')
      .style('stroke', '#0f172a') // Match background color
      .style('stroke-width', '3px')
      .style('stroke-linecap', 'butt')
      .style('stroke-linejoin', 'round');

    // Render Nodes
    const node = g.append('g')
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .selectAll('circle')
      .data(nodes)
      .join('circle')
      .attr('class', 'node')
      .attr('r', d => Math.max(5, (d.val || 5) * 3))
      .attr('fill', d => COLORS[d.type] || COLORS.concept)
      .attr('cursor', 'pointer')
      .call(d3.drag<SVGCircleElement, GraphNode>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended)
      )
      .on('click', (event, d) => {
        event.stopPropagation();
        onNodeClick(d);
      })
      .on('mouseover', (event, d) => {
        tooltip.transition().duration(200).style('opacity', 1);
        
        const typeLabel = formatType(d.type);
        const color = COLORS[d.type] || COLORS.concept;
        
        tooltip.html(`
          <div class="font-bold text-sm text-slate-100 mb-1">${d.label}</div>
          <div class="text-xs font-medium flex items-center gap-2 bg-slate-700/50 px-2 py-1 rounded mb-2">
             <span class="w-2 h-2 rounded-full inline-block" style="background-color: ${color}"></span>
             <span class="text-slate-300 capitalize">${typeLabel}</span>
          </div>
          <div class="text-xs text-slate-400 leading-relaxed">${d.description}</div>
        `);
      })
      .on('mousemove', (event) => {
         const [x, y] = d3.pointer(event, wrapperRef.current);
         tooltip
           .style('left', `${x + 15}px`)
           .style('top', `${y + 15}px`);
      })
      .on('mouseout', () => {
        tooltip.transition().duration(200).style('opacity', 0);
      });

    // Node Labels
    const nodeText = g.append('g')
      .selectAll('text')
      .data(nodes)
      .join('text')
      .attr('class', 'node-label')
      .text(d => d.label)
      .attr('x', 12)
      .attr('y', 4)
      .attr('font-size', '12px')
      .attr('fill', '#e2e8f0')
      .attr('pointer-events', 'none')
      .style('text-shadow', '0px 0px 3px #000');

    // Helper to calculate radius
    const getRadius = (d: GraphNode) => Math.max(5, (d.val || 5) * 3);

    // Simulation Tick
    simulation.on('tick', () => {
      link.attr('d', function(d: any) {
        const sourceX = d.source.x;
        const sourceY = d.source.y;
        const targetX = d.target.x;
        const targetY = d.target.y;
        
        const dx = targetX - sourceX;
        const dy = targetY - sourceY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // Target node radius plus a small buffer for the arrow
        const targetRadius = getRadius(d.target) + 8; 

        if (dist === 0) {
           return `M${sourceX},${sourceY}L${targetX},${targetY}`;
        }

        // Calculate straight-line endpoint intersection
        const unitX = dx / dist;
        const unitY = dy / dist;
        const newTargetX = targetX - (unitX * targetRadius);
        const newTargetY = targetY - (unitY * targetRadius);

        // Curve radius - larger factor means flatter curve. 
        // Using dist * 2 creates a subtle consistent curve.
        const dr = dist * 2; 

        return `M${sourceX},${sourceY}A${dr},${dr} 0 0,1 ${newTargetX},${newTargetY}`;
      });

      linkText
        .attr('x', d => {
          const sNode = d.source as GraphNode;
          const tNode = d.target as GraphNode;
          const dx = tNode.x! - sNode.x!;
          const dy = tNode.y! - sNode.y!;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist === 0) return sNode.x!;
          
          const midX = (sNode.x! + tNode.x!) / 2;
          
          // Calculate curve offset (Sagitta) to place text on the arc
          // Radius r = dist * 2
          const r = dist * 2;
          const sagitta = r - Math.sqrt(r * r - (dist / 2) ** 2);
          
          // Normal vector (-dy, dx) normalized
          const offsetX = (-dy / dist) * sagitta;
          
          return midX + offsetX;
        })
        .attr('y', d => {
          const sNode = d.source as GraphNode;
          const tNode = d.target as GraphNode;
          const dx = tNode.x! - sNode.x!;
          const dy = tNode.y! - sNode.y!;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist === 0) return sNode.y!;

          const midY = (sNode.y! + tNode.y!) / 2;
          
          const r = dist * 2;
          const sagitta = r - Math.sqrt(r * r - (dist / 2) ** 2);
          
          // Normal vector (-dy, dx) normalized -> Y component is dx
          const offsetY = (dx / dist) * sagitta;
          
          return midY + offsetY;
        });

      node
        .attr('cx', d => d.x!)
        .attr('cy', d => d.y!);

      nodeText
        .attr('x', d => d.x! + getRadius(d) + 5)
        .attr('y', d => d.y! + 4);
    });

    function dragstarted(event: d3.D3DragEvent<SVGCircleElement, GraphNode, GraphNode>, d: GraphNode) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: d3.D3DragEvent<SVGCircleElement, GraphNode, GraphNode>, d: GraphNode) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: d3.D3DragEvent<SVGCircleElement, GraphNode, GraphNode>, d: GraphNode) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    return () => {
      simulation.stop();
    };
  }, [data, dimensions, onNodeClick]); // Re-run only when data structure or dimensions change

  // Style Effect: Highlight/Dim nodes based on selectedNode or searchTerm
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    
    // Select elements
    const nodes = svg.selectAll<SVGCircleElement, GraphNode>('.node');
    const links = svg.selectAll<SVGPathElement, GraphLink>('.link');
    const labels = svg.selectAll<SVGTextElement, GraphLink>('.link-labels text');
    const nodeLabels = svg.selectAll<SVGTextElement, GraphNode>('.node-label');

    // 1. Search Filter Mode
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const isMatch = (d: GraphNode) => 
        d.label.toLowerCase().includes(term) || d.type.toLowerCase().includes(term);

      nodes.transition().duration(300)
        .attr('opacity', d => isMatch(d) ? 1 : 0.1)
        .attr('stroke', d => isMatch(d) ? '#fff' : null)
        .attr('stroke-width', d => isMatch(d) ? 2.5 : 0);

      nodeLabels.transition().duration(300)
        .attr('opacity', d => isMatch(d) ? 1 : 0.1);

      // Links only visible if both ends match
      links.transition().duration(300)
        .attr('opacity', function(d) {
            const source = d.source as GraphNode;
            const target = d.target as GraphNode;
            return (isMatch(source) && isMatch(target)) ? 1 : 0.05;
        })
        .attr('stroke', function(d) {
            const source = d.source as GraphNode;
            const target = d.target as GraphNode;
            return (isMatch(source) && isMatch(target)) ? '#f1f5f9' : '#334155';
        })
        .attr('stroke-width', function(d) {
            const source = d.source as GraphNode;
            const target = d.target as GraphNode;
            return (isMatch(source) && isMatch(target)) ? 4 : 1;
        });

      labels.transition().duration(300)
        .attr('opacity', function(d) {
            const source = d.source as GraphNode;
            const target = d.target as GraphNode;
            return (isMatch(source) && isMatch(target)) ? 1 : 0.05;
        });

      return;
    }

    // 2. Selection Mode
    if (selectedNode) {
      // Identify neighbors
      const neighborIds = new Set<string>();
      neighborIds.add(selectedNode.id);

      // Iterate links to find connections
      links.each((d) => {
        // Safe access to ID whether D3 has processed the link (object) or not (string)
        const sourceId = typeof d.source === 'object' ? (d.source as GraphNode).id : d.source as string;
        const targetId = typeof d.target === 'object' ? (d.target as GraphNode).id : d.target as string;
        
        if (sourceId === selectedNode.id) neighborIds.add(targetId);
        if (targetId === selectedNode.id) neighborIds.add(sourceId);
      });

      // Apply Highlight Styles
      nodes.each(function(d) {
        const isNeighbor = neighborIds.has(d.id);
        const isSelected = d.id === selectedNode.id;
        
        d3.select(this)
          .transition().duration(300)
          .attr('opacity', isNeighbor ? 1 : 0.1)
          .attr('stroke', isSelected ? '#fff' : (isNeighbor ? '#e2e8f0' : '#fff'))
          .attr('stroke-width', isSelected ? 4 : (isNeighbor ? 2 : 1.5));
      });

      nodeLabels.transition().duration(300)
        .attr('opacity', (d) => neighborIds.has(d.id) ? 1 : 0.1);

      links.each(function(d) {
        const sourceId = typeof d.source === 'object' ? (d.source as GraphNode).id : d.source as string;
        const targetId = typeof d.target === 'object' ? (d.target as GraphNode).id : d.target as string;

        const isConnected = (sourceId === selectedNode.id || targetId === selectedNode.id);
        
        d3.select(this)
          .transition().duration(300)
          .attr('opacity', isConnected ? 1 : 0.1)
          .attr('stroke', isConnected ? '#f1f5f9' : '#334155') // Highlight / Dim
          .attr('stroke-width', isConnected ? 4 : 1);
      });

      labels.each(function(d) {
        const sourceId = typeof d.source === 'object' ? (d.source as GraphNode).id : d.source as string;
        const targetId = typeof d.target === 'object' ? (d.target as GraphNode).id : d.target as string;
        const isConnected = (sourceId === selectedNode.id || targetId === selectedNode.id);

        d3.select(this).transition().duration(300).attr('opacity', isConnected ? 1 : 0.05);
      });
      return;
    }

    // 3. Default Mode (Reset)
    nodes
      .transition().duration(300)
      .attr('opacity', 1)
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5);
    
    links
      .transition().duration(300)
      .attr('opacity', 0.9)
      .attr('stroke', '#e2e8f0')
      .attr('stroke-width', 3);
    
    labels.transition().duration(300).attr('opacity', 1);
    nodeLabels.transition().duration(300).attr('opacity', 1);

  }, [selectedNode, data, searchTerm]); // Run when selectedNode, data, or searchTerm changes

  return (
    <div ref={wrapperRef} className="w-full h-full overflow-hidden bg-slate-900 rounded-lg shadow-inner relative">
       {/* Tooltip Div */}
       <div 
         ref={tooltipRef}
         className="absolute pointer-events-none bg-slate-800 border border-slate-700 p-3 rounded-lg shadow-xl z-50 opacity-0 transition-opacity"
         style={{ minWidth: '150px', maxWidth: '300px' }}
       />

       {/* Filter Input - Moved down to top-24 to avoid collision with main search bar */}
       <div className="absolute top-24 right-4 z-10 w-64 group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-4 w-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Filter nodes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-800/90 backdrop-blur-md border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500 shadow-lg placeholder-slate-500 transition-all"
          />
       </div>

       {/* Zoom Controls */}
       <div className="absolute bottom-6 left-6 flex flex-col gap-2 z-10">
        <button
          onClick={handleZoomIn}
          className="p-2 bg-slate-800/90 backdrop-blur border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700 hover:text-white transition-all shadow-lg active:scale-95"
          title="Zoom In"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
        </button>
        <button
          onClick={handleZoomOut}
          className="p-2 bg-slate-800/90 backdrop-blur border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700 hover:text-white transition-all shadow-lg active:scale-95"
          title="Zoom Out"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
        </button>
        <button
          onClick={handleResetZoom}
          className="p-2 bg-slate-800/90 backdrop-blur border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700 hover:text-white transition-all shadow-lg active:scale-95"
          title="Reset View"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 11-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 7a1 1 0 012 0v1.586l2.293-2.293a1 1 0 111.414 1.414L6.414 15H8a1 1 0 010 2H4a1 1 0 01-1-1v-4zm13-1a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 010-2h1.586l-2.293-2.293a1 1 0 111.414-1.414L15 13.586V12a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
       
       {data.nodes.length === 0 && (
         <div className="absolute inset-0 flex items-center justify-center text-slate-500 pointer-events-none">
           <p>Enter a query to generate a knowledge graph</p>
         </div>
       )}
      <svg ref={svgRef} width="100%" height="100%" className="block touch-none" />
    </div>
  );
};

export default GraphVisualization;