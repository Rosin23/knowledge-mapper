import React, { useState, useRef, useEffect } from 'react';
import GraphVisualization from './components/GraphVisualization';
import { SourcePanel } from './components/SourcePanel';
import BottomPanel from './components/BottomPanel';
import { fetchKnowledgeGraph } from './services/geminiService';
import { GraphData, Source, GraphNode } from './types';

// Custom hook to persist state in localStorage
function usePersistedState<T>(key: string, initialValue: T) {
  const [state, setState] = useState<T>(() => {
    try {
      if (typeof window !== 'undefined') {
        const item = window.localStorage.getItem(key);
        return item ? JSON.parse(item) : initialValue;
      }
      return initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(state));
      }
    } catch (error) {
      console.warn(`Error writing localStorage key "${key}":`, error);
    }
  }, [key, state]);

  return [state, setState] as const;
}

const App: React.FC = () => {
  // Persisted Core Data
  const [query, setQuery] = usePersistedState<string>('km_query', '');
  const [graphData, setGraphData] = usePersistedState<GraphData>('km_graphData', { nodes: [], edges: [] });
  const [sources, setSources] = usePersistedState<Source[]>('km_sources', []);
  
  // Transient UI State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  // Persisted Layout States
  const [isSidebarOpen, setSidebarOpen] = usePersistedState<boolean>('km_isSidebarOpen', false);
  const [isBottomPanelOpen, setBottomPanelOpen] = usePersistedState<boolean>('km_isBottomPanelOpen', true);
  const [isLegendOpen, setLegendOpen] = usePersistedState<boolean>('km_isLegendOpen', true);
  
  // Persisted Resizable Panel States
  const [sidebarWidth, setSidebarWidth] = usePersistedState<number>('km_sidebarWidth', 320);
  const [bottomHeight, setBottomHeight] = usePersistedState<number>('km_bottomHeight', 250);
  
  const sidebarRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isResizingSidebar = useRef(false);
  const isResizingBottom = useRef(false);

  // Resize Handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingSidebar.current) {
        const newWidth = Math.max(200, Math.min(600, e.clientX));
        setSidebarWidth(newWidth);
      }
      if (isResizingBottom.current) {
        const newHeight = Math.max(150, Math.min(window.innerHeight * 0.6, window.innerHeight - e.clientY));
        setBottomHeight(newHeight);
      }
    };

    const handleMouseUp = () => {
      isResizingSidebar.current = false;
      isResizingBottom.current = false;
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Auto-open sidebar when sources are populated
  useEffect(() => {
    // Only auto-open if we have sources and it's currently closed.
    // Note: This runs on mount too. If user refreshed with sources, sidebar opens.
    if (sources.length > 0 && !isSidebarOpen) {
      setSidebarOpen(true);
    }
  }, [sources]); // Intentionally kept simplistic as per original design

  const startResizingSidebar = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizingSidebar.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const startResizingBottom = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizingBottom.current = true;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setSelectedNode(null);
    
    // Explicitly clear graph data and sources to ensure a clean state for the new search
    setGraphData({ nodes: [], edges: [] });
    setSources([]);

    try {
      const { graphData: newData, sources: newSources } = await fetchKnowledgeGraph(query);
      setGraphData(newData);
      setSources(newSources);
      
      // If graph is empty but we have sources, show a specific error hint or just let the empty graph state handle it
      if (newData.nodes.length === 0 && newSources.length > 0) {
         setError("Search sources were found (see sidebar), but the AI could not generate a valid knowledge graph structure for this query. Please try a different or more specific topic.");
      } else if (newData.nodes.length === 0) {
         setError("No knowledge graph could be generated. Please try a different query.");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-slate-950 overflow-hidden text-slate-200 relative">
      
      {/* Sidebar Toggle Button */}
      <button 
        onClick={() => setSidebarOpen(!isSidebarOpen)} 
        className="absolute top-4 left-4 z-40 p-2.5 bg-slate-800/90 backdrop-blur rounded-lg border border-slate-700 hover:bg-slate-700 hover:border-blue-500 text-slate-300 transition-all shadow-lg"
        title={isSidebarOpen ? "Close Sidebar" : "Open Sidebar"}
      >
        {isSidebarOpen ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
             <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
        )}
      </button>

      {/* Left Sidebar (Resizable) */}
      <aside 
        ref={sidebarRef}
        style={{ width: isSidebarOpen ? sidebarWidth : 0 }}
        className={`
          relative z-30 h-full bg-slate-900/95 backdrop-blur-xl border-r border-slate-800 transition-[width] duration-300 ease-in-out flex-shrink-0 overflow-hidden
          ${!isSidebarOpen && 'border-none'}
        `}
      >
         <div 
           className="h-full flex flex-col"
           style={{ width: sidebarWidth }} // Fix content width to prevent reflow during transition
         > 
           {/* Spacer for the toggle button */}
           <div className="h-16 flex-shrink-0" />

           {/* Content */}
           <div className="flex-1 min-h-0 relative">
             <SourcePanel sources={sources} />
           </div>
           
           {/* Resize Handle */}
           {isSidebarOpen && (
             <div 
                className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-blue-500/50 transition-colors z-50"
                onMouseDown={startResizingSidebar}
             />
           )}
         </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full relative overflow-hidden min-w-0">
        
        {/* Header / Search Bar */}
        <header className="absolute top-0 left-0 right-0 z-20 p-4 pointer-events-none flex justify-center">
          <div className="w-full max-w-2xl pointer-events-auto transition-all duration-300 px-4 md:px-0">
             <form onSubmit={handleSearch} className="relative group">
               <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                 {loading ? (
                    <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                 ) : (
                    <svg className="h-5 w-5 text-slate-400 group-focus-within:text-blue-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                 )}
               </div>
               <input
                 type="text"
                 className="block w-full pl-12 pr-4 py-3 bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all shadow-lg"
                 placeholder="Search a topic to map... (e.g. 'Quantum Physics', 'History of Rome')"
                 value={query}
                 onChange={(e) => setQuery(e.target.value)}
                 disabled={loading}
               />
             </form>
             {error && (
               <div className="mt-2 bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-2 rounded-lg backdrop-blur-sm shadow-xl">
                 {error}
               </div>
             )}
          </div>
        </header>

        {/* Main Graph */}
        <main className="flex-1 w-full relative min-h-0">
          <GraphVisualization 
            data={graphData} 
            onNodeClick={setSelectedNode} 
            selectedNode={selectedNode}
          />
          
          {/* Bottom Panel Toggle Button */}
          <button 
            onClick={() => setBottomPanelOpen(!isBottomPanelOpen)} 
            className="absolute bottom-4 right-4 z-40 p-2.5 bg-slate-800/90 backdrop-blur rounded-lg border border-slate-700 hover:bg-slate-700 hover:border-blue-500 text-slate-300 transition-all shadow-lg"
            title={isBottomPanelOpen ? "Close Details" : "Open Details"}
          >
            {isBottomPanelOpen ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            )}
          </button>

          {/* Collapsible Legend Overlay (Stacked above toggle button) */}
          <div className={`
              absolute bottom-16 right-4 z-20 bg-slate-900/90 backdrop-blur-md border border-slate-700 shadow-2xl rounded-lg transition-all duration-300
              ${isLegendOpen ? 'w-48 p-3' : 'w-auto p-2 cursor-pointer hover:bg-slate-800'}
          `}>
             <div 
               className="flex items-center justify-between cursor-pointer"
               onClick={() => setLegendOpen(!isLegendOpen)}
             >
               <h3 className={`text-xs font-bold text-slate-400 uppercase tracking-wide ${!isLegendOpen && 'hidden'}`}>Legend</h3>
               <button className="text-slate-500 hover:text-slate-300 transition-colors">
                 {isLegendOpen ? (
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                     <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                   </svg>
                 ) : (
                   <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Legend</span>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                      </svg>
                   </div>
                 )}
               </button>
             </div>
             
             {isLegendOpen && (
               <div className="mt-2 space-y-1.5 text-xs animate-fade-in">
                 <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#ef4444]"></span> Person</div>
                 <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#f97316]"></span> Organization</div>
                 <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#10b981]"></span> Place</div>
                 <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#f59e0b]"></span> Event</div>
                 <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#8b5cf6]"></span> Creative Work</div>
                 <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#ec4899]"></span> Product</div>
                 <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#3b82f6]"></span> Concept</div>
               </div>
             )}
          </div>
        </main>

        {/* Bottom Panel (Resizable) */}
        <div 
          ref={bottomRef}
          style={{ height: isBottomPanelOpen ? bottomHeight : 0 }}
          className={`
            relative z-30 bg-slate-900 border-t border-slate-800 flex-shrink-0 shadow-[0_-5px_15px_rgba(0,0,0,0.3)] transition-[height] duration-300 ease-in-out
            ${!isBottomPanelOpen && 'border-none'}
          `}
        >
          {/* Resize Handle - only visible when open */}
          {isBottomPanelOpen && (
            <div 
               className="absolute top-0 left-0 w-full h-1.5 cursor-row-resize hover:bg-blue-500/50 transition-colors z-50"
               onMouseDown={startResizingBottom}
            />
          )}
          <BottomPanel selectedNode={selectedNode} graphData={graphData} />
        </div>
      </div>
    </div>
  );
};

export default App;