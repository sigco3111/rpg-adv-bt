
import React, { useState, useRef, useCallback, WheelEvent, MouseEvent, useEffect } from 'react';
import { MinimapLayoutNode, MinimapLayoutEdge, SceneType } from '../types';
import { MINIMAP_NODE_WIDTH, MINIMAP_NODE_HEIGHT } from '../constants';

interface MinimapPanelProps {
  nodes: MinimapLayoutNode[];
  edges: MinimapLayoutEdge[];
  currentSceneId: string | null;
}

const getSceneTypeColor = (type: SceneType): string => {
  switch (type) {
    case SceneType.TOWN: return 'var(--pixel-success)';
    case SceneType.COMBAT_BOSS: return 'var(--pixel-error)';
    case SceneType.COMBAT_NORMAL: return '#FF8C00'; // Orange
    case SceneType.CHOICE: return 'var(--pixel-accent)';
    case SceneType.DIALOGUE: return 'var(--pixel-mp)';
    case SceneType.ITEM_GET: return '#DA70D6'; // Orchid
    default: return 'var(--pixel-border)';
  }
};

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 10;
const ZOOM_SENSITIVITY = 0.001;
const DEFAULT_MINIMAP_SCALE = 0.8; 

const FIXED_SVG_TEXT_FONT_SIZE = '13px';

