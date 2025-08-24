"use client";

import { memo, useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Handle, Position, type NodeProps, useReactFlow } from "reactflow";
import type { AiNodeData } from "./node-types";
import { Bot, Database, Calculator, List, ChevronDown, Copy } from "lucide-react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { querySqliteDatabase } from "@/lib/ifc-utils";
import { z } from "zod";



interface Message {
  role: "user" | "assistant";
  content: string;
  toolResults?: ToolResult[];
}

interface ToolResult {
  type: 'count' | 'area' | 'volume' | 'list' | 'materials' | 'properties' | 'analysis' | 'quantityResults';
  elementType?: string;
  value?: number;
  unit?: string;
  count?: number;
  total?: number;
  items?: any[];
  materials?: string[];
  description?: string;
  method?: string;
  elementCount?: number;
  property?: string;
  data?: any;
}

interface ToolResultDisplayProps {
  result: ToolResult;
}

// Simple pluralization helper to avoid duplicates like "Wallss"
const formatElementType = (rawType?: string, count?: number): string => {
  if (!rawType) return "items";
  let name = rawType.replace(/^Ifc/i, "").trim();

  // Already plural? Keep as-is when count !== 1
  if (typeof count === 'number' && count > 1) {
    const lower = name.toLowerCase();
    if (lower.endsWith("s")) return name; // Walls, Slabs, Columns, Stairs, etc.
    if (/([sxz]|ch|sh)$/i.test(lower)) return `${name}es`;
    if (/[^aeiou]y$/i.test(lower)) return `${name.slice(0, -1)}ies`;
    return `${name}s`;
  }

  return name;
};

