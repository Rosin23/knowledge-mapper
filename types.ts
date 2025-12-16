import * as d3 from 'd3';

export type NodeType = 'person' | 'organization' | 'place' | 'event' | 'creativeWork' | 'product' | 'concept';

export interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  type: NodeType;
  description: string;
  val?: number; // for visual sizing
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  relation: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphLink[];
}

export interface Source {
  title: string;
  uri: string;
  citationCount?: number;
}

export interface GroundingSupport {
  segment: {
    startIndex: number;
    endIndex: number;
    text: string;
  };
  groundingChunkIndices: number[];
  confidenceScores?: number[];
}

export interface GeminiResponse {
  graphData: GraphData;
  sources: Source[];
  searchQueries?: string[];
  summary?: string;
  groundingSupports?: GroundingSupport[];
}