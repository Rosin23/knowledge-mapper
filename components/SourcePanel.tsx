import React from 'react';
import { Source, GroundingSupport } from '../types';

interface SourcePanelProps {
  sources: Source[];
  searchQueries?: string[];
  summary?: string;
  groundingSupports?: GroundingSupport[];
}

const getFaviconUrl = (uri: string) => {
  try {
    const domain = new URL(uri).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch {
    return '';
  }
};

const getDomain = (uri: string) => {
  try {
    return new URL(uri).hostname.replace('www.', '');
  } catch {
    return uri;
  }
}

export const SourcePanel: React.FC<SourcePanelProps> = ({ sources, searchQueries, summary, groundingSupports }) => {
  
  // Function to scroll to a specific source
  const scrollToSource = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    const element = document.getElementById(`source-${index}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Add a temporary highlight effect
      element.classList.add('ring-2', 'ring-blue-500');
      setTimeout(() => element.classList.remove('ring-2', 'ring-blue-500'), 1500);
    }
  };

  // Render summary text with inline citations
  const renderSummary = () => {
    if (!summary) return null;
    
    if (!groundingSupports || groundingSupports.length === 0) {
      return <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{summary}</p>;
    }

    // Sort supports by start index to handle them in order
    const sortedSupports = [...groundingSupports].sort((a, b) => a.segment.startIndex - b.segment.startIndex);
    
    // Filter supports that are within the summary text range
    // (In case supports refer to parts of text that were stripped out, e.g. JSON)
    const validSupports = sortedSupports.filter(s => s.segment.endIndex <= summary.length);

    if (validSupports.length === 0) {
        return <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{summary}</p>;
    }

    const elements = [];
    let lastIndex = 0;

    validSupports.forEach((support, i) => {
      // Add text before the support
      if (support.segment.startIndex > lastIndex) {
        elements.push(
          <span key={`text-${i}`}>
            {summary.substring(lastIndex, support.segment.startIndex)}
          </span>
        );
      }

      // Add the supported text segment
      // We wrap it in a subtle highlight or just append the citation?
      // Standard practice: text + [1]
      elements.push(
        <span key={`seg-${i}`} className="relative">
           {summary.substring(support.segment.startIndex, support.segment.endIndex)}
           {/* Render citations */}
           {support.groundingChunkIndices.map((chunkIndex, cid) => (
             <a
               key={`cit-${i}-${cid}`}
               href={`#source-${chunkIndex}`}
               onClick={(e) => scrollToSource(e, chunkIndex)}
               className="inline-flex items-center justify-center align-super text-[9px] font-bold text-blue-400 bg-blue-900/30 border border-blue-800/50 rounded-sm w-4 h-3 ml-0.5 hover:bg-blue-600 hover:text-white transition-colors cursor-pointer select-none no-underline"
               title={`Go to source ${chunkIndex + 1}`}
             >
               {chunkIndex + 1}
             </a>
           ))}
        </span>
      );

      lastIndex = support.segment.endIndex;
    });

    // Add remaining text
    if (lastIndex < summary.length) {
      elements.push(
        <span key="text-end">
          {summary.substring(lastIndex)}
        </span>
      );
    }

    return <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{elements}</p>;
  };

  return (
    <div className="w-full h-full flex flex-col p-4 overflow-hidden bg-slate-800/50 backdrop-blur-sm">
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        {/* Header */}
        <h2 className="text-sm uppercase tracking-wider text-slate-400 font-bold mb-4 sticky top-0 bg-slate-900/95 backdrop-blur-md py-3 z-10 border-b border-slate-800 flex items-center justify-between">
            <span className="flex items-center gap-2">
              Sources
              {sources.length > 0 && (
                <span className="bg-blue-900/50 text-blue-300 border border-blue-800 text-[10px] px-1.5 py-0.5 rounded-full">{sources.length}</span>
              )}
            </span>
        </h2>

        {/* AI Summary Section */}
        {summary && (
          <div className="mb-6 pb-4 border-b border-slate-800">
            <h3 className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2 pl-1 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              AI Summary
            </h3>
            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-800">
               {renderSummary()}
            </div>
          </div>
        )}

        {/* Search Queries Section */}
        {searchQueries && searchQueries.length > 0 && (
          <div className="mb-6">
            <h3 className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2 pl-1">Related Search Queries</h3>
            <div className="flex flex-wrap gap-2">
              {searchQueries.map((query, i) => (
                <div key={i} className="flex items-center gap-1.5 bg-slate-800/80 text-slate-300 px-2.5 py-1.5 rounded-md border border-slate-700/50 text-xs shadow-sm">
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                   </svg>
                   <span>{query}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sources List */}
        <div>
          {sources.length > 0 ? (
            <ul className="space-y-3 pb-4">
              {sources.map((source, idx) => (
                <li key={idx} id={`source-${idx}`} className="group scroll-mt-24">
                  <a 
                    href={source.uri} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-start gap-3 p-3 rounded-lg bg-slate-800 border border-slate-700 hover:border-blue-500 hover:bg-slate-750 transition-all duration-200 shadow-sm relative overflow-hidden group-hover:shadow-md"
                    title={`Open Source: ${source.title}`}
                  >
                    {/* Citation Index Badge */}
                    <div className="flex-shrink-0 mt-0.5 flex flex-col items-center gap-1">
                      <span className="flex items-center justify-center h-5 min-w-[1.25rem] px-1 rounded bg-slate-900 text-[10px] font-mono text-slate-400 border border-slate-700 group-hover:border-blue-500/30 group-hover:text-blue-400 transition-colors">
                        [{idx + 1}]
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                       {/* Title */}
                       <p className="text-sm font-medium text-blue-400 group-hover:text-blue-300 leading-snug mb-1 break-words flex items-start gap-1">
                         <span>{source.title && source.title !== "Unknown Source" ? source.title : getDomain(source.uri)}</span>
                       </p>
                       
                       {/* Metadata Row */}
                       <div className="flex items-center flex-wrap gap-2">
                         {/* Favicon */}
                         <img 
                           src={getFaviconUrl(source.uri)}
                           alt=""
                           className="w-3.5 h-3.5 rounded-sm opacity-60 group-hover:opacity-100 transition-opacity"
                           onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0'; }}
                         />
                         {/* Domain / Link */}
                         <div className="flex items-center gap-1 overflow-hidden">
                           <p className="text-[10px] text-slate-500 truncate font-mono group-hover:text-slate-400 transition-colors">
                             {getDomain(source.uri)}
                           </p>
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-slate-600 group-hover:text-blue-400 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                           </svg>
                         </div>
                         
                         {/* Grounding Support Badge (if cited) */}
                         {source.citationCount !== undefined && source.citationCount > 0 && (
                            <div className="ml-auto flex items-center gap-1 bg-green-900/20 text-green-400 border border-green-800/30 px-1.5 py-0.5 rounded text-[9px] font-medium" title={`Referenced ${source.citationCount} times in the model response`}>
                               <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                               </svg>
                               <span>Verified</span>
                            </div>
                         )}
                       </div>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center border border-dashed border-slate-700 rounded-lg bg-slate-800/30">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
               </svg>
              <p className="text-slate-500 text-sm">Sources and citations will appear here after your search.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};