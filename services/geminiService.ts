import { GoogleGenAI } from "@google/genai";
import { GraphData, Source, GeminiResponse, GroundingSupport } from "../types";

const SYSTEM_INSTRUCTION = `
You are an expert knowledge graph generator acting as a semantic reasoning engine.
Your goal is to construct a high-quality Knowledge Graph (KG) based on the "Unified Schema" methodology.

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
The output MUST be in two parts:
1. **Summary**: A concise, informative summary of the topic (1-2 paragraphs).
2. **Graph Data**: A valid JSON object wrapped in a markdown code block (\`\`\`json ... \`\`\`).

Example:
Here is a summary of the topic...
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
export const processGeminiOutput = (text: string, groundingChunks: any[] = [], groundingSupports: any[] = [], searchQueries: string[] = []): GeminiResponse => {
  // 1. Extract sources from grounding metadata with deduplication and support counting
  const sourceMap = new Map<string, Source>();
  const chunkIndexToUriMap = new Map<number, string>(); // To map support indices back to URIs
  
  if (Array.isArray(groundingChunks)) {
    groundingChunks.forEach((chunk, index) => {
      // Check for standard web grounding chunk structure
      if (chunk && chunk.web) {
        const uri = chunk.web.uri;
        const title = chunk.web.title;
        
        if (uri) {
           // Normalize URI for deduplication (remove trailing slash)
           const normalizedUri = uri.endsWith('/') ? uri.slice(0, -1) : uri;
           
           // Map this chunk index to the URI
           chunkIndexToUriMap.set(index, normalizedUri);

           const existing = sourceMap.get(normalizedUri);

           // Update if new, or if we have a better title for an existing placeholder
           if (!existing || (existing.title === "Unknown Source" && title)) {
             sourceMap.set(normalizedUri, {
               title: title || "Unknown Source",
               uri: uri,
               citationCount: 0
             });
           }
        }
      }
    });
  }

  // 2. Process Grounding Supports to count citations
  // Also keep track of supports for the response object
  const cleanSupports: GroundingSupport[] = [];

  if (Array.isArray(groundingSupports)) {
    groundingSupports.forEach((support) => {
      cleanSupports.push(support); // Store for return
      if (support.groundingChunkIndices) {
        support.groundingChunkIndices.forEach((chunkIndex: number) => {
          const uri = chunkIndexToUriMap.get(chunkIndex);
          if (uri) {
            const source = sourceMap.get(uri);
            if (source) {
              source.citationCount = (source.citationCount || 0) + 1;
            }
          }
        });
      }
    });
  }

  const sources = Array.from(sourceMap.values());

  // 3. Extract JSON using Regex to be robust against preamble text or markdown formatting
  // The preamble is treated as the summary.
  let cleanText = text;
  let summary = "";
  
  const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
  
  if (jsonBlockMatch) {
    cleanText = jsonBlockMatch[1];
    // Everything before the code block is the summary
    summary = text.substring(0, jsonBlockMatch.index).trim();
  } else {
    // Fallback: try to find start of JSON object
    const firstBrace = text.indexOf('{');
    if (firstBrace > 0) {
        summary = text.substring(0, firstBrace).trim();
        cleanText = text.substring(firstBrace);
    } else {
        cleanText = text.trim();
    }
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
    
    // 4. Validate structure basics
    if (!graphData || !Array.isArray(graphData.nodes) || !Array.isArray(graphData.edges)) {
        console.warn("Invalid graph data structure, returning sources only.");
        return { graphData: { nodes: [], edges: [] }, sources, searchQueries, summary, groundingSupports: cleanSupports };
    }

  } catch (parseError) {
    console.error("Failed to parse JSON:", cleanText);
    if (sources.length > 0) {
        return { graphData: { nodes: [], edges: [] }, sources, searchQueries, summary, groundingSupports: cleanSupports };
    }
    throw new Error("Failed to parse knowledge graph data from AI response.");
  }

  // 5. Data Integrity & Cleanup
  
  // Deduplicate nodes by ID
  const uniqueNodes = new Map();
  graphData.nodes.forEach((node) => {
    if (node && node.id) {
      uniqueNodes.set(String(node.id), node);
    }
  });
  const cleanedNodes = Array.from(uniqueNodes.values());

  // Filter Edges
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
          console.warn(`Filtering broken edge: "${sourceId}" -> "${targetId}"`);
      }
  }

  return { 
    graphData: {
      nodes: cleanedNodes,
      edges: cleanedEdges
    }, 
    sources,
    searchQueries,
    summary,
    groundingSupports: cleanSupports
  };
};

export const fetchKnowledgeGraph = async (query: string): Promise<GeminiResponse> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const prompt = `Perform a comprehensive Google Search for "${query}". 
    First, provide a clear and concise summary of the key facts.
    Then, generate a detailed knowledge graph JSON structure based on these facts.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
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

    console.log("Gemini Grounding Metadata:", groundingMetadata);

    const chunks = groundingMetadata?.groundingChunks || [];
    const supports = groundingMetadata?.groundingSupports || [];
    const queries = groundingMetadata?.webSearchQueries || [];

    return processGeminiOutput(text, chunks, supports, queries);

  } catch (error) {
    console.error("Gemini Service Error:", error);
    throw error;
  }
};