import * as d3 from 'd3';

export type NodeType = 'person' | 'organization' | 'place' | 'event' | 'creativeWork' | 'product' | 'concept';

export interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  type: NodeType;
  description: string;
  val?: number; // for visual sizing
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
}

export interface GeminiResponse {
  graphData: GraphData;
  sources: Source[];
}