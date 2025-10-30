/**
 * Base Node Component
 * Provides common UI patterns for all nodes
 */

'use client'

import { memo, ReactNode } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { Clock, AlertCircle, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface BaseNodeProps extends NodeProps {
    children?: ReactNode
    isLoading?: boolean
    error?: string | null
    progress?: { percentage: number; message?: string } | null
    showStatusIcon?: boolean
    hideDefaultWrapper?: boolean // Allow nodes to disable BaseNode's wrapper styling
    // Theme support
    theme?: {
        background?: string
        border?: string
        borderSelected?: string
        headerBg?: string
        headerText?: string
        headerGradient?: string
        handleStyle?: React.CSSProperties
        handleInputStyle?: React.CSSProperties
        handleOutputStyle?: React.CSSProperties
    }
    // Control default handles
    hideInputHandle?: boolean
    extraHandles?: Array<{
        type: 'target' | 'source'
        position: Position
        id: string
        style?: React.CSSProperties
    }>
}

export const BaseNode = memo(({
    data,
    id,
    selected,
    isConnectable,
    children,
    isLoading = false,
    error = null,
    progress = null,
    showStatusIcon = true,
    hideDefaultWrapper = false,
    theme,
    hideInputHandle = false,
    extraHandles,
}: BaseNodeProps) => {
    const themedHeader = !!(theme?.headerGradient || theme?.headerBg)

    const getStatusIcon = () => {
        if (!showStatusIcon) return null

        if (isLoading) {
            return <Clock className="h-4 w-4 animate-spin text-blue-400" />
        }
        if (error) {
            return <AlertCircle className="h-4 w-4 text-red-400" />
        }
        if (data?.result !== undefined && data?.result !== null) {
            return <CheckCircle className="h-4 w-4 text-green-400" />
        }
        return null
    }

    const content = (
        <>
            {/* Input Handle */}
            {!hideInputHandle && (
                <Handle
                    type="target"
                    position={Position.Left}
                    isConnectable={isConnectable}
                    className="!bg-primary"
                    style={theme?.handleInputStyle || theme?.handleStyle}
                />
            )}

            {/* Header with Status */}
            {!hideDefaultWrapper && !themedHeader && (
                <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {getStatusIcon()}
                        <span className="text-sm font-semibold">{data?.label || 'Node'}</span>
                    </div>
                    {progress && (
                        <span className="text-xs text-muted-foreground">
                            {progress.percentage}%
                        </span>
                    )}
                </div>
            )}

            {/* Error Message */}
            {error && !hideDefaultWrapper && (
                <div className="mb-2 rounded bg-red-50 p-2 text-xs text-red-600 dark:bg-red-900/20 dark:text-red-400">
                    {error}
                </div>
            )}

            {/* Progress Message */}
            {progress?.message && !error && !hideDefaultWrapper && (
                <div className="mb-2 text-xs text-muted-foreground">
                    {progress.message}
                </div>
            )}

            {/* Node Content */}
            <div className={hideDefaultWrapper ? "" : "node-content"}>{children}</div>

            {/* Output Handle */}
            <Handle
                type="source"
                position={Position.Right}
                isConnectable={isConnectable}
                className="!bg-primary"
                style={theme?.handleOutputStyle || theme?.handleStyle}
            />

            {/* Extra Handles */}
            {extraHandles?.map((handle) => (
                <Handle
                    key={handle.id}
                    type={handle.type}
                    position={handle.position}
                    id={handle.id}
                    isConnectable={isConnectable}
                    style={handle.style || { background: "#555", width: 8, height: 8 }}
                />
            ))}
        </>
    )

    if (hideDefaultWrapper) {
        return <>{content}</>
    }

    // Build border classes for CSS selector matching
    // Important: Always keep the base border class for CSS glow selector to match
    // Don't use borderSelected as it overrides the color class needed for glow
    const borderClasses = cn(
        // Full theme border (includes dark: variant for proper styling)
        theme?.border || 'border-border',
        // Fallback for nodes without theme
        !theme?.border && selected && 'border-primary',
        error && 'border-red-500'
    )

    return (
        <div
            data-node-selected={selected ? 'true' : 'false'}
            data-node-theme={theme?.border?.split(' ')[0] || 'default'}
            className={cn(
                'rounded-lg p-0 transition-all overflow-hidden',
                // Border width - thicker when selected
                selected ? 'border-2' : 'border-2',
                theme?.background || 'bg-card',
                borderClasses,
                // Remove shadow when selected to allow CSS glow to show through
                !selected && 'shadow-md',
                isLoading && 'opacity-75'
            )}
        >
            {/* Full-width title bar when theme header is provided */}
            {!hideDefaultWrapper && themedHeader && (
                <div className={cn('px-3 py-1 text-sm font-semibold', theme?.headerGradient || theme?.headerBg, theme?.headerText || 'text-white')}>
                    {data?.label || 'Node'}
                </div>
            )}
            <div className="p-4">
                {content}
            </div>
        </div>
    )
})

BaseNode.displayName = 'BaseNode'

