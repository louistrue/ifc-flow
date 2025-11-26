import { useEffect, useRef } from 'react';
import { useStore, useReactFlow } from 'reactflow';

export function SelectionOverlay() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { getNodes } = useReactFlow();
    const { width, height, userSelectionRect, transform, nodeInternals } = useStore((state) => ({
        width: state.width,
        height: state.height,
        userSelectionRect: state.userSelectionRect,
        transform: state.transform,
        nodeInternals: state.nodeInternals,
    }));

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear canvas first - this ensures deselection clears the box
        ctx.clearRect(0, 0, width, height);

        // Get theme-aware customization from CSS variables
        const rootStyles = getComputedStyle(document.documentElement);
        const selectionColor = rootStyles.getPropertyValue('--selection-color').trim();
        const hslValues = selectionColor.split(' ');
        const h = parseFloat(hslValues[0]);
        const s = parseFloat(hslValues[1]);
        const l = parseFloat(hslValues[2]);

        // Get lasso customization values from CSS variables
        const dashLength = parseFloat(rootStyles.getPropertyValue('--lasso-dash-length').trim()) || 8;
        const dashGap = parseFloat(rootStyles.getPropertyValue('--lasso-dash-gap').trim()) || 6;
        const strokeOpacity = parseFloat(rootStyles.getPropertyValue('--lasso-stroke-opacity').trim()) || 0.8;
        const fillOpacity = parseFloat(rootStyles.getPropertyValue('--lasso-fill-opacity').trim()) || 0.15;
        const lineWidth = parseFloat(rootStyles.getPropertyValue('--lasso-line-width').trim()) || 2.5;

        // Apply theme-aware styling with dashed lines
        ctx.fillStyle = `hsl(${h}, ${s}%, ${l}%, ${fillOpacity})`;
        ctx.strokeStyle = `hsl(${h}, ${s}%, ${l}%, ${strokeOpacity})`;
        ctx.lineWidth = lineWidth;
        ctx.setLineDash([dashLength, dashGap]);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Draw active selection rectangle (during drag)
        if (userSelectionRect) {
            const { x, y, width: rectWidth, height: rectHeight } = userSelectionRect;

            ctx.beginPath();
            ctx.rect(x, y, rectWidth, rectHeight);
            ctx.fill();
            ctx.stroke();
            return; // Don't draw the bounding box while actively selecting
        }

        // Draw selection box around selected nodes (after drag)
        const selectedNodes = getNodes().filter(node => node.selected);

        // Only draw if there are MULTIPLE selected nodes
        // Single node selection relies on the node's own selection glow
        if (selectedNodes.length <= 1) {
            return;
        }

        // Calculate bounding box of all selected nodes
        const [zoomX, zoomY, zoom] = transform;

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        selectedNodes.forEach(node => {
            const nodeX = node.position.x * zoom + zoomX;
            const nodeY = node.position.y * zoom + zoomY;
            const nodeWidth = (node.width || 150) * zoom;
            const nodeHeight = (node.height || 40) * zoom;

            minX = Math.min(minX, nodeX);
            minY = Math.min(minY, nodeY);
            maxX = Math.max(maxX, nodeX + nodeWidth);
            maxY = Math.max(maxY, nodeY + nodeHeight);
        });

        // Add padding around the selection
        const padding = 10;
        minX -= padding;
        minY -= padding;
        maxX += padding;
        maxY += padding;

        const rectWidth = maxX - minX;
        const rectHeight = maxY - minY;

        ctx.beginPath();
        ctx.rect(minX, minY, rectWidth, rectHeight);
        ctx.fill();
        ctx.stroke();
    }, [width, height, userSelectionRect, transform, getNodes, nodeInternals]);
    // Added nodeInternals to dependencies to trigger re-render on selection changes

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 1000,
            }}
        />
    );
}
