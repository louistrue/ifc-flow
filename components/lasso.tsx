import { useRef, type PointerEvent } from 'react';
import { useReactFlow, useStore } from 'reactflow';

type NodePoints = ([number, number] | [number, number, number])[];
type NodePointObject = Record<string, NodePoints>;

export function Lasso({ partial }: { partial: boolean }) {
    const { flowToScreenPosition, setNodes, getNodes } = useReactFlow();
    const { width, height } = useStore((state) => ({
        width: state.width,
        height: state.height,
    }));
    const canvas = useRef<HTMLCanvasElement>(null);
    const ctx = useRef<CanvasRenderingContext2D | undefined | null>(null);

    const nodePoints = useRef<NodePointObject>({});
    const pointRef = useRef<[number, number][]>([]);

    function handlePointerDown(e: PointerEvent) {
        const canvasEl = e.target as HTMLCanvasElement;
        canvasEl.setPointerCapture(e.pointerId);
        const rect = canvasEl.getBoundingClientRect();

        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const points = pointRef.current;
        const nextPoints = [...points, [x, y]] satisfies [number, number][];
        pointRef.current = nextPoints;

        nodePoints.current = {};
        const nodes = getNodes();
        for (const node of nodes) {
            const nx = node.position.x;
            const ny = node.position.y;
            const width = node.width || 150;
            const height = node.height || 40;
            const points = [
                [nx, ny],
                [nx + width, ny],
                [nx + width, ny + height],
                [nx, ny + height],
            ] satisfies NodePoints;
            nodePoints.current[node.id] = points;
        }

        ctx.current = canvas.current?.getContext('2d');
        if (!ctx.current) return;

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
        ctx.current.lineWidth = lineWidth;
        ctx.current.fillStyle = `hsl(${h}, ${s}%, ${l}%, ${fillOpacity})`;
        ctx.current.strokeStyle = `hsl(${h}, ${s}%, ${l}%, ${strokeOpacity})`;
        ctx.current.setLineDash([dashLength, dashGap]);
        ctx.current.lineCap = 'round';
        ctx.current.lineJoin = 'round';
    }

    function handlePointerMove(e: PointerEvent) {
        if (e.buttons !== 1) return;

        const canvasEl = e.target as HTMLCanvasElement;
        const rect = canvasEl.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const points = pointRef.current;
        const nextPoints = [...points, [x, y]] satisfies [number, number][];
        pointRef.current = nextPoints;

        if (!ctx.current || nextPoints.length < 2) return;

        // Clear and redraw
        ctx.current.clearRect(0, 0, width, height);

        // Draw the lasso path with custom dashed lines
        ctx.current.beginPath();
        ctx.current.moveTo(nextPoints[0][0], nextPoints[0][1]);

        for (let i = 1; i < nextPoints.length; i++) {
            ctx.current.lineTo(nextPoints[i][0], nextPoints[i][1]);
        }

        // Close the path for fill
        ctx.current.closePath();

        // Fill first, then stroke
        ctx.current.fill();
        ctx.current.stroke();

        // Create path for hit testing
        const path = new Path2D();
        path.moveTo(nextPoints[0][0], nextPoints[0][1]);
        for (let i = 1; i < nextPoints.length; i++) {
            path.lineTo(nextPoints[i][0], nextPoints[i][1]);
        }
        path.closePath();

        const nodesToSelect = new Set<string>();

        // We need the canvas rect for hit testing conversion too
        // Since we are in the event handler, we can use the rect we just calculated
        // But for robustness, let's use the canvas ref if available or fallback to the event target
        const canvasRect = canvas.current?.getBoundingClientRect() || rect;

        for (const [nodeId, points] of Object.entries(nodePoints.current)) {
            if (partial) {
                // Partial selection: select node if any point is in the path
                for (const point of points) {
                    const screenPos = flowToScreenPosition({ x: point[0], y: point[1] });
                    // Convert screen position to canvas-relative position
                    const canvasX = screenPos.x - canvasRect.left;
                    const canvasY = screenPos.y - canvasRect.top;

                    if (ctx.current.isPointInPath(path, canvasX, canvasY)) {
                        nodesToSelect.add(nodeId);
                        break;
                    }
                }
            } else {
                // Full selection: select node only if all points are in the path
                let allPointsInPath = true;
                for (const point of points) {
                    const screenPos = flowToScreenPosition({ x: point[0], y: point[1] });
                    // Convert screen position to canvas-relative position
                    const canvasX = screenPos.x - canvasRect.left;
                    const canvasY = screenPos.y - canvasRect.top;

                    if (!ctx.current.isPointInPath(path, canvasX, canvasY)) {
                        allPointsInPath = false;
                        break;
                    }
                }
                if (allPointsInPath) {
                    nodesToSelect.add(nodeId);
                }
            }
        }

        setNodes((nodes) =>
            nodes.map((node) => ({
                ...node,
                selected: nodesToSelect.has(node.id),
            })),
        );
    }

    function handlePointerUp(e: PointerEvent) {
        (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId);
        pointRef.current = [];
        if (ctx.current) {
            ctx.current.clearRect(0, 0, width, height);
        }
    }

    return (
        <canvas
            ref={canvas}
            width={width}
            height={height}
            className="tool-overlay"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
        />
    );
}