// Component to display tool results with expandable details
const ToolResultDisplay = ({ result }: ToolResultDisplayProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getIcon = () => {
    switch (result.type) {
      case 'count':
      case 'quantityResults': return <Database className="h-3 w-3" />;
      case 'area':
      case 'volume': return <Calculator className="h-3 w-3" />;
      case 'list':
      case 'materials':
      case 'properties': return <List className="h-3 w-3" />;
      default: return <Database className="h-3 w-3" />;
    }
  };

  const getTitle = () => {
    switch (result.type) {
      case 'count':
      case 'quantityResults': {
        const count = result.value || result.count || result.total || 0;
        const label = formatElementType(result.elementType, count);
        return `Count: ${count} ${label}`;
      }

      case 'area':
      case 'volume':
        return `${result.type === 'area' ? 'Area' : 'Volume'}: ${result.value?.toFixed(2)} ${result.unit || (result.type === 'area' ? 'm²' : 'm³')}`;

      case 'list':
        if (result.items && result.items.length > 0) {
          const label = result.property === 'Name' ? 'Names' : (result.property || 'Items');
          return `${label}: ${result.items.length} found`;
        }
        return 'No items found';

      case 'materials':
        if (result.materials && result.materials.length > 0) {
          return `Materials: ${result.materials.length} types`;
        }
        return 'No materials found';

      default:
        return result.description || 'Tool Result';
    }
  };

  const hasExpandableContent = () => {
    return (result.type === 'list' && result.items && result.items.length > 0) ||
      (result.type === 'materials' && result.materials && result.materials.length > 0) ||
      result.data ||
      (result.elementType || result.method || result.elementCount || result.property);
  };

  return (
    <div className="bg-gradient-to-r from-blue-50 to-sky-50 dark:from-blue-900/20 dark:to-sky-900/20 rounded-lg p-2 mb-2 text-xs border border-blue-200 dark:border-blue-700">
      <div
        className={`flex items-center gap-2 ${hasExpandableContent() ? 'cursor-pointer' : ''}`}
        onClick={() => hasExpandableContent() && setIsExpanded(!isExpanded)}
      >
        {getIcon()}
        <span className="font-medium text-gray-800 dark:text-gray-200 flex-1">
          {getTitle()}
        </span>
        {hasExpandableContent() && (
          <ChevronDown className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        )}
      </div>

      {isExpanded && (
        <div className="mt-2 pl-5 space-y-2">
          {/* Metadata */}
          {(result.elementType || result.method || result.elementCount || result.property) && (
            <div className="space-y-1 text-[10px] text-gray-600 dark:text-gray-400">
              {result.elementType && <div>Element Type: {formatElementType(result.elementType, 1)}</div>}
              {result.property && <div>Property: {result.property}</div>}
              {result.method && <div>Method: {result.method}</div>}
              {result.elementCount && <div>Total Elements: {result.elementCount}</div>}
            </div>
          )}

          {/* List items */}
          {result.type === 'list' && result.items && result.items.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                {result.property === 'Name' ? 'Names:' : 'Values:'}
              </div>
              {(() => {
                const MAX_ITEMS = 50;
                const items = Array.isArray(result.items) ? result.items.slice(0, MAX_ITEMS) : [];
                const hiddenCount = (Array.isArray(result.items) ? result.items.length : 0) - items.length;
                return (
                  <div className="max-h-32 overflow-y-auto bg-white dark:bg-gray-800 rounded p-2 space-y-1">
                    {items.map((item, index) => (
                      <div key={index} className="text-[10px] font-mono">
                        {typeof item === 'object' ? JSON.stringify(item, null, 2) : String(item)}
                      </div>
                    ))}
                    {hiddenCount > 0 && (
                      <div className="text-[10px] text-gray-500">... and {hiddenCount} more</div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Materials */}
          {result.type === 'materials' && result.materials && (
            <div>
              <div className="text-[10px] font-semibold text-gray-600 dark:text-gray-400 mb-1">Materials:</div>
              {(() => {
                const MAX_ITEMS = 100;
                const items = Array.isArray(result.materials) ? result.materials.slice(0, MAX_ITEMS) : [];
                const hiddenCount = (Array.isArray(result.materials) ? result.materials.length : 0) - items.length;
                return (
                  <div className="max-h-32 overflow-y-auto bg-white dark:bg-gray-800 rounded p-2 space-y-1">
                    {items.map((material, index) => (
                      <div key={index} className="text-[10px] font-mono">
                        {material}
                      </div>
                    ))}
                    {hiddenCount > 0 && (
                      <div className="text-[10px] text-gray-500">... and {hiddenCount} more</div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Generic data */}
          {result.data && (
            <div>
              <div className="text-[10px] font-semibold text-gray-600 dark:text-gray-400 mb-1">Data:</div>
              <div className="max-h-32 overflow-y-auto bg-white dark:bg-gray-800 rounded p-2">
                <pre className="text-[10px] font-mono whitespace-pre-wrap">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Available AI models via OpenRouter (loaded from env when provided)
type UiModelOption = {
  id: string;
  name: string;
  provider: string;
  slug?: string;
};

const loadModelListFromEnv = (): UiModelOption[] => {
  // NEXT_PUBLIC_ is required for client-side access; allow MODEL_LIST fallback if inlined at build time
  const raw = process.env.NEXT_PUBLIC_MODEL_LIST || process.env.MODEL_LIST;
  const defaultModels: UiModelOption[] = [
    { id: 'gpt-5-mini', name: 'gpt-5-mini', provider: 'openrouter', slug: 'openai/gpt-5-mini' },
    { id: 'gpt-4o-mini', name: 'gpt-4o-mini', provider: 'openrouter', slug: 'openai/gpt-4o-mini' },
    { id: 'gpt-4.1-mini', name: 'gpt-4.1-mini', provider: 'openrouter', slug: 'openai/gpt-4.1-mini' },
    { id: 'gpt-4.1-nano', name: 'gpt-4.1-nano', provider: 'openrouter', slug: 'openai/gpt-4.1-nano' }
  ];

  if (!raw || !raw.trim()) return defaultModels;

  try {
    // JSON array support: ["provider/model", ...] or [{ name, slug, id?, provider? }, ...]
    if (raw.trim().startsWith('[') || raw.trim().startsWith('{')) {
      const parsed = JSON.parse(raw);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      const models = arr
        .map((item: any): UiModelOption | null => {
          try {
            if (typeof item === 'string') {
              const slug: string = item;
              const id = slug.includes('/') ? slug.split('/').pop() || slug : slug;
              return { id, name: id, provider: 'openrouter', slug };
            }
            if (item && typeof item === 'object') {
              const slug: string | undefined = item.slug || item.model || item.slugOrModel;
              const id: string = item.id || (slug ? (slug.includes('/') ? slug.split('/').pop() || slug : slug) : (item.name || 'model'));
              const name: string = item.name || id;
              const provider: string = item.provider || 'openrouter';
              return { id, name, provider, slug };
            }
            return null;
          } catch {
            return null;
          }
        })
        .filter(Boolean) as UiModelOption[];
      return models.length > 0 ? models : defaultModels;
    }

    // CSV support: "name|provider/model, name|provider/model" OR "provider/model, provider/model"
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
    const models = parts.map((part): UiModelOption => {
      if (part.includes('|')) {
        const [name, slug] = part.split('|').map((s) => s.trim());
        const id = slug.includes('/') ? slug.split('/').pop() || slug : slug;
        return { id, name: name || id, provider: 'openrouter', slug };
      }
      const slug = part;
      const id = slug.includes('/') ? slug.split('/').pop() || slug : slug;
      return { id, name: id, provider: 'openrouter', slug };
    });
    return models.length > 0 ? models : defaultModels;
  } catch (e) {
    console.warn('Failed to parse MODEL_LIST env var. Using defaults.', e);
    return defaultModels;
  }
};

const AI_MODELS: UiModelOption[] = loadModelListFromEnv();

export const AiNode = memo(({ data, id, selected, isConnectable }: NodeProps<AiNodeData>) => {
  const [messages, setMessages] = useState<Message[]>((data.messages as Message[]) || []);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>(
    data.aiModelId || (AI_MODELS[0]?.slug || AI_MODELS[0]?.id || 'openai/gpt-5-mini')
  );

  // Use ref to ensure transport always has latest model
  const selectedModelRef = useRef(selectedModel);
  selectedModelRef.current = selectedModel;


  const [showModelPicker, setShowModelPicker] = useState(false);
  const [hoveredMessageIndex, setHoveredMessageIndex] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const modelPickerRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [containerScrollTop, setContainerScrollTop] = useState(0);

  // Function to copy message content to clipboard
  const copyMessageToClipboard = useCallback(async (message: Message) => {
    try {
      let textToCopy = message.content || '';

      // Add tool results if present
      if (message.toolResults && message.toolResults.length > 0) {
        const toolResultsText = message.toolResults.map(result => {
          switch (result.type) {
            case 'count':
              return `Count: ${result.value || result.count || 0} ${formatElementType(result.elementType, result.value || result.count || 0)}`;
            case 'area':
            case 'volume':
              return `${result.type === 'area' ? 'Area' : 'Volume'}: ${result.value?.toFixed(2)} ${result.unit || (result.type === 'area' ? 'm²' : 'm³')}`;
            case 'materials':
              return `Materials: ${result.materials?.join(', ') || 'None'}`;
            case 'list':
              return `${result.property || 'Items'}: ${Array.isArray(result.items) ? result.items.join(', ') : 'None'}`;
            default:
              return result.description || 'Analysis complete';
          }
        }).join('\n');

        textToCopy += '\n\nTool Results:\n' + toolResultsText;
      }

      await navigator.clipboard.writeText(textToCopy);
      console.log('Message copied to clipboard');
    } catch (error) {
      console.error('Failed to copy message:', error);
    }
  }, []);

  // Function to determine optimal copy button position based on message position in container
  const getCopyButtonPosition = useCallback((messageIndex: number, hasToolResults: boolean): 'top' | 'bottom' => {
    if (!chatContainerRef.current) return hasToolResults ? 'top' : 'bottom';

    const container = chatContainerRef.current;
    const containerRect = container.getBoundingClientRect();

    // Find the message element
    const messageElements = container.querySelectorAll('[data-message-index]');
    const messageElement = Array.from(messageElements).find(el =>
      parseInt(el.getAttribute('data-message-index') || '-1') === messageIndex
    );

    if (!messageElement) return hasToolResults ? 'top' : 'bottom';

    const messageRect = messageElement.getBoundingClientRect();

    // Calculate message position relative to container
    const messageTop = messageRect.top - containerRect.top;
    const messageBottom = messageRect.bottom - containerRect.top;
    const containerMidpoint = container.clientHeight / 2;

    // Simple logic: if message is in top half of container, put button at bottom
    // if message is in bottom half of container, put button at top
    const messageCenter = (messageTop + messageBottom) / 2;

    if (messageCenter < containerMidpoint) {
      // Message is in top half, put button at bottom for better visibility
      return 'bottom';
    } else {
      // Message is in bottom half, put button at top for better visibility
      return 'top';
    }
  }, []);

  // Handle scroll to update copy button positions
  const handleContainerScroll = useCallback(() => {
    if (chatContainerRef.current) {
      setContainerScrollTop(chatContainerRef.current.scrollTop);
    }
  }, []);

  const { setNodes, getNodes, getEdges } = useReactFlow();

  // Refs to avoid redundant updates that can cause re-render loops
  const prevMsgSigRef = useRef<string | null>(null);
  const prevTrsSigRef = useRef<string | null>(null);

  // Helper function to propagate ALL data to connected nodes
  const propagateAllData = useCallback((data: any) => {
    const edges = getEdges();
    const nodes = getNodes();

    // Find edges that connect from this AI node's output
    const outgoingEdges = edges.filter(edge => edge.source === id && edge.sourceHandle === 'output');

    for (const edge of outgoingEdges) {
      const targetNode = nodes.find(n => n.id === edge.target);

      if (targetNode) {
        console.log(`📤 Propagating data to ${targetNode.type} node ${targetNode.id}`, data);

        // Update the target node's inputData with raw data
        // Use immediate update to avoid race conditions
        setNodes((currentNodes) => {
          const newNodes = currentNodes.map((n) => {
            if (n.id === targetNode.id) {
              const updatedNode = {
                ...n,
                data: {
                  ...n.data,
                  inputData: data,
                  // Also store the model if propagating to another AI node
                  ...(targetNode.type === 'aiNode' && data.model ? { model: data.model } : {})
                }
              };
              console.log(`Updated ${n.type} node ${n.id} with full data`);
              return updatedNode;
            }
            return n;
          });
          return newNodes;
        });
      }
    }
  }, [id, getEdges, getNodes, setNodes]);

  // Helper function to propagate STRUCTURED tool results to ALL connected downstream nodes
  const propagateToWatchNodes = useCallback((toolResults: ToolResult[]) => {
    if (!toolResults || toolResults.length === 0) return;

    // Get fresh edges and nodes
    const edges = getEdges();
    const nodes = getNodes();

    // Find edges that connect from this AI node's output
    const outgoingEdges = edges.filter(edge => edge.source === id && edge.sourceHandle === 'output');

    for (const edge of outgoingEdges) {
      const targetNode = nodes.find(n => n.id === edge.target);

      if (targetNode) {
        console.log(`📤 Propagating structured tool results to ${targetNode.type} node ${targetNode.id}`, {
          targetId: targetNode.id,
          targetType: targetNode.type,
          toolResultsPreview: toolResults.slice(0, 2)
        });

        // Format the tool results based on target node type
        let formattedData: any;

        // Always send STRUCTURED data, not text blobs
        if (targetNode.type === 'watchNode') {
          // Watch nodes get specially formatted data for display
          formattedData = formatToolResultsForWatch(toolResults);
        } else {
          // Other nodes get raw structured data for processing
          // Ensure we're sending structured, usable data
          if (toolResults.length === 1) {
            const result = toolResults[0];
            // Send fully structured result with all fields accessible
            formattedData = {
              type: result.type,
              data: result,
              // Flatten important fields for easy access
              ...(result.type === 'list' && result.items ? {
                items: result.items,
                count: result.items.length,
                property: result.property,
                elementType: result.elementType
              } : {}),
              ...(result.type === 'count' ? {
                count: result.count || result.value,
                total: result.total,
                property: result.property,
                elementType: result.elementType
              } : {}),
              ...(result.type === 'quantityResults' || result.type === 'count' ? {
                count: result.count,
                total: result.total,
                description: result.description
              } : {}),
              ...(result.type === 'analysis' ? {
                description: result.description,
                elementType: result.elementType,
                property: result.property
              } : {})
            };
          } else {
            // Multiple results - send as structured array with metadata
            formattedData = {
              type: 'multipleResults',
              results: toolResults,
              count: toolResults.length,
              // Include summary info
              resultTypes: [...new Set(toolResults.map(r => r.type))],
              hasLists: toolResults.some(r => r.type === 'list'),
              hasCounts: toolResults.some(r => r.type === 'count' || r.type === 'quantityResults')
            };
          }
        }

        if (targetNode.type === 'watchNode') {
          console.log('📦 Formatted data for watch node:', {
            type: formattedData?.type,
            rows: Array.isArray(formattedData?.value) ? formattedData.value.length : (formattedData?.value?.rowCount || 0),
            sample: Array.isArray(formattedData?.value) ? formattedData.value.slice(0, 2) : formattedData?.value
          });
        } else {
          console.log(`📊 Sending structured data to ${targetNode.type}:`, {
            nodeId: targetNode.id,
            dataType: formattedData.type,
            hasItems: !!formattedData.items,
            itemCount: formattedData.items?.length || formattedData.count || 0
          });
        }

        // Update the target node's inputData with structured data
        setNodes((currentNodes) => {
          const newNodes = currentNodes.map((n) => {
            if (n.id === targetNode.id) {
              const updatedNode = {
                ...n,
                data: {
                  ...n.data,
                  inputData: formattedData
                }
              };
              console.log(`✅ Updated ${n.type} node ${n.id} with structured data`);
              return updatedNode;
            }
            return n;
          });
          return newNodes;
        });
      }
    }
  }, [id, getEdges, getNodes, setNodes]);

  // Format tool results for watch node display
  const formatToolResultsForWatch = (toolResults: ToolResult[]): any => {
    // If there's only one result, format it directly
    if (toolResults.length === 1) {
      const result = toolResults[0];

      // Format based on the result type
      switch (result.type) {
        case 'count':
          return {
            type: 'quantityResults',
            value: {
              groups: { [result.elementType || 'Items']: result.value || 0 },
              unit: 'count',
              total: result.value || 0,
              quantityType: 'count'
            }
          };

        case 'area':
        case 'volume':
          const elementTypeName = result.elementType ? formatElementType(result.elementType, 1) : 'All';
          return {
            type: 'quantityResults',
            value: {
              groups: { [elementTypeName]: result.value || 0 },
              unit: result.unit || (result.type === 'area' ? 'm²' : 'm³'),
              total: result.value || 0,
              quantityType: result.type
            }
          };

        case 'materials':
          return {
            type: 'aiToolResults',
            value: [{
              type: 'materials',
              materials: result.materials || [],
              count: result.materials?.length || 0,
              description: result.description
            }]
          };

        case 'list':
          // For lists, especially names/materials, send full data
          return {
            type: 'list',
            value: result.items || [],
            count: result.items?.length || result.count || 0,
            property: result.property,
            elementType: result.elementType
          };

        case 'analysis':
          // For analysis results, create a simple display format
          return {
            type: 'aiToolResults',
            value: [{
              type: 'analysis',
              elementType: result.elementType,
              description: result.description || `Analysis complete for ${result.elementType || 'elements'}.`,
              method: result.method
            }]
          };

        default:
          return {
            type: 'aiToolResults',
            value: [result]
          };
      }
    }

    // For multiple results, return them as an array
    return {
      type: 'aiToolResults',
      value: toolResults
    };
  };

  // Function to parse tool results from API response
  const parseToolResults = (apiResults: any[]): ToolResult[] => {
    const results: ToolResult[] = [];

    apiResults.forEach((apiResult) => {
      try {
        // Handle structured tool results (from embedded markers)
        if (typeof apiResult === 'object' && apiResult.type) {
          // This is already a structured tool result
          results.push(apiResult);
          return;
        }

        // Handle the formatted result string from the API
        if (typeof apiResult === 'string') {
          // Try to extract meaningful data from the string
          const stringResult = apiResult;

          // Check for count patterns
          const countMatch = stringResult.match(/There are (\d+) (\w+)/i);
          if (countMatch) {
            const count = parseInt(countMatch[1]);
            const elementType = countMatch[2];
            results.push({
              type: 'count',
              value: count,
              elementType: elementType,
              description: stringResult
            });
            return;
          }

          // Check for "Analysis complete for all X" patterns
          const analysisCompleteMatch = stringResult.match(/Analysis complete for (?:all )?(\w+)/i);
          if (analysisCompleteMatch) {
            const elementType = analysisCompleteMatch[1];
            results.push({
              type: 'analysis',
              elementType: elementType,
              description: stringResult
            });
            return;
          }

          // Check for "Found Name data" patterns - indicates we have names but they weren't sent
          const nameDataMatch = stringResult.match(/Found Name data for (\d+) (\w+)/i);
          if (nameDataMatch) {
            const count = parseInt(nameDataMatch[1]);
            const elementType = nameDataMatch[2];
            results.push({
              type: 'list',
              elementType: elementType,
              count: count,
              property: 'Name',
              description: stringResult,
              items: [] // Empty for now - we need the actual data from the API
            });
            return;
          }

          // Check for area patterns
          const areaMatch = stringResult.match(/(\d+\.?\d*) m²/i);
          if (areaMatch) {
            const area = parseFloat(areaMatch[1]);
            results.push({
              type: 'area',
              value: area,
              unit: 'm²',
              description: stringResult
            });
            return;
          }

          // Check for volume patterns
          const volumeMatch = stringResult.match(/(\d+\.?\d*) m³/i);
          if (volumeMatch) {
            const volume = parseFloat(volumeMatch[1]);
            results.push({
              type: 'volume',
              value: volume,
              unit: 'm³',
              description: stringResult
            });
            return;
          }

          // Generic analysis result
          results.push({
            type: 'analysis',
            description: stringResult
          });
          return;
        }

        // Handle structured object results
        if (typeof apiResult === 'object' && apiResult !== null) {
          const obj = apiResult;

          // Handle count results
          if (obj.type === 'count' || obj.value !== undefined) {
            results.push({
              type: 'count',
              value: obj.value,
              elementType: obj.elementType,
              description: obj.description,
              elementCount: obj.elementCount,
              method: obj.method
            });
            return;
          }

          // Handle area/volume results
          if (obj.unit === 'm²' || obj.unit === 'm³') {
            results.push({
              type: obj.unit === 'm²' ? 'area' : 'volume',
              value: obj.value,
              unit: obj.unit,
              elementType: obj.elementType,
              elementCount: obj.elementCount,
              method: obj.method,
              description: obj.description
            });
            return;
          }

          // Handle materials results
          if (obj.materials && Array.isArray(obj.materials)) {
            results.push({
              type: 'materials',
              materials: obj.materials,
              count: obj.materials.length,
              elementCount: obj.elementsWithMaterials,
              description: `Found ${obj.materials.length} material types`
            });
            return;
          }

          // Handle list results
          if (obj.type === 'list' || obj.items) {
            results.push({
              type: 'list',
              items: obj.items || obj.values,
              count: obj.items?.length || obj.values?.length || 0,
              elementType: obj.elementType,
              property: obj.property,
              description: obj.description
            });
            return;
          }

          // Handle elements results
          if (obj.type === 'elements' || obj.elements) {
            results.push({
              type: 'list',
              items: obj.elements,
              count: obj.count || obj.elements?.length || 0,
              elementType: obj.elementType,
              description: obj.description
            });
            return;
          }

          // Fallback for other object types
          results.push({
            type: 'analysis',
            description: obj.description || obj.message || JSON.stringify(obj).substring(0, 100)
          });
        }
      } catch (error) {
        console.error('Error parsing tool result:', error, apiResult);
        // Fallback to string representation
        results.push({
          type: 'analysis',
          description: typeof apiResult === 'string' ? apiResult : 'Analysis complete'
        });
      }
    });

    return results;
  };

  // Default sizes with fallback values
  const width = data.width || 320; // Default width widened for better layout
  const height = data.height || 280; // Default height increased to fit chat area

  useEffect(() => {
    setNodes((nodes) =>
      nodes.map((n) =>
        n.id === id
          ? {
            ...n,
            data: {
              ...n.data,
              messages,
              isLoading,
            },
          }
          : n
      )
    );
  }, [messages, isLoading, id, setNodes]);

  // Auto-scroll to latest message
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'end'
      });
    }
  }, [messages, isLoading]);

  // Add scroll listener to chat container
  useEffect(() => {
    const container = chatContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleContainerScroll);
      return () => container.removeEventListener('scroll', handleContainerScroll);
    }
  }, [handleContainerScroll]);

  // Update copy button positions when container scrolls
  useEffect(() => {
    // Force re-render to update copy button positions
    // This is triggered when containerScrollTop changes
  }, [containerScrollTop]);

  // Handle window mouse events for resizing
  const startResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);

      const startX = e.clientX;
      const startY = e.clientY;
      const startWidth = width;
      const startHeight = height;

      const onMouseMove = (e: MouseEvent) => {
        const newWidth = Math.max(200, startWidth + e.clientX - startX);
        const newHeight = Math.max(150, startHeight + e.clientY - startY);

        setNodes((nodes) =>
          nodes.map((node) => {
            if (node.id === id) {
              return {
                ...node,
                data: {
                  ...node.data,
                  width: newWidth,
                  height: newHeight,
                },
              };
            }
            return node;
          })
        );
      };

      const onMouseUp = () => {
        setIsResizing(false);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [id, width, height, setNodes]
  );

  // Helper function to get model data from connected IFC nodes
  const getConnectedModelData = () => {
    const nodes = getNodes();
    const edges = getEdges();

    // Find edges that connect to this AI node's input
    const incomingEdges = edges.filter(edge => edge.target === id && edge.targetHandle === 'input');

    for (const edge of incomingEdges) {
      const sourceNode = nodes.find(n => n.id === edge.source);
      if (sourceNode && sourceNode.type === 'ifcNode' && sourceNode.data.model) {
        return sourceNode.data.model;
      }
    }

    // Fallback to AI node's own model data (set by workflow executor)
    return data.model || null;
  };

  // Create a stable transport that uses dynamic model resolution
  const transport = useMemo(() => {
    return new DefaultChatTransport({
      api: "/api/chat",
      body: () => {
        const currentModel = getConnectedModelData();
        // Always get the current model from the ref at call time
        const currentSelectedModel = selectedModelRef.current;
        return {
          model: currentSelectedModel,
          modelData: currentModel ? {
            id: currentModel.id,
            name: currentModel.name,
            schema: currentModel.schema,
            totalElements: currentModel.totalElements,
            elementCounts: currentModel.elementCounts,
            hasSqlite: currentModel.sqliteSuccess && !!currentModel.sqliteDb
          } : null
        };
      }
    });
  }, []); // Create transport once, use ref for dynamic model

  // Chat hook using AI SDK UI with transport that forwards model + modelData per request
  // Tools are now handled completely server-side with execute functions
  const { messages: chatMessages, sendMessage, status: chatStatus } = useChat({
    transport,
    sendAutomaticallyWhen: ({ messages }) => {
      const last: any = messages[messages.length - 1];
      if (!last || last.role !== 'assistant') return false;
      const parts = Array.isArray(last.parts) ? last.parts : [];
      const hasToolResult = parts.some((p: any) => p.type === 'tool-result' && !p.preliminary);
      const hasText = parts.some((p: any) => p.type === 'text' && p.text && p.text.trim().length > 0);
      return hasToolResult && !hasText;
    },
    onError: (error) => {
      console.error('🔧 [AI-NODE] Chat error:', error);
    },
    onFinish: ({ message }) => {
      console.log('🔧 [AI-NODE] Chat finished:', {
        role: message.role,
        hasContent: !!(message as any).content,
        contentLength: ((message as any).content || '').length
      });
      // Safety: if assistant message has tool-results but no text, nudge continuation
      try {
        const parts = Array.isArray((message as any).parts) ? (message as any).parts : [];
        const hasToolResult = parts.some((p: any) => p.type === 'tool-result' && !p.preliminary);
        const hasText = parts.some((p: any) => p.type === 'text' && p.text && p.text.trim().length > 0);
        if (message.role === 'assistant' && hasToolResult && !hasText) {
          setTimeout(() => {
            if (!chatIsLoading) {
              console.log('🔧 [AI-NODE] Nudge continuation after tool-result without text');
              sendMessage({ text: '' });
            }
          }, 150);
        }
      } catch { }
    }
  });

  const chatIsLoading = chatStatus === 'submitted' || chatStatus === 'streaming';

  useEffect(() => {
    setIsLoading(chatIsLoading);
  }, [chatIsLoading]);

  // Keep a stable ref to the propagation function to avoid re-running effect on each render
  const propagateToWatchNodesRef = useRef(propagateToWatchNodes);
  useEffect(() => {
    propagateToWatchNodesRef.current = propagateToWatchNodes;
  }, [propagateToWatchNodes]);

  // Map AI SDK messages (with parts) to local message format and propagate tool results
  useEffect(() => {
    // Compute mapped messages and only update when content actually changes
    const mapped: Message[] = chatMessages.map((m: any) => {
      const textParts = Array.isArray(m.parts) ? m.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join("") : "";
      const originalContent = m.content || textParts || "";
      let content = originalContent;
      // Sanitize: remove only explicit technical/sql chatter; never remove all text
      const hasTech = (s: string) => /querySqlite:|\bselect\b|\bfrom\b|\bwhere\b/i.test(s);
      if (content && hasTech(content)) {
        const cleaned = content
          .split('\n')
          .filter((line: string) => !hasTech(line))
          .join('\n')
          .trim();
        if (cleaned.length > 0) content = cleaned; // fallback to original when cleaning removes everything
      }
      const toolResults: ToolResult[] = Array.isArray(m.parts)
        ? m.parts
          .filter((p: any) => p.type === 'tool-result')
          .map((p: any) => {
            const r = p.result;
            if (!r || typeof r !== 'object') return undefined;
            // Count shape
            if (r.type === 'count' && typeof r.value === 'number') {
              return { type: 'count', value: r.value, elementType: r.elementType, description: r.description } as ToolResult;
            }
            // Area / Volume
            if (typeof r.value === 'number' && (r.unit === 'm²' || r.unit === 'm³')) {
              return { type: r.unit === 'm²' ? 'area' : 'volume', value: r.value, unit: r.unit, elementType: r.elementType, description: r.description, method: r.method, elementCount: r.elementCount } as ToolResult;
            }
            // List
            if (r.type === 'list') {
              const items = r.items || r.values || r.uniqueValues || [];
              return { type: 'list', items, property: r.property, elementType: r.elementType, description: r.description, count: Array.isArray(items) ? items.length : undefined } as ToolResult;
            }
            // Generic SQL query result → normalize to list/count
            if (r.type === 'queryResult' && Array.isArray(r.result)) {
              const rows: any[] = r.result;
              // Detect COUNT
              if (rows.length === 1) {
                const row = rows[0] || {};
                const countVal = row.count ?? row.COUNT ?? row.total ?? undefined;
                if (typeof countVal === 'number') {
                  return { type: 'count', value: countVal, description: 'Query count result' } as ToolResult;
                }
              }
              // Prefer Name lists
              const nameItems = rows.map((row: any) => row?.Name ?? row?.name).filter((v: any) => v != null);
              if (nameItems.length > 0) {
                return { type: 'list', items: nameItems, property: 'Name', description: 'Query results' } as ToolResult;
              }
              // Fallback: return rows as list
              return { type: 'list', items: rows, description: 'Query results' } as ToolResult;
            }
            // Materials
            if (r.type === 'materials' && Array.isArray(r.materials)) {
              return { type: 'materials', materials: r.materials, description: r.description } as ToolResult;
            }
            // Elements -> treat as list of elements
            if (r.type === 'elements' && Array.isArray(r.elements)) {
              return { type: 'list', items: r.elements, elementType: r.elementType, description: r.description, count: r.count } as ToolResult;
            }
            // Quantity results pass-through
            if (r.type === 'quantityResults' && r.value) {
              return { type: 'quantityResults', data: r.value, description: r.description } as ToolResult;
            }
            // Fallback
            return { type: 'analysis', description: r.description || 'Analysis complete', data: r } as ToolResult;
          })
          .filter(Boolean) as ToolResult[]
        : [];
      // Fallback text if the model returned no text but produced tool results
      if ((!content || content.trim() === "") && toolResults.length > 0 && m.role === 'assistant') {
        const summaries = toolResults.map((tr) => {
          switch (tr.type) {
            case 'count':
              return `There are ${tr.value ?? tr.count ?? 0} ${formatElementType(tr.elementType, (tr.value ?? tr.count ?? 0) as number)}.`;
            case 'area':
            case 'volume':
              return `${tr.type === 'area' ? 'Total area' : 'Total volume'}: ${tr.value?.toFixed(2)} ${tr.unit || (tr.type === 'area' ? 'm²' : 'm³')}.`;
            case 'materials':
              return `Found ${tr.materials?.length || 0} material types.`;
            case 'list':
              return `Found ${tr.count ?? (Array.isArray(tr.items) ? tr.items.length : 0)} ${tr.property ? `${tr.property} ` : ''}values${tr.elementType ? ` for ${formatElementType(tr.elementType, 2)}` : ''}.`;
            case 'quantityResults':
              return `Calculated quantity results.`;
            default:
              return tr.description || 'Analysis complete.';
          }
        });
        content = summaries.join(' ');
      }
      return { role: m.role, content, toolResults: toolResults.length ? toolResults : undefined } as Message;
    });

    // Create a compact signature to detect real changes
    const newSig = JSON.stringify(
      mapped.map((msg) => ({
        r: msg.role,
        c: msg.content,
        t: msg.toolResults?.map((tr) => ({
          ty: tr.type,
          v: tr.value,
          u: tr.unit,
          ct: tr.count,
          tt: tr.total,
          et: tr.elementType,
          p: tr.property,
          d: tr.description,
        })),
      }))
    );

    // Only update messages state when something actually changed
    if (prevMsgSigRef.current !== newSig) {
      prevMsgSigRef.current = newSig;
      setMessages(mapped);
    }

    // Propagate latest tool results to Watch nodes
    const lastAssistant = [...chatMessages].reverse().find((m: any) => m.role === 'assistant' && Array.isArray(m.parts) && m.parts.some((p: any) => p.type === 'tool-result')) as any;
    if (lastAssistant) {
      const trs = lastAssistant.parts
        .filter((p: any) => p.type === 'tool-result')
        .map((p: any) => {
          const r = p.result;
          if (!r || typeof r !== 'object') return undefined;
          if (r.type === 'count' && typeof r.value === 'number') return { type: 'count', value: r.value, elementType: r.elementType } as ToolResult;
          if (typeof r.value === 'number' && (r.unit === 'm²' || r.unit === 'm³')) return { type: r.unit === 'm²' ? 'area' : 'volume', value: r.value, unit: r.unit, elementType: r.elementType } as ToolResult;
          if (r.type === 'list') return { type: 'list', items: r.items || r.values || r.uniqueValues || [], property: r.property, elementType: r.elementType } as ToolResult;
          if (r.type === 'materials') return { type: 'materials', materials: r.materials || [] } as ToolResult;
          if (r.type === 'elements') return { type: 'list', items: r.elements || [], elementType: r.elementType } as ToolResult;
          if (r.type === 'quantityResults' && r.value) return { type: 'quantityResults', data: r.value } as ToolResult;
          return { type: 'analysis', data: r } as ToolResult;
        })
        .filter(Boolean) as ToolResult[];
      if (trs.length > 0) {
        // Avoid re-propagating identical tool results
        const trsSig = JSON.stringify(trs.map((t) => ({ ty: t.type, v: t.value, u: t.unit, ct: t.count, tt: t.total, et: t.elementType })));
        if (prevTrsSigRef.current !== trsSig) {
          prevTrsSigRef.current = trsSig;
          // Use stable ref to avoid effect dependency on changing callback
          propagateToWatchNodesRef.current(trs);
        }
      }
    }

    // Auto-send SQL query results to downstream nodes
    const lastAssistantMessage = [...chatMessages].reverse().find((m: any) => m.role === 'assistant');
    if (lastAssistantMessage) {
      // Look for SQL results in the tool results
      const toolResults = lastAssistantMessage.parts?.filter((p: any) => p.type === 'tool-result') || [];

      for (const toolResult of toolResults) {
        const result = (toolResult as any).result;
        if (result && typeof result === 'object' && result.type === 'queryResult') {
          // Normalize rows to always include GUID as id when present
          const rows = Array.isArray(result.result) ? result.result : [];
          const normalizedRows = rows.map((r: any) => {
            if (r && typeof r === 'object') {
              const id = r.id ?? r.GlobalId ?? r.globalid ?? r.GLOBALID;
              return id ? { ...r, id } : r;
            }
            return r;
          });

          const structured = {
            type: 'aiSqlResults',
            value: {
              result: normalizedRows,
              rowCount: normalizedRows.length,
              timestamp: Date.now()
            }
          } as const;

          // Use stable ref to avoid effect dependency on changing callback
          propagateToWatchNodesRef.current([
            {
              type: 'analysis',
              data: structured
            } as ToolResult
          ]);

          // Follow-up: if user asked for slab count, also stream slab GUIDs
          try {
            const isCountOnly = normalizedRows.length > 0 && Object.keys(normalizedRows[0] || {}).length === 1 && (('count' in normalizedRows[0]) || ('COUNT(*)' in normalizedRows[0]));
            const lastUser = [...chatMessages].reverse().find((mm: any) => mm.role === 'user');
            const lastUserText = lastUser ? (Array.isArray(lastUser.parts) ? lastUser.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('') : '') : '';
            if (isCountOnly && /slab/i.test(lastUserText)) {
              querySqlite("SELECT GlobalId AS id FROM elements WHERE type='Slab'")
                .then((guidRows) => {
                  const guidNorm = Array.isArray(guidRows)
                    ? guidRows.map((r: any) => ({ id: r.id ?? r.GlobalId ?? r.globalid ?? r.GLOBALID })).filter((r: any) => !!r.id)
                    : [];
                  const guidStructured = {
                    type: 'aiSqlResults',
                    value: {
                      result: guidNorm,
                      rowCount: guidNorm.length,
                      timestamp: Date.now()
                    }
                  } as const;
                  propagateToWatchNodesRef.current([
                    {
                      type: 'analysis',
                      data: guidStructured
                    } as ToolResult
                  ]);
                })
                .catch((err) => console.warn('Follow-up GUID fetch failed:', err));
            }
          } catch (e) {
            console.warn('Post-process dispatch failed:', e);
          }
        }
      }
    }
  }, [chatMessages]);

  // Function to query SQLite database
  const querySqlite = useCallback(async (query: string): Promise<any[]> => {
    const currentModel = getConnectedModelData();
    if (!currentModel) {
      throw new Error("No IFC model connected");
    }

    if (!currentModel.sqliteSuccess || !currentModel.sqliteDb) {
      throw new Error("SQLite database not available for this model");
    }

    try {
      return await querySqliteDatabase(currentModel, query);
    } catch (error) {
      console.error("SQLite query failed:", error);
      throw error;
    }
  }, [getConnectedModelData]);

  // Deprecated: sending explicit query details downstream. We only forward structured results now.

  // Function to send full model data downstream
  const sendModelDataDownstream = useCallback(() => {
    const currentModel = getConnectedModelData();
    if (!currentModel) {
      console.log("No model data to send downstream");
      return;
    }

    console.log(`📊 Sending full model data downstream: ${currentModel.totalElements} elements`);

    // Create a comprehensive data package
    const dataPackage = {
      type: 'model',
      value: currentModel,
      count: currentModel.totalElements,
      model: currentModel
    };

    // Propagate to all connected nodes
    propagateAllData(dataPackage);

    // Also create a summary message
    const summaryMessage: Message = {
      role: "assistant",
      content: `📤 Sent ${currentModel.totalElements} elements to downstream nodes`,
      toolResults: [{
        type: 'analysis',
        description: `Model data propagated: ${currentModel.totalElements} elements`,
        elementCount: currentModel.totalElements
      }]
    };

    setMessages(prev => [...prev, summaryMessage]);
  }, [getConnectedModelData, propagateAllData]);

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-md shadow-md relative ${isResizing ? "nodrag" : ""}`}
      style={{
        width: `${width}px`,
        height: `${height}px`,
      }}
      data-nodrag={isResizing ? "true" : undefined}
    >
      <div className="px-3 py-2 bg-gradient-to-r from-sky-500 to-blue-500 text-white rounded-t-md flex items-center gap-2">
        <Bot className="h-4 w-4" />
        <span className="text-sm font-medium truncate">{data.label}</span>

        {/* Model Picker */}
        <div className="ml-auto flex items-center gap-2">
          <div className="relative" ref={modelPickerRef}>
            <button
              onClick={() => setShowModelPicker(!showModelPicker)}
              className="text-xs bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded transition-colors flex items-center gap-1"
            >
              {AI_MODELS.find(m => (m.slug || m.id) === selectedModel)?.name || selectedModel || 'Select Model'}
              <ChevronDown className="h-3 w-3" />
            </button>

            {showModelPicker && (
              <div className="absolute top-full mt-1 right-0 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-50 min-w-[150px]">
                {AI_MODELS.map(model => (
                  <button
                    key={model.id}
                    onClick={() => {
                      const newModel = model.slug || model.id;

                      // Clear messages when switching models to indicate fresh conversation
                      setMessages([]);

                      setSelectedModel(newModel);
                      setShowModelPicker(false);
                      // Update node data with selected AI model id
                      setNodes(nodes => nodes.map(n =>
                        n.id === id ? { ...n, data: { ...n.data, aiModelId: newModel } } : n
                      ));
                    }}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${(selectedModel === (model.slug || model.id)) ? 'bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400' : 'text-gray-700 dark:text-gray-300'
                      }`}
                  >
                    <div className="font-medium">{model.name}</div>
                    <div className="text-[10px] opacity-60">{model.provider}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Send Data button */}
          {getConnectedModelData() && (
            <button
              onClick={sendModelDataDownstream}
              className="text-xs bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded transition-colors"
              title="Send all model data to downstream nodes"
            >
              Send Data ↓
            </button>
          )}

          {/* Test SQLite Query button */}
          {getConnectedModelData()?.sqliteSuccess && (
            <button
              onClick={async () => {
                try {
                  const result = await querySqlite('SELECT COUNT(*) FROM ifcwall');
                  const count = result[0]?.['COUNT(*)'] || 0;

                  const testMessage: Message = {
                    role: "assistant",
                    content: `SQLite test successful! Found ${count} walls in the database.`,
                    toolResults: [{
                      type: 'count',
                      value: count,
                      elementType: 'IfcWall',
                      description: `SQLite query result: ${count} walls`
                    }]
                  };

                  setMessages(prev => [...prev, testMessage]);
                } catch (error) {
                  console.error('SQLite test failed:', error);
                  const errorMessage: Message = {
                    role: "assistant",
                    content: `SQLite test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    toolResults: [{
                      type: 'analysis',
                      description: `SQLite error: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }]
                  };
                  setMessages(prev => [...prev, errorMessage]);
                }
              }}
              className="text-xs bg-green-500/20 hover:bg-green-500/30 px-2 py-0.5 rounded transition-colors"
              title="Test SQLite database connection"
            >
              Test SQLite
            </button>
          )}


        </div>
      </div>
      <div key={selectedModel} className="p-3 text-xs flex flex-col h-[calc(100%-2.5rem)]">
        <div className="relative flex-1 overflow-hidden border rounded-md bg-gray-50 dark:bg-gray-900" style={{ minHeight: '96px' }}>
          <div
            ref={chatContainerRef}
            className="h-full overflow-y-auto p-2 pb-16"
            style={{ scrollPaddingBottom: '3.5rem' }}
          >
            {messages.map((m, i) => {
              // Skip completely empty messages
              if (!m.content && (!m.toolResults || m.toolResults.length === 0)) {
                return null;
              }

              // For assistant messages with tool results but no content, show just the tool results
              if (m.role === "assistant" && (!m.content || m.content.trim() === '') && m.toolResults && m.toolResults.length > 0) {
                return (
                  <div
                    key={i}
                    data-message-index={i}
                    className="mb-1 flex justify-start relative"
                    onMouseEnter={() => setHoveredMessageIndex(i)}
                    onMouseLeave={() => setHoveredMessageIndex(null)}
                  >
                    <div className="max-w-[85%] space-y-1">
                      {m.toolResults.map((result, resultIndex) => (
                        <ToolResultDisplay key={resultIndex} result={result} />
                      ))}
                    </div>
                    {/* Copy button for tool-only messages */}
                    {hoveredMessageIndex === i && (
                      <button
                        onClick={() => copyMessageToClipboard(m)}
                        className={`absolute p-1 bg-white/90 dark:bg-gray-700/90 hover:bg-white dark:hover:bg-gray-700 rounded-full shadow-sm border border-gray-200 dark:border-gray-600 transition-all duration-200 ${getCopyButtonPosition(i, true) === 'top' ? 'top-1 right-1' : 'bottom-1 right-1'}`}
                        title="Copy message"
                      >
                        <Copy className="h-3 w-3 text-gray-600 dark:text-gray-300" />
                      </button>
                    )}
                  </div>
                );
              }

              // Regular message display
              return (
                <div
                  key={i}
                  data-message-index={i}
                  className={`mb-1 flex ${m.role === "user" ? "justify-end" : "justify-start"} relative`}
                  onMouseEnter={() => setHoveredMessageIndex(i)}
                  onMouseLeave={() => setHoveredMessageIndex(null)}
                >
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap break-words px-2 py-1.5 rounded-2xl shadow-sm relative ${m.role === "user" ? "bg-sky-500 text-white dark:bg-sky-600" : "bg-white text-gray-800 dark:bg-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-700"}`}
                  >
                    {m.content}
                    {m.toolResults && m.toolResults.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {m.toolResults.map((result, resultIndex) => (
                          <ToolResultDisplay key={resultIndex} result={result} />
                        ))}
                      </div>
                    )}
                    {/* Copy button - only for assistant messages */}
                    {m.role === "assistant" && hoveredMessageIndex === i && (
                      <button
                        onClick={() => copyMessageToClipboard(m)}
                        className={`absolute p-1 bg-white/90 dark:bg-gray-700/90 hover:bg-white dark:hover:bg-gray-700 rounded-full shadow-sm border border-gray-200 dark:border-gray-600 transition-all duration-200 ${getCopyButtonPosition(i, !!m.toolResults) === 'top' ? 'top-1 right-1' : 'bottom-1 right-1'}`}
                        title="Copy message"
                      >
                        <Copy className="h-3 w-3 text-gray-600 dark:text-gray-300" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {isLoading && (
              <div className="mb-1 flex justify-start">
                <div className="max-w-[85%] px-2 py-1.5 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-300">
                  <span className="animate-pulse">Thinking...</span>
                </div>
              </div>
            )}
            {/* Invisible element to scroll to */}
            <div ref={messagesEndRef} />
          </div>
          {/* Bottom fade to prevent overlap between content and input */}
          <div className="pointer-events-none absolute bottom-11 left-0 right-0 h-12 bg-gradient-to-t from-gray-50 dark:from-gray-900 to-transparent" />
          <form onSubmit={(e) => {
            e.preventDefault();
            if (!chatIsLoading && input.trim()) {
              sendMessage({ text: input });
              setInput("");
            }
          }} className="absolute bottom-2 left-2 right-2 z-10 flex items-center gap-2 pointer-events-auto" style={{ maxWidth: 'calc(100% - 3rem)' }}>
            <input
              className="min-w-0 flex-1 h-8 rounded-full border border-gray-300 dark:border-gray-700 bg-white/95 dark:bg-gray-800/95 px-3 text-[0.8rem] sm:text-[0.75rem] shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 placeholder:text-gray-400 disabled:opacity-50"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question"
              disabled={chatIsLoading}
            />
            <button
              type="submit"
              disabled={chatIsLoading || !input.trim()}
              aria-label="Send message"
              className="h-8 w-8 rounded-full bg-sky-500 hover:bg-sky-600 text-white shadow-sm disabled:opacity-50 disabled:hover:bg-sky-500 flex items-center justify-center"
            >
              {chatIsLoading ? "..." : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M3.4 2.3l18 9a1 1 0 010 1.8l-18 9a1 1 0 01-1.4-1.2l2.7-7.1a1 1 0 01.7-.6l9.7-1.9-9.7-1.9a1 1 0 01-.7-.6L2 3.5A1 1 0 013.4 2.3z" /></svg>
                  <span className="sr-only">Send</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      <div
        className={`absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize nodrag z-20 ${selected ? "text-sky-600" : "text-gray-400"
          } hover:text-sky-500 transition-colors duration-200`}
        onMouseDown={startResize}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M22 2L2 22"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M22 10L10 22"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M22 18L18 22"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <Handle type="target" position={Position.Left} id="input" isConnectable={isConnectable} />
      <Handle type="source" position={Position.Right} id="output" isConnectable={isConnectable} />
    </div>
  );
});

AiNode.displayName = "AiNode";
