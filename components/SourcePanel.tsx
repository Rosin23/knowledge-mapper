import React from 'react';
import { Source } from '../types';

interface SourcePanelProps {
  sources: Source[];
}

export const SourcePanel: React.FC<SourcePanelProps> = ({ sources }) => {
  return (
    <div className="w-full h-full flex flex-col p-4 overflow-hidden bg-slate-800/50 backdrop-blur-sm">
      <div className="flex-1 overflow-y-auto pr-2">
        {/* Sources Section */}
        <div>
          <h2 className="text-sm uppercase tracking-wider text-slate-400 font-bold mb-3 flex items-center gap-2 sticky top-0 bg-slate-900/0 backdrop-blur-sm py-2">
            <span>Search Sources</span>
            {sources.length > 0 && (
               <span className="bg-slate-700 text-slate-300 text-[10px] px-1.5 py-0.5 rounded-full">{sources.length}</span>
            )}
          </h2>
          
          {sources.length > 0 ? (
            <ul className="space-y-2 pb-4">
              {sources.map((source, idx) => (
                <li key={idx} className="group">
                  <a 
                    href={source.uri} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block p-3 rounded-lg bg-slate-800 border border-slate-700 hover:border-blue-500 hover:bg-slate-750 transition-all duration-200 shadow-sm"
                  >
                    <p className="text-sm font-medium text-blue-400 group-hover:text-blue-300 truncate mb-1">
                      {source.title}
                    </p>
                    <p className="text-xs text-slate-500 truncate font-mono">
                      {source.uri}
                    </p>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-slate-500 text-sm p-4 border border-dashed border-slate-700 rounded-lg text-center mt-4">
              Sources will appear here after searching.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