export const MinimapPanel: React.FC<MinimapPanelProps> = ({ nodes, edges, currentSceneId }) => {
  const [transform, setTransform] = useState({ scale: DEFAULT_MINIMAP_SCALE, translateX: 0, translateY: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [panStartTransform, setPanStartTransform] = useState({ x: 0, y: 0 }); // To store transform at pan start

  const svgRef = useRef<SVGSVGElement>(null);

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  if (nodes && nodes.length > 0) {
    nodes.forEach(node => {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + MINIMAP_NODE_WIDTH);
      maxY = Math.max(maxY, node.y + MINIMAP_NODE_HEIGHT);
    });
  } else {
    minX = 0; minY = 0; maxX = MINIMAP_NODE_WIDTH; maxY = MINIMAP_NODE_HEIGHT;
  }

  const padding = 50;
  const viewBoxWidth = (nodes && nodes.length > 0) ? (maxX - minX) + (2 * padding) : MINIMAP_NODE_WIDTH + (2 * padding);
  const viewBoxHeight = (nodes && nodes.length > 0) ? (maxY - minY) + (2 * padding) : MINIMAP_NODE_HEIGHT + (2 * padding);
  const viewBoxX = (nodes && nodes.length > 0) ? minX - padding : 0 - padding;
  const viewBoxY = (nodes && nodes.length > 0) ? minY - padding : 0 - padding;

  const focusOnNode = useCallback((nodeId: string | null) => {
    if (!nodes || nodes.length === 0 || !svgRef.current) return;
    
    const nodeToFocus = nodeId ? nodes.find(n => n.data.id === nodeId) : nodes[0];

    if (nodeToFocus) {
      const nodeCenterX = nodeToFocus.x + MINIMAP_NODE_WIDTH / 2;
      const nodeCenterY = nodeToFocus.y + MINIMAP_NODE_HEIGHT / 2;
      
      const svgRect = svgRef.current.getBoundingClientRect();
      const svgDisplayWidth = svgRect.width;
      const svgDisplayHeight = svgRect.height;

      const newTranslateX = (svgDisplayWidth / 2 / DEFAULT_MINIMAP_SCALE) - nodeCenterX;
      const newTranslateY = (svgDisplayHeight / 2 / DEFAULT_MINIMAP_SCALE) - nodeCenterY;
      
      setTransform({
        scale: DEFAULT_MINIMAP_SCALE,
        translateX: newTranslateX,
        translateY: newTranslateY,
      });
    } else { 
      const contentMidX = (minX + maxX) / 2;
      const contentMidY = (minY + maxY) / 2;
      const svgRect = svgRef.current.getBoundingClientRect();
      const svgDisplayWidth = svgRect.width;
      const svgDisplayHeight = svgRect.height;
      const newTranslateX = (svgDisplayWidth / 2 / DEFAULT_MINIMAP_SCALE) - contentMidX;
      const newTranslateY = (svgDisplayHeight / 2 / DEFAULT_MINIMAP_SCALE) - contentMidY;
      setTransform({
         scale: DEFAULT_MINIMAP_SCALE,
         translateX: newTranslateX,
         translateY: newTranslateY,
      });
    }
  }, [nodes, minX, maxX, minY, maxY]);

  const handleWheel = useCallback((event: WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    if (!svgRef.current) return;

    const CTM = svgRef.current.getScreenCTM();
    if(!CTM) return;

    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const mousePoint = pt.matrixTransform(CTM.inverse());

    const delta = -event.deltaY * ZOOM_SENSITIVITY;
    const newScaleRaw = transform.scale * (1 + delta);
    const newScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, newScaleRaw));

    const newTranslateX = mousePoint.x - (mousePoint.x - transform.translateX) * (newScale / transform.scale);
    const newTranslateY = mousePoint.y - (mousePoint.y - transform.translateY) * (newScale / transform.scale);

    setTransform({ scale: newScale, translateX: newTranslateX, translateY: newTranslateY });
  }, [transform]);


  const handleMouseDown = useCallback((event: MouseEvent<SVGSVGElement>) => {
    if (event.button !== 0) return; 
    setIsPanning(true);
    
    const CTM = svgRef.current?.getScreenCTM();
    if (CTM && svgRef.current) {
      const pt = svgRef.current.createSVGPoint();
      pt.x = event.clientX;
      pt.y = event.clientY;
      const startPanPoint = pt.matrixTransform(CTM.inverse());
      setPanStart({ x: startPanPoint.x, y: startPanPoint.y });
      setPanStartTransform({ x: transform.translateX, y: transform.translateY }); // Store current transform
    } else {
       setPanStart({ x: event.clientX, y: event.clientY });
       setPanStartTransform({ x: transform.translateX, y: transform.translateY });
    }
  }, [transform.translateX, transform.translateY]); // Added transform dependencies

  const handleMouseMove = useCallback((event: MouseEvent<SVGSVGElement>) => {
    if (!isPanning || !svgRef.current) return;
    
    const CTM = svgRef.current.getScreenCTM();
    if (!CTM) return;

    const pt = svgRef.current.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const currentPanPoint = pt.matrixTransform(CTM.inverse());
    
    const dx = currentPanPoint.x - panStart.x; // Total displacement in SVG X from pan start
    const dy = currentPanPoint.y - panStart.y; // Total displacement in SVG Y from pan start

    setTransform(prevTransform => ({
        scale: prevTransform.scale,
        translateX: panStartTransform.x + dx, // Apply displacement to the transform at pan start
        translateY: panStartTransform.y + dy, // Apply displacement to the transform at pan start
    }));
  }, [isPanning, panStart, panStartTransform]); // Added panStartTransform dependency

  const handleMouseUpOrLeave = useCallback(() => {
    setIsPanning(false);
  }, []);

  const zoomWithFocus = (zoomFactor: number) => {
    if (!svgRef.current) return;
    const newScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, transform.scale * zoomFactor));

    const svgRect = svgRef.current.getBoundingClientRect();
    const CTM = svgRef.current.getScreenCTM();
    if(!CTM) return;

    const pt = svgRef.current.createSVGPoint();
    pt.x = svgRect.left + svgRect.width / 2;
    pt.y = svgRect.top + svgRect.height / 2;
    const svgCenterPoint = pt.matrixTransform(CTM.inverse()); 

    const newTranslateX = svgCenterPoint.x - (svgCenterPoint.x - transform.translateX) * (newScale / transform.scale);
    const newTranslateY = svgCenterPoint.y - (svgCenterPoint.y - transform.translateY) * (newScale / transform.scale);

    setTransform({ scale: newScale, translateX: newTranslateX, translateY: newTranslateY });
  };


  const handleZoomIn = () => zoomWithFocus(1.25);
  const handleZoomOut = () => zoomWithFocus(0.8);

  const handleResetView = () => {
    if (nodes && nodes.length > 0) {
      focusOnNode(currentSceneId || (nodes[0]?.data.id || null));
    }
  };


  if (!nodes || nodes.length === 0) {
    return <div className="w-full h-full flex items-center justify-center text-xs text-[var(--pixel-text-dim)]">미니맵 데이터 없음</div>;
  }

  const getNodeCenter = (nodeId: string): { x: number; y: number } | null => {
    const node = nodes.find(n => n.data.id === nodeId);
    if (!node) return null;
    return {
      x: node.x + MINIMAP_NODE_WIDTH / 2,
      y: node.y + MINIMAP_NODE_HEIGHT / 2,
    };
  };

  const truncateText = (text: string): string => {
    const readableMaxLength = 10; 
    if (text.length <= readableMaxLength) return text;
    return text.substring(0, readableMaxLength -1) + '…'; 
  }

  const dynamicStrokeWidth = Math.max(0.5, 2 / transform.scale);
  const dynamicArrowMarkerScale = Math.min(1, Math.max(0.1, 1 / transform.scale)); 


  return (
    <div className="relative w-full h-full">
      <svg
          ref={svgRef}
          viewBox={`${viewBoxX} ${viewBoxY} ${viewBoxWidth || 100} ${viewBoxHeight || 100}`}
          preserveAspectRatio="xMidYMid meet"
          className={`minimap-svg ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
          aria-labelledby="minimap-title"
          role="graphics-document"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
      >
        <title id="minimap-title">현재 스테이지 미니맵 (휠로 확대/축소, 드래그로 이동)</title>
        <defs>
          <marker
            id="arrowhead"
            markerWidth={6 * dynamicArrowMarkerScale} 
            markerHeight={4 * dynamicArrowMarkerScale}
            refX={5 * dynamicArrowMarkerScale} 
            refY={2 * dynamicArrowMarkerScale}
            orient="auto"
            fill="var(--pixel-border)"
          >
            <polygon points={`0 0, ${6 * dynamicArrowMarkerScale} ${2 * dynamicArrowMarkerScale}, 0 ${4 * dynamicArrowMarkerScale}`} />
          </marker>
        </defs>
        <g transform={`translate(${transform.translateX}, ${transform.translateY}) scale(${transform.scale})`}>
          {edges.map((edge, index) => {
            const sourcePos = getNodeCenter(edge.sourceId);
            const targetPos = getNodeCenter(edge.targetId);
            if (!sourcePos || !targetPos) return null;

            let dx = targetPos.x - sourcePos.x;
            let dy = targetPos.y - sourcePos.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist === 0) return null; 

            dx /= dist; 
            dy /= dist; 

            const arrowOffsetFactor = 1.2; 
            const endX = targetPos.x - dx * (MINIMAP_NODE_WIDTH / 2 * arrowOffsetFactor);
            const endY = targetPos.y - dy * (MINIMAP_NODE_HEIGHT / 2 * arrowOffsetFactor);


            return (
              <line
                key={`edge-${index}`}
                x1={sourcePos.x}
                y1={sourcePos.y}
                x2={endX}
                y2={endY}
                className="minimap-edge"
                style={{ strokeWidth: dynamicStrokeWidth }}
                markerEnd="url(#arrowhead)"
              />
            );
          })}
          {nodes.map(node => (
            <g key={node.data.id} transform={`translate(${node.x}, ${node.y})`} className="minimap-node" role="img" aria-label={node.data.title}>
              <title>{node.data.title} ({node.data.type})</title>
              <rect
                width={MINIMAP_NODE_WIDTH}
                height={MINIMAP_NODE_HEIGHT}
                className={`minimap-node-rect ${node.isCurrent ? 'current-node' : ''} ${node.isVisited ? 'visited-node' : ''}`}
                style={{
                    stroke: node.isCurrent ? 'var(--pixel-text)' : getSceneTypeColor(node.data.type),
                    strokeWidth: Math.max(0.5, (node.isCurrent ? 3 : 2) / transform.scale) 
                }}
                aria-hidden="true"
              />
              <text
                x={MINIMAP_NODE_WIDTH / 2}
                y={MINIMAP_NODE_HEIGHT / 2}
                className={`minimap-node-text ${node.isCurrent ? 'current-node' : ''}`}
                style={{ fontSize: FIXED_SVG_TEXT_FONT_SIZE }} 
                aria-hidden="true"
              >
                {truncateText(node.data.title)}
              </text>
            </g>
          ))}
        </g>
      </svg>
      <div className="minimap-controls">
        <button onClick={handleZoomIn} className="minimap-control-button" aria-label="미니맵 확대">+</button>
        <button onClick={handleZoomOut} className="minimap-control-button" aria-label="미니맵 축소">-</button>
        <button onClick={handleResetView} className="minimap-control-button" aria-label="미니맵 뷰 초기화">⏹</button>
      </div>
    </div>
  );
};
