import { GoogleGenAI } from "@google/genai";
import { GraphData, Source, GeminiResponse } from "../types";

const SYSTEM_INSTRUCTION = `
You are an expert knowledge graph generator acting as a semantic reasoning engine.
Your goal is to construct a high-quality Knowledge Graph (KG) based on the "Unified Schema" methodology described below.

### 1. METHODOLOGY & SEARCH
- **Search**: YOU MUST use the Google Search tool to gather comprehensive information about the user's query.
- **Analyze**: Extract entities and relationships with high semantic precision.
- **Safeguards**: 
  - Do not allow duplicate edges of the same type between the same node pair.
  - Ensure all relationships are semantically valid for the connected node types.

### 2. NODE SCHEMA
Map every identified entity to exactly one of these 7 semantic categories:
1. **person**: Individual humans.
2. **organization**: Corporations, governments, NGOs, teams.
3. **place**: Physical locations, countries, cities, celestial bodies.
4. **event**: Historical events, conferences, incidents.
5. **creativeWork**: Books, movies, software, laws, songs.
6. **product**: Physical objects, vehicles, gadgets, food (Schema: Product/Object).
7. **concept**: Theories, ideas, disciplines, emotions.

*Attributes*:
- **id**: Unique string identifier.
- **label**: Clear, concise display name.
- **type**: One of the 7 categories above.
- **description**: Brief summary of the entity.
- **val**: Importance score (1-10) for visualization sizing.

### 3. EDGE SCHEMA
- **Directional**: Edges are strictly directional (Source -> Target) representing semantic flow.
- **Semantics**: Relation labels MUST be **verb-like** (e.g., "authored", "locatedIn", "foundedBy", "causes", "influences"). 
  - **Avoid** nouns or generic terms like "relatedTo" or "connection".
- **Structure**:
  - { "source": "id_a", "target": "id_b", "relation": "verbPhrase" }

### 4. OUTPUT FORMAT
Return the result as a valid JSON object wrapped in a standard markdown code block (e.g., \`\`\`json ... \`\`\`).
The JSON object must strictly follow the schema with 'nodes' and 'edges' arrays.
Example:
\`\`\`json
{
  "nodes": [...],
  "edges": [...]
}
\`\`\`
`;

/**
 * Pure function to process the raw text and chunks from Gemini into a structured response.
 * Exported for TDD/Unit Testing.
 */
export const processGeminiOutput = (text: string, groundingChunks: any[] = []): GeminiResponse => {
  // 1. Extract sources from grounding metadata with deduplication
  const sourceMap = new Map<string, Source>();
  
  if (Array.isArray(groundingChunks)) {
    groundingChunks.forEach((chunk) => {
      // Check for standard web grounding chunk structure
      if (chunk && chunk.web) {
        const uri = chunk.web.uri;
        const title = chunk.web.title;
        
        // Only add if we have a URI and haven't seen it, or update if we have a better title
        if (uri && (!sourceMap.has(uri) || (title && sourceMap.get(uri)?.title === "Unknown Source"))) {
          sourceMap.set(uri, {
            title: title || "Unknown Source",
            uri: uri,
          });
        }
      }
    });
  }
  const sources = Array.from(sourceMap.values());

  // 2. Extract JSON using Regex to be robust against preamble text or markdown formatting
  let cleanText = text;
  const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
  
  if (jsonBlockMatch) {
    cleanText = jsonBlockMatch[1];
  } else {
    // Fallback cleanup if no code blocks found
    cleanText = cleanText.trim();
  }

  let graphData: GraphData = { nodes: [], edges: [] };
  
  try {
    // Try to find the first '{' and last '}' to handle potential preamble garbage not caught by regex
    const firstBrace = cleanText.indexOf('{');
    const lastBrace = cleanText.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleanText = cleanText.substring(firstBrace, lastBrace + 1);
    }

    graphData = JSON.parse(cleanText);
    
    // 3. Validate structure basics
    if (!graphData || !Array.isArray(graphData.nodes) || !Array.isArray(graphData.edges)) {
        // If structure is invalid but we have sources, return sources with empty graph
        console.warn("Invalid graph data structure, returning sources only.");
        return { graphData: { nodes: [], edges: [] }, sources };
    }

  } catch (parseError) {
    console.error("Failed to parse JSON:", cleanText);
    // If parsing fails but we have sources, return sources with empty graph
    if (sources.length > 0) {
        return { graphData: { nodes: [], edges: [] }, sources };
    }
    throw new Error("Failed to parse knowledge graph data from AI response.");
  }

  // 4. Data Integrity & Cleanup
  
  // Deduplicate nodes by ID
  const uniqueNodes = new Map();
  graphData.nodes.forEach((node) => {
    if (node && node.id) {
      uniqueNodes.set(String(node.id), node);
    }
  });
  const cleanedNodes = Array.from(uniqueNodes.values());

  // Filter Edges (Remove edges pointing to non-existent nodes)
  const nodeIds = new Set(cleanedNodes.map((n) => n.id));
  const cleanedEdges = [];

  for (const edge of graphData.edges) {
      const sourceId = String(edge.source);
      const targetId = String(edge.target);

      if (nodeIds.has(sourceId) && nodeIds.has(targetId)) {
          cleanedEdges.push({
              ...edge,
              source: sourceId,
              target: targetId
          });
      } else {
          // Log warning in development, but purely filter here
          console.warn(`Filtering broken edge: "${sourceId}" -> "${targetId}"`);
      }
  }

  return { 
    graphData: {
      nodes: cleanedNodes,
      edges: cleanedEdges
    }, 
    sources 
  };
};

export const fetchKnowledgeGraph = async (query: string): Promise<GeminiResponse> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Explicitly ask for search usage in the prompt
    const prompt = `Step 1: Perform a Google Search for "${query}" to gather facts. 
Step 2: Generate a knowledge graph JSON based on the search results.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        systemInstruction: SYSTEM_INSTRUCTION,
      },
    });

    const text = response.text || "";
    // Robustly access grounding chunks
    const candidates = response.candidates || [];
    const groundingMetadata = candidates[0]?.groundingMetadata;

    // Log for debugging visibility
    console.log("Gemini Grounding Metadata:", groundingMetadata);

    const chunks = groundingMetadata?.groundingChunks || [];

    return processGeminiOutput(text, chunks);

  } catch (error) {
    console.error("Gemini Service Error:", error);
    throw error;
  }
};
