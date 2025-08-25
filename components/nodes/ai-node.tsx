"use client";

import { memo, useEffect, useRef, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { Handle, Position, type NodeProps, useReactFlow } from "reactflow";
import type { AiNodeData } from "./node-types";
import { Bot, Database, Calculator, List, ChevronDown, Copy, Shield } from "lucide-react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { querySqliteDatabase } from "@/lib/ifc-utils";
import { z } from "zod";
import { Turnstile, useTurnstile } from "@/components/ui/turnstile";
import { getTurnstileSitekey } from "@/lib/turnstile";



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
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI', slug: 'openai/gpt-4o-mini' },
    { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', provider: 'OpenAI', slug: 'openai/gpt-4.1-mini' },
    { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', provider: 'OpenAI', slug: 'openai/gpt-4.1-nano' },
    { id: 'gpt-5-mini', name: 'GPT-5 Mini', provider: 'OpenAI', slug: 'openai/gpt-5-mini' },
    { id: 'deepseek-v2-chat', name: 'DeepSeek V2 Chat', provider: 'DeepSeek', slug: 'deepseek/deepseek-v2-chat' },
    { id: 'gemini-flash-1.5', name: 'Gemini Flash 1.5', provider: 'Google', slug: 'google/gemini-flash-1.5' },
    { id: 'gemini-pro-1.5', name: 'Gemini Pro 1.5', provider: 'Google', slug: 'google/gemini-pro-1.5' }
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
        const provider = slug.includes('/') ? slug.split('/')[0] : 'openrouter';
        return { id, name: name || id, provider, slug };
      }
      const slug = part;
      const id = slug.includes('/') ? slug.split('/').pop() || slug : slug;
      const provider = slug.includes('/') ? slug.split('/')[0] : 'openrouter';
      return { id, name: id, provider, slug };
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
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [modelSearchQuery, setModelSearchQuery] = useState("");
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
          // Enhanced handling for the new structured results
          switch (apiResult.type) {
            case 'count':
              results.push({
                type: 'count',
                value: apiResult.value,
                description: apiResult.description,
                elementType: apiResult.elementType
              });
              return;

            case 'list':
              results.push({
                type: 'list',
                items: apiResult.items || apiResult.rawData || [],
                count: apiResult.count,
                property: apiResult.property || 'Name',
                description: apiResult.description,
                elementType: apiResult.elementType
              });
              return;

            case 'properties':
              results.push({
                type: 'properties',
                data: apiResult.properties || apiResult.rawData,
                count: apiResult.count,
                description: apiResult.description
              });
              return;

            case 'quantities':
              results.push({
                type: 'quantityResults',
                data: apiResult.quantities || apiResult.rawData,
                count: apiResult.count,
                description: apiResult.description
              });
              return;

            case 'queryResult':
              // Handle generic query results - try to infer the type
              if (apiResult.result && Array.isArray(apiResult.result)) {
                const firstRow = apiResult.result[0];
                if (firstRow && 'count' in firstRow) {
                  results.push({
                    type: 'count',
                    value: firstRow.count,
                    description: apiResult.description
                  });
                } else if (firstRow && ('Name' in firstRow || 'GlobalId' in firstRow)) {
                  results.push({
                    type: 'list',
                    items: apiResult.result.map((row: any) => row.Name || row.GlobalId || JSON.stringify(row)),
                    count: apiResult.count,
                    description: apiResult.description
                  });
                } else {
                  results.push({
                    type: 'analysis',
                    data: apiResult.result,
                    description: apiResult.description || `Found ${apiResult.count || 0} results`
                  });
                }
              } else {
                results.push({
                  type: 'analysis',
                  description: apiResult.description || 'Query completed',
                  data: apiResult.result
                });
              }
              return;

            default:
              // Pass through other structured results
              results.push(apiResult);
              return;
          }
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
  const width = data.width || 360; // Slightly reduced for tighter default footprint
  const height = data.height || 320; // Reduced to remove excess whitespace

  // Memoize the node update to prevent infinite re-renders
  const updateNodeData = useCallback(() => {
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

  // Use a ref to track if we need to update
  const prevDataRef = useRef<{ messages: Message[]; isLoading: boolean }>({ messages: [], isLoading: false });

  useEffect(() => {
    const prevData = prevDataRef.current;
    const messagesChanged = JSON.stringify(messages) !== JSON.stringify(prevData.messages);
    const loadingChanged = isLoading !== prevData.isLoading;

    if (messagesChanged || loadingChanged) {
      prevDataRef.current = { messages, isLoading };
      updateNodeData();
    }
  }, [messages, isLoading, updateNodeData]);

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

  // Calculate dropdown position
  const calculateDropdownPosition = useCallback(() => {
    if (modelPickerRef.current) {
      const rect = modelPickerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const dropdownHeight = 200; // Estimated dropdown height
      const dropdownWidth = 280; // Max dropdown width

      let top = rect.top - 12; // 12px gap above the button
      let left = rect.left - 4; // Slight left offset

      // Adjust if dropdown would go off-screen vertically
      if (top - dropdownHeight < 10) {
        top = rect.bottom + 8; // Position below the button instead
      }

      // Adjust if dropdown would go off-screen horizontally
      if (left + dropdownWidth > viewportWidth - 10) {
        left = viewportWidth - dropdownWidth - 10;
      }
      if (left < 10) {
        left = 10;
      }

      setDropdownPosition({ top, left });
    }
  }, []);

  // Filter models based on search query
  const filteredModels = useMemo(() => {
    if (!modelSearchQuery.trim()) return AI_MODELS;
    const query = modelSearchQuery.toLowerCase();
    return AI_MODELS.filter(model =>
      model.name.toLowerCase().includes(query) ||
      model.provider.toLowerCase().includes(query) ||
      (model.slug && model.slug.toLowerCase().includes(query))
    );
  }, [modelSearchQuery]);

  // Handle model picker toggle with position calculation
  const handleModelPickerToggle = useCallback(() => {
    if (!showModelPicker) {
      calculateDropdownPosition();
      setShowModelPicker(true);
      setModelSearchQuery(""); // Reset search when opening
    } else {
      setShowModelPicker(false);
      setModelSearchQuery(""); // Reset search when closing
    }
  }, [showModelPicker, calculateDropdownPosition]);

  // Handle click outside and keyboard events to close model picker
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Don't close if clicking on the dropdown itself or the model picker button
      const target = event.target as Node;
      const isClickInsideDropdown = (event.target as Element)?.closest('[data-dropdown]');
      const isClickOnButton = modelPickerRef.current?.contains(target);

      if (modelPickerRef.current && !modelPickerRef.current.contains(target) && !isClickInsideDropdown && !isClickOnButton) {
        setShowModelPicker(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowModelPicker(false);
      }
    };

    if (showModelPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showModelPicker]);

  // Rate limiting state
  const [rateLimitInfo, setRateLimitInfo] = useState<{
    remaining: number;
    resetTime: number;
    blocked: boolean;
    requiresTurnstile?: boolean;
  } | null>(null);

  // Turnstile integration - use environment-based sitekey
  const sitekey = getTurnstileSitekey();
  const {
    token: turnstileToken,
    isVerified: isTurnstileVerified,
    error: turnstileError,
    handleSuccess: handleTurnstileSuccess,
    handleError: handleTurnstileError,
    reset: resetTurnstile,
    TurnstileComponent
  } = useTurnstile(sitekey);

  const [showTurnstile, setShowTurnstile] = useState(false);

  // Store verification state persistently for this node instance
  const [isNodeVerified, setIsNodeVerified] = useState(false);

  // Use ref to ensure transport always has latest verification state
  const isNodeVerifiedRef = useRef(false);
  isNodeVerifiedRef.current = isNodeVerified;

  // Chat is blocked until initial one-time Turnstile verification completes
  const isChatBlocked = !!(sitekey && !isNodeVerified);

  // Ref to track current turnstile token for transport
  const turnstileTokenRef = useRef<string | null>(null);
  turnstileTokenRef.current = turnstileToken;

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
        const currentTurnstileToken = turnstileTokenRef.current;
        const currentIsNodeVerified = isNodeVerifiedRef.current; // Use ref value

        // Only send token for the first verification, then rely on session
        const shouldSendToken = currentTurnstileToken && !currentIsNodeVerified;

        console.log('🚀 Transport sending request with:', {
          hasTurnstileToken: !!shouldSendToken,
          tokenPreview: shouldSendToken ? currentTurnstileToken.substring(0, 20) + '...' : 'verified-session',
          isNodeVerified: currentIsNodeVerified
        });

        return {
          model: currentSelectedModel,
          modelData: currentModel ? {
            id: currentModel.id,
            name: currentModel.name,
            schema: currentModel.schema,
            totalElements: currentModel.totalElements,
            elementCounts: currentModel.elementCounts,
            hasSqlite: currentModel.sqliteSuccess && !!currentModel.sqliteDb
          } : null,
          turnstileToken: shouldSendToken ? currentTurnstileToken : undefined, // Only send token once
          sessionVerified: currentIsNodeVerified // Indicate this is a verified session
        };
      }
    });
  }, []); // No dependencies - transport will always use current ref values

  // Auto-render invisible Turnstile on component mount (one-time only)
  useEffect(() => {
    if (sitekey && !isNodeVerified && !showTurnstile) {
      console.log('🔒 Auto-rendering invisible Turnstile for one-time verification');
      setShowTurnstile(true);
    }
  }, []); // Empty deps - only run once on mount

  // Handle Turnstile verification success (one-time verification)
  useEffect(() => {
    if (isTurnstileVerified && turnstileToken && !isNodeVerified) {
      console.log('✅ Turnstile verification successful - node permanently unlocked', {
        tokenPreview: turnstileToken.substring(0, 20) + '...',
        nodeId: id
      });
      setIsNodeVerified(true); // Mark this node as permanently verified
      setShowTurnstile(false);
      setRateLimitInfo(null);

      // Clear the token after successful verification to prevent reuse
      setTimeout(() => {
        resetTurnstile(); // This will clear the token
        turnstileTokenRef.current = null;
        console.log('🧹 Cleared Turnstile token after successful verification');
      }, 1000); // Small delay to ensure first request completes

      // Store verification in node data or session
      console.log('🔓 AI Node verified - chat permanently enabled for this session');
    }
  }, [isTurnstileVerified, turnstileToken, isNodeVerified, id, resetTurnstile]);

  // Chat hook using AI SDK UI with transport that forwards model + modelData per request
  // Tools are now handled completely server-side with execute functions
  const { messages: chatMessages, sendMessage, status: chatStatus, error: chatError } = useChat({
    transport,
    sendAutomaticallyWhen: ({ messages }) => {
      const last: any = messages[messages.length - 1];
      if (!last || last.role !== 'assistant') return false;
      const parts = Array.isArray(last.parts) ? last.parts : [];

      // AI SDK v5 uses different tool result types - check for both old and new formats
      const hasToolResult = parts.some((p: any) =>
        (p.type === 'tool-result' && !p.preliminary && p.state === 'output-available') ||
        (p.type && p.type.startsWith('tool-') && p.type !== 'tool-call' && !p.preliminary && p.state === 'output-available')
      );

      // Only consider complete, non-streaming text
      const hasCompleteText = parts.some((p: any) =>
        p.type === 'text' &&
        p.text &&
        p.text.trim().length > 0 &&
        (p.state === 'done' || !p.state) // Only complete text, not streaming
      );

      const shouldSendAuto = hasToolResult && !hasCompleteText;

      // Disable automatic sending to reduce stuttering - rely on onFinish instead
      return false;
    },
    onError: (error) => {
      console.error('🔧 [AI-NODE] Chat error:', error);

      // Handle rate limiting errors
      if (error.message?.includes('Rate limit exceeded') || error.message?.includes('429')) {
        // Try to parse the error response for more details
        try {
          const errorData = JSON.parse(error.message);
          setRateLimitInfo({
            remaining: 0,
            resetTime: Date.now() + ((errorData.retryAfter || 15 * 60) * 1000),
            blocked: true,
            requiresTurnstile: errorData.requiresTurnstile
          });

          // Show Turnstile if required
          if (errorData.requiresTurnstile && sitekey) {
            setShowTurnstile(true);
          }
        } catch {
          setRateLimitInfo({
            remaining: 0,
            resetTime: Date.now() + (15 * 60 * 1000), // 15 minutes
            blocked: true
          });
        }
      }

      // Handle security blocks
      if (error.message?.includes('security') || error.message?.includes('403')) {
        const errorMessage: Message = {
          role: "assistant",
          content: "⚠️ Your request was blocked for security reasons. Please ensure your input follows our usage guidelines.",
          toolResults: [{
            type: 'analysis',
            description: 'Security block - request rejected'
          }]
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    },
    onFinish: ({ message }) => {
      const parts = Array.isArray((message as any).parts) ? (message as any).parts : [];
      // AI SDK v5 uses different tool result types - check for both old and new formats
      const hasToolResult = parts.some((p: any) =>
        (p.type === 'tool-result' && !p.preliminary && p.state === 'output-available') ||
        (p.type && p.type.startsWith('tool-') && p.type !== 'tool-call' && !p.preliminary && p.state === 'output-available')
      );

      // Only consider complete, non-streaming text
      const hasCompleteText = parts.some((p: any) =>
        p.type === 'text' &&
        p.text &&
        p.text.trim().length > 0 &&
        (p.state === 'done' || !p.state) // Only complete text, not streaming
      );

      // Track conversation completion for potential continuation

      // Safety: if assistant message has tool-results but no complete text, nudge continuation
      // BUT avoid infinite loops - only trigger once per unique tool call
      try {
        if (message.role === 'assistant' && hasToolResult && !hasCompleteText) {
          // Check if we've already triggered continuation for these tool calls
          const toolCallIds = parts
            .filter((p: any) => p.type && p.type.startsWith('tool-') && p.toolCallId)
            .map((p: any) => p.toolCallId);

          const continuationKey = `continuation-${toolCallIds.join('-')}`;

          if (!sessionStorage.getItem(continuationKey)) {
            sessionStorage.setItem(continuationKey, 'triggered');

            setTimeout(() => {
              if (!chatIsLoading) {
                sendMessage({ text: '' });
              }
            }, 500); // Increased delay to reduce stuttering
          }
        }
      } catch (e) {
        console.error('🔧 [AI-NODE] Error in continuation logic:', e);
      }
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
    // Worker now builds a sql.js DB after extraction; attempt query regardless of sqliteSuccess flag
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
      className={`bg-white dark:bg-gray-800 border-2 border-emerald-500 dark:border-emerald-400 rounded-md shadow-md relative overflow-visible ${isResizing ? "nodrag" : ""}`}
      style={{
        width: `${width}px`,
        height: `${height}px`,
      }}
      data-nodrag={isResizing ? "true" : undefined}
    >
      {/* Header matching other nodes design system */}
      <div className="bg-emerald-500 text-white px-3 py-2 flex items-center gap-2">
        <Bot className="h-4 w-4 flex-shrink-0" />
        <span className="text-sm font-medium truncate">{data.label}</span>

        {/* Action buttons in header */}
        <div className="ml-auto flex items-center gap-1">
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

          {/* Turnstile verification status */}
          {sitekey && isNodeVerified && (
            <div className="flex items-center gap-1 text-xs bg-green-500/20 hover:bg-green-500/30 px-2 py-0.5 rounded transition-colors">
              <Shield className="h-3 w-3 text-green-600 dark:text-green-400" />
              <span className="text-green-700 dark:text-green-300">Verified</span>
            </div>
          )}

          {/* Save SQLite button */}
          {getConnectedModelData() && (
            <button
              onClick={async () => {
                const currentModel = getConnectedModelData();
                if (!currentModel) return;
                try {
                  const { exportSqliteDatabase } = await import('@/lib/ifc-utils');
                  const bytes = await exportSqliteDatabase(currentModel);
                  const blob = new Blob([bytes], { type: 'application/x-sqlite3' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  const base = (currentModel.name || 'model').replace(/\.[^.]+$/, '');
                  a.href = url;
                  a.download = `${base}.sqlite`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);

                  const msg: Message = {
                    role: 'assistant',
                    content: `SQLite database exported as ${base}.sqlite`,
                    toolResults: [{ type: 'analysis', description: 'SQLite DB saved to disk' }]
                  };
                  setMessages(prev => [...prev, msg]);
                } catch (error) {
                  console.error('SQLite export failed:', error);
                  const errorMessage: Message = {
                    role: 'assistant',
                    content: `SQLite export failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    toolResults: [{ type: 'analysis', description: `SQLite export error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
                  };
                  setMessages(prev => [...prev, errorMessage]);
                }
              }}
              className="text-xs bg-green-500/20 hover:bg-green-500/30 px-2 py-0.5 rounded transition-colors"
              title="Save SQLite database to file"
            >
              Save SQLite
            </button>
          )}
        </div>
      </div>
      <div key={selectedModel} className="p-3 text-xs flex flex-col h-[calc(100%-3rem)]">
        <div className="relative flex-1 overflow-visible border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-900" style={{ minHeight: '96px' }}>
          <div
            ref={chatContainerRef}
            className="h-full overflow-y-auto p-2 pb-10 custom-scrollbar"
            style={{ scrollPaddingBottom: '3rem' }}
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
          <div className="pointer-events-none absolute bottom-8 left-0 right-0 h-8 bg-gradient-to-t from-gray-50 dark:from-gray-900 to-transparent" />
          {/* Invisible Turnstile verification */}
          {showTurnstile && sitekey && (
            <div className="absolute bottom-12 left-2 right-2 z-20">
              <TurnstileComponent
                theme={document.documentElement.classList.contains('dark') ? 'dark' : 'light'}
                size="normal"
              />
            </div>
          )}

          <form onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();

            // Block submission if Turnstile is required but not verified
            if (isChatBlocked) {
              let errorContent = "🔒 Please wait for security verification to complete before chatting. This usually takes a few seconds.";
              let errorDescription = 'Verification in progress';

              if (turnstileError) {
                if (turnstileError === '110200') {
                  errorContent = "🔒 Security verification failed due to domain configuration. The site administrator needs to add this domain to the security settings. Please contact support if this persists.";
                  errorDescription = 'Domain configuration error';
                } else {
                  errorContent = "🔒 Security verification failed. Please check the verification widget below and try again. If issues persist, try disabling browser extensions or using incognito mode.";
                  errorDescription = 'Verification failed';
                }
              }

              const errorMessage: Message = {
                role: "assistant",
                content: errorContent,
                toolResults: [{
                  type: 'analysis',
                  description: errorDescription
                }]
              };
              setMessages(prev => [...prev, errorMessage]);
              return;
            }

            if (!chatIsLoading && input.trim()) {
              // Double-check Turnstile verification before sending
              if (isChatBlocked) {
                console.log('🚫 Blocking message - Turnstile not verified');
                return;
              }
              // Close model picker if it's open
              if (showModelPicker) {
                setShowModelPicker(false);
              }
              sendMessage({ text: input });
              setInput("");
            }
          }} className="absolute bottom-4 left-3 right-3 z-[999] pointer-events-auto">
            {/* OpenAI-style input with model picker */}
            <div className="flex items-center gap-1 bg-white dark:bg-gray-800 rounded-full border border-gray-300 dark:border-gray-600 shadow-sm overflow-hidden">
              {/* Model Picker - positioned on the left like OpenAI */}
              <div className="relative pl-1" ref={modelPickerRef}>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!chatIsLoading) {
                      handleModelPickerToggle();
                    }
                  }}
                  className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 min-w-[90px] justify-between"
                  disabled={chatIsLoading}
                  type="button"
                  title={`Current model: ${AI_MODELS.find(m => (m.slug || m.id) === selectedModel)?.name || selectedModel}`}
                >
                  <span className="truncate max-w-[70px] text-left">
                    {AI_MODELS.find(m => (m.slug || m.id) === selectedModel)?.name || selectedModel.split('/').pop() || 'Model'}
                  </span>
                  <ChevronDown className={`h-3 w-3 flex-shrink-0 transition-transform duration-200 ${showModelPicker ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {/* Separator */}
              <div className="w-px h-5 bg-gray-300 dark:bg-gray-600" />

              {/* Text Input */}
              <input
                className={`min-w-0 flex-1 h-8 bg-transparent px-2 text-[0.8rem] sm:text-[0.75rem] focus:outline-none focus:ring-1 focus:ring-emerald-500/50 rounded-sm placeholder:text-gray-400 transition-all duration-200 ${isChatBlocked ? 'opacity-50 cursor-not-allowed' : 'disabled:opacity-50'}`}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isChatBlocked ? (turnstileError ? "Verification error - check console" : "Verifying security... please wait") : "Ask a question"}
                disabled={chatIsLoading || isChatBlocked}
              />

              {/* Send Button */}
              <button
                type="submit"
                disabled={chatIsLoading || !input.trim() || isChatBlocked}
                aria-label="Send message"
                className={`h-8 w-9 rounded-l-none rounded-r-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm disabled:opacity-50 disabled:hover:bg-emerald-500 flex items-center justify-center transition-colors border-l border-gray-200 dark:border-gray-700 ${isChatBlocked ? 'cursor-not-allowed' : ''}`}
              >
                {isChatBlocked ? "🔒" : (chatIsLoading ? "..." : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M3.4 2.3l18 9a1 1 0 010 1.8l-18 9a1 1 0 01-1.4-1.2l2.7-7.1a1 1 0 01.7-.6l9.7-1.9-9.7-1.9a1 1 0 01-.7-.6L2 3.5A1 1 0 013.4 2.3z" /></svg>
                    <span className="sr-only">Send</span>
                  </>
                ))}
              </button>
            </div>
          </form>
        </div>

        {/* Disclaimer */}
        <div className="absolute bottom-1 left-3 right-8 text-[8px] leading-tight text-gray-400 dark:text-gray-500 text-center pointer-events-none pb-1 max-w-full overflow-hidden">
          <span className="truncate block" title="We log queries and responses during AI node usage to improve system performance">
            We log queries and responses during AI node usage to improve system performance
          </span>
        </div>
      </div>

      <div
        className={`absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize nodrag z-30 ${selected ? "text-sky-600" : "text-gray-400"
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

      {/* Portal-based Model Picker Dropdown */}
      {showModelPicker && createPortal(
        <div
          className="fixed animate-in fade-in-0 zoom-in-95 duration-200 z-[10000]"
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            transform: dropdownPosition.top < 100 ? 'translateY(0)' : 'translateY(-100%)'
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 min-w-[180px] max-w-[280px] max-h-64 overflow-hidden p-1" data-dropdown>
            {/* Search input */}
            {AI_MODELS.length > 5 && (
              <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                <input
                  type="text"
                  placeholder="Search models..."
                  value={modelSearchQuery}
                  onChange={(e) => setModelSearchQuery(e.target.value)}
                  className="w-full px-2 py-1 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                  autoFocus
                />
              </div>
            )}

            {/* Model list */}
            <div className="max-h-40 overflow-y-auto">
              {filteredModels.length === 0 ? (
                <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 text-center">
                  No models found
                </div>
              ) : (
                filteredModels.map(model => {
                  const isSelected = selectedModel === (model.slug || model.id);
                  return (
                    <button
                      key={model.id}
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent event bubbling

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
                      className={`w-full text-left px-3 py-2 text-xs rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150 flex flex-col gap-0.5 ${isSelected
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700'
                        : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                        }`}
                      title={`${model.name} by ${model.provider}${model.slug ? ` (${model.slug})` : ''}`}
                    >
                      <div className="font-medium truncate flex items-center justify-between">
                        <span>{model.name}</span>
                        {isSelected && (
                          <svg className="h-3 w-3 text-emerald-600 dark:text-emerald-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <div className="text-[10px] opacity-60 truncate">{model.provider}</div>
                    </button>
                  );
                }))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
});

AiNode.displayName = "AiNode";
