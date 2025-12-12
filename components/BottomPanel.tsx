import React from 'react';
import { GraphNode, GraphData } from '../types';

interface BottomPanelProps {
  selectedNode: GraphNode | null;
  graphData: GraphData;
}

const BottomPanel: React.FC<BottomPanelProps> = ({ selectedNode, graphData }) => {
  const handleDownload = (format: 'json' | 'yaml') => {
    let content = '';
    let mimeType = 'text/plain';
    let extension = '';

    if (format === 'json') {
      content = JSON.stringify(graphData, null, 2);
      mimeType = 'application/json';
      extension = 'json';
    } else if (format === 'yaml') {
      content = convertToYaml(graphData);
      mimeType = 'text/yaml';
      extension = 'yaml';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `knowledge-graph.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const convertToYaml = (data: GraphData): string => {
    let yaml = '# Knowledge Graph Data\n\n';
    
    yaml += 'nodes:\n';
    data.nodes.forEach((n) => {
      yaml += `  - id: "${n.id}"\n`;
      yaml += `    label: "${n.label.replace(/"/g, '\\"')}"\n`;
      yaml += `    type: "${n.type}"\n`;
      yaml += `    description: "${n.description.replace(/"/g, '\\"')}"\n`;
      if (n.val) yaml += `    val: ${n.val}\n`;
    });

    if (data.edges && data.edges.length > 0) {
      yaml += '\nedges:\n';
      data.edges.forEach((e) => {
        const s = typeof e.source === 'object' ? (e.source as any).id : e.source;
        const t = typeof e.target === 'object' ? (e.target as any).id : e.target;
        
        yaml += `  - source: "${s}"\n`;
        yaml += `    target: "${t}"\n`;
        yaml += `    relation: "${e.relation.replace(/"/g, '\\"')}"\n`;
      });
    }

    return yaml;
  };

  const formatType = (type: string) => {
      switch(type) {
          case 'creativeWork': return 'Creative Work';
          case 'organization': return 'Organization';
          case 'product': return 'Product / Object';
          default: return type;
      }
  };

  return (
    <div className="h-full flex flex-col md:flex-row gap-6 p-4 bg-slate-900 border-t border-slate-700 overflow-hidden">
      {/* Selected Node Section */}
      <div className="flex-1 min-w-0 flex flex-col">
        <h2 className="text-sm uppercase tracking-wider text-slate-400 font-bold mb-2 flex-shrink-0">
          Selected Node
        </h2>
        <div className="flex-1 overflow-y-auto pr-2">
          {selectedNode ? (
            <div className="bg-slate-800 p-4 rounded-lg border border-slate-600 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                 <h3 className="text-xl font-bold text-white truncate pr-4">{selectedNode.label}</h3>
                 <span className={`px-2 py-0.5 rounded text-xs font-medium bg-slate-700 text-slate-300 capitalize border border-slate-600 whitespace-nowrap`}>
                   {formatType(selectedNode.type)}
                 </span>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed">
                {selectedNode.description}
              </p>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 text-sm italic p-4 border border-dashed border-slate-700 rounded-lg">
              Click on a node in the graph to view details.
            </div>
          )}
        </div>
      </div>

      {/* Export Section */}
      <div className="md:w-64 flex-shrink-0 flex flex-col">
        <h2 className="text-sm uppercase tracking-wider text-slate-400 font-bold mb-2 flex-shrink-0">
          Export Data
        </h2>
        <div className="flex flex-col gap-2">
           <button 
             onClick={() => handleDownload('json')}
             disabled={graphData.nodes.length === 0}
             className="w-full px-3 py-3 bg-slate-800 border border-slate-700 hover:bg-slate-700 hover:border-slate-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-2 group"
           >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400 group-hover:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
             </svg>
             Download JSON
           </button>
           <button 
             onClick={() => handleDownload('yaml')}
             disabled={graphData.nodes.length === 0}
             className="w-full px-3 py-3 bg-slate-800 border border-slate-700 hover:bg-slate-700 hover:border-slate-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-2 group"
           >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400 group-hover:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
             </svg>
             Download YAML
           </button>
        </div>
      </div>
    </div>
  );
};

export default BottomPanel;