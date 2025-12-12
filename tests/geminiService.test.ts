import { describe, it, expect, vi, afterEach } from 'vitest';
import { processGeminiOutput } from '../services/geminiService';

// Mock data helpers
const mockChunks = [
  { web: { title: "Test Source", uri: "http://example.com" } }
];

describe('geminiService - processGeminiOutput', () => {

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should successfully parse valid JSON and extract sources', () => {
    const validJson = JSON.stringify({
      nodes: [{ id: "1", label: "A", type: "concept", description: "Desc", val: 5 }],
      edges: [{ source: "1", target: "1", relation: "self" }]
    });

    const result = processGeminiOutput(validJson, mockChunks);

    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].title).toBe("Test Source");
    expect(result.graphData.nodes).toHaveLength(1);
    expect(result.graphData.edges).toHaveLength(1);
  });

  it('should strip Markdown code blocks (json language) from JSON', () => {
    const markdownJson = `\`\`\`json
    {
      "nodes": [{ "id": "1", "label": "A", "type": "concept", "description": "D", "val": 1 }],
      "edges": []
    }
    \`\`\``;

    const result = processGeminiOutput(markdownJson, []);
    expect(result.graphData.nodes).toHaveLength(1);
  });

  it('should strip Markdown code blocks (generic) from JSON', () => {
    const markdownJson = `\`\`\`
    {
      "nodes": [{ "id": "1", "label": "A", "type": "concept", "description": "D", "val": 1 }],
      "edges": []
    }
    \`\`\``;

    const result = processGeminiOutput(markdownJson, []);
    expect(result.graphData.nodes).toHaveLength(1);
  });

  it('should handle JSON embedded in text preamble/postamble', () => {
    const text = `Here is the graph data you requested:
    \`\`\`json
    {
      "nodes": [{ "id": "1", "label": "A", "type": "concept", "description": "D", "val": 1 }],
      "edges": []
    }
    \`\`\`
    Hope this helps!`;

    const result = processGeminiOutput(text, []);
    expect(result.graphData.nodes).toHaveLength(1);
  });

  it('should deduplicate nodes with the same ID', () => {
    const duplicateNodesJson = JSON.stringify({
      nodes: [
        { id: "1", label: "A", type: "concept", description: "D", val: 1 },
        { id: "1", label: "A - Duplicate", type: "concept", description: "D", val: 1 }
      ],
      edges: []
    });

    const result = processGeminiOutput(duplicateNodesJson, []);
    expect(result.graphData.nodes).toHaveLength(1);
  });

  it('should remove edges that point to non-existent nodes and warn', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    const brokenEdgeJson = JSON.stringify({
      nodes: [
        { id: "1", label: "A", type: "concept", description: "D", val: 1 },
        { id: "2", label: "B", type: "concept", description: "D", val: 1 }
      ],
      edges: [
        { source: "1", target: "2", relation: "connected" },
        { source: "1", target: "999", relation: "broken" } // Node 999 does not exist
      ]
    });

    const result = processGeminiOutput(brokenEdgeJson, []);
    
    // Should keep the valid edge
    const validEdge = result.graphData.edges.find(e => e.relation === "connected");
    expect(validEdge).toBeDefined();

    // Should remove the broken edge
    const brokenEdge = result.graphData.edges.find(e => e.relation === "broken");
    expect(brokenEdge).toBeUndefined();
    
    expect(result.graphData.edges).toHaveLength(1);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Filtering broken edge'));
  });

  it('should throw an error for malformed JSON', () => {
    const invalidJson = "{ nodes: [ ... incomplete ";
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      processGeminiOutput(invalidJson, []);
    }).toThrow("Failed to parse knowledge graph data");
    
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('should throw an error for invalid structure (missing nodes/edges arrays)', () => {
    const badStructureJson = JSON.stringify({ foo: "bar" });
    
    expect(() => {
      processGeminiOutput(badStructureJson, []);
    }).toThrow("Invalid graph data structure");
  });

  describe('Source Extraction Logic', () => {
    const validJson = JSON.stringify({ nodes: [], edges: [] });

    it('should handle malformed chunks gracefully', () => {
      const badChunks = [
        null,
        undefined,
        {},
        { web: null },
        { web: {} }, // missing uri
        { web: { title: "No URI" } } // missing uri
      ];

      const result = processGeminiOutput(validJson, badChunks);
      expect(result.sources).toHaveLength(0);
    });

    it('should use "Unknown Source" if title is missing', () => {
      const chunks = [
        { web: { uri: "http://example.com" } }
      ];

      const result = processGeminiOutput(validJson, chunks);
      expect(result.sources).toHaveLength(1);
      expect(result.sources[0].title).toBe("Unknown Source");
      expect(result.sources[0].uri).toBe("http://example.com");
    });

    it('should deduplicate sources by URI', () => {
      const chunks = [
        { web: { uri: "http://example.com", title: "Title 1" } },
        { web: { uri: "http://example.com", title: "Title 1 Duplicate" } }
      ];

      const result = processGeminiOutput(validJson, chunks);
      expect(result.sources).toHaveLength(1);
      // It keeps the first one unless the first one is "Unknown Source"
      expect(result.sources[0].uri).toBe("http://example.com");
    });

    it('should update source title if improved from "Unknown Source"', () => {
      const chunks = [
        { web: { uri: "http://example.com" } }, // Defaults to "Unknown Source"
        { web: { uri: "http://example.com", title: "Better Title" } }
      ];

      const result = processGeminiOutput(validJson, chunks);
      expect(result.sources).toHaveLength(1);
      expect(result.sources[0].title).toBe("Better Title");
    });
    
    it('should not update source title if existing title is valid', () => {
      const chunks = [
        { web: { uri: "http://example.com", title: "Original Title" } },
        { web: { uri: "http://example.com", title: "New Title" } }
      ];

      const result = processGeminiOutput(validJson, chunks);
      expect(result.sources).toHaveLength(1);
      expect(result.sources[0].title).toBe("Original Title");
    });
  });
});
