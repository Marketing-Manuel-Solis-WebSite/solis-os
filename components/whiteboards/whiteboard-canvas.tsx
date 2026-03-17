'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, MousePointer, StickyNote, Type, Square, ArrowRight, CheckSquare, Trash2, ZoomIn, ZoomOut, RotateCcw, ListPlus } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import {
  createWhiteboardElement, updateWhiteboardElement, deleteWhiteboardElement,
  onWhiteboardElementsSnapshot,
} from '@/lib/db';
import type { WhiteboardElement, ToolMode } from './constants';
import { STICKY_COLORS } from './constants';

interface Props {
  boardId: string;
  boardName: string;
  onBack: () => void;
  /** Callback to convert selected element text into a task */
  onConvertToTask?: (text: string) => void;
}

const TOOLS: { mode: ToolMode; icon: any; labelKey: string }[] = [
  { mode: 'select', icon: MousePointer, labelKey: 'whiteboards.toolSelect' },
  { mode: 'sticky', icon: StickyNote, labelKey: 'whiteboards.toolSticky' },
  { mode: 'text', icon: Type, labelKey: 'whiteboards.toolText' },
  { mode: 'shape', icon: Square, labelKey: 'whiteboards.toolShape' },
  { mode: 'arrow', icon: ArrowRight, labelKey: 'whiteboards.toolArrow' },
];

export default function WhiteboardCanvas({ boardId, boardName, onBack, onConvertToTask }: Props) {
  const { t } = useI18n();
  const { user } = useAuth();
  const svgRef = useRef<SVGSVGElement>(null);

  const [elements, setElements] = useState<WhiteboardElement[]>([]);
  const [tool, setTool] = useState<ToolMode>('select');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const saveTimeoutRef = useRef<any>(null);

  // Real-time sync
  useEffect(() => {
    const unsub = onWhiteboardElementsSnapshot(boardId, (elems) => {
      setElements(elems as WhiteboardElement[]);
    });
    return () => unsub();
  }, [boardId]);

  // Debounced save
  const debouncedSave = useCallback((elementId: string, data: any) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      updateWhiteboardElement(boardId, elementId, data);
    }, 300);
  }, [boardId]);

  const getMousePos = (e: React.MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - pan.x) / zoom,
      y: (e.clientY - rect.top - pan.y) / zoom,
    };
  };

  const handleCanvasClick = async (e: React.MouseEvent) => {
    if (tool === 'select') {
      setSelectedId(null);
      setEditingId(null);
      return;
    }

    const pos = getMousePos(e);
    const maxZ = elements.length > 0 ? Math.max(...elements.map(el => el.zIndex || 0)) + 1 : 1;

    if (tool === 'sticky') {
      await createWhiteboardElement(boardId, {
        type: 'sticky',
        x: pos.x - 75,
        y: pos.y - 50,
        width: 150,
        height: 100,
        content: '',
        color: STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)],
        createdBy: user?.uid || '',
        zIndex: maxZ,
      });
      setTool('select');
    } else if (tool === 'text') {
      await createWhiteboardElement(boardId, {
        type: 'text',
        x: pos.x,
        y: pos.y,
        width: 200,
        height: 30,
        content: 'Text',
        color: 'var(--text-primary)',
        createdBy: user?.uid || '',
        zIndex: maxZ,
      });
      setTool('select');
    } else if (tool === 'shape') {
      await createWhiteboardElement(boardId, {
        type: 'shape',
        x: pos.x - 50,
        y: pos.y - 50,
        width: 100,
        height: 100,
        content: '',
        color: '#60A5FA',
        style: { shapeType: 'rect' },
        createdBy: user?.uid || '',
        zIndex: maxZ,
      });
      setTool('select');
    } else if (tool === 'arrow') {
      await createWhiteboardElement(boardId, {
        type: 'arrow',
        x: pos.x,
        y: pos.y,
        width: 150,
        height: 0,
        content: '',
        color: '#6B7280',
        createdBy: user?.uid || '',
        zIndex: maxZ,
      });
      setTool('select');
    }
  };

  const handleElementMouseDown = (e: React.MouseEvent, el: WhiteboardElement) => {
    e.stopPropagation();
    if (tool !== 'select') return;

    setSelectedId(el.id);
    const pos = getMousePos(e);
    setDragging({ id: el.id, startX: pos.x, startY: pos.y, origX: el.x, origY: el.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragging) {
      const pos = getMousePos(e);
      const dx = pos.x - dragging.startX;
      const dy = pos.y - dragging.startY;
      const newX = dragging.origX + dx;
      const newY = dragging.origY + dy;

      setElements(prev => prev.map(el =>
        el.id === dragging.id ? { ...el, x: newX, y: newY } : el
      ));
      debouncedSave(dragging.id, { x: newX, y: newY });
    }

    if (isPanning) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setDragging(null);
    setIsPanning(false);
  };

  const handleMiddleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(prev => Math.max(0.2, Math.min(3, prev + delta)));
  };

  const handleDoubleClick = (el: WhiteboardElement) => {
    if (el.type === 'sticky' || el.type === 'text') {
      setEditingId(el.id);
      setEditText(el.content);
    }
  };

  const handleSaveEdit = () => {
    if (editingId) {
      updateWhiteboardElement(boardId, editingId, { content: editText });
      setEditingId(null);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedId) {
      await deleteWhiteboardElement(boardId, selectedId);
      setSelectedId(null);
    }
  };

  const renderElement = (el: WhiteboardElement) => {
    const isSelected = selectedId === el.id;
    const isEditing = editingId === el.id;

    switch (el.type) {
      case 'sticky':
        return (
          <g key={el.id}>
            <rect
              x={el.x}
              y={el.y}
              width={el.width}
              height={el.height}
              rx={6}
              fill={el.color}
              stroke={isSelected ? '#7B68EE' : 'none'}
              strokeWidth={isSelected ? 2 : 0}
              style={{ cursor: tool === 'select' ? 'move' : 'default', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))' }}
              onMouseDown={e => handleElementMouseDown(e, el)}
              onDoubleClick={() => handleDoubleClick(el)}
            />
            {isEditing ? (
              <foreignObject x={el.x + 8} y={el.y + 8} width={el.width - 16} height={el.height - 16}>
                <textarea
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  onBlur={handleSaveEdit}
                  onKeyDown={e => e.key === 'Escape' && handleSaveEdit()}
                  autoFocus
                  style={{
                    width: '100%', height: '100%', background: 'transparent', border: 'none',
                    outline: 'none', resize: 'none', fontSize: '12px', fontFamily: 'inherit', color: '#1a1a1a',
                  }}
                />
              </foreignObject>
            ) : (
              <text
                x={el.x + 10}
                y={el.y + 20}
                fontSize={12}
                fill="#1a1a1a"
                style={{ pointerEvents: 'none' }}
              >
                {(el.content || '').split('\n').map((line, i) => (
                  <tspan key={i} x={el.x + 10} dy={i === 0 ? 0 : 16}>{line.slice(0, 25)}</tspan>
                ))}
              </text>
            )}
          </g>
        );

      case 'text':
        return (
          <g key={el.id}>
            {isSelected && (
              <rect x={el.x - 2} y={el.y - 2} width={el.width + 4} height={el.height + 4}
                fill="none" stroke="#7B68EE" strokeWidth={1} strokeDasharray="4 2" rx={3} />
            )}
            {isEditing ? (
              <foreignObject x={el.x} y={el.y} width={el.width} height={el.height + 10}>
                <input
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  onBlur={handleSaveEdit}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                  autoFocus
                  style={{
                    width: '100%', background: 'transparent', border: 'none',
                    outline: 'none', fontSize: '14px', fontFamily: 'inherit',
                    color: 'var(--text-primary)',
                  }}
                />
              </foreignObject>
            ) : (
              <text
                x={el.x}
                y={el.y + 16}
                fontSize={14}
                fill="currentColor"
                style={{ cursor: tool === 'select' ? 'move' : 'default' }}
                onMouseDown={e => handleElementMouseDown(e, el)}
                onDoubleClick={() => handleDoubleClick(el)}
              >
                {el.content}
              </text>
            )}
          </g>
        );

      case 'shape': {
        const shapeType = el.style?.shapeType || 'rect';
        return (
          <g key={el.id}
            onMouseDown={e => handleElementMouseDown(e, el)}
            style={{ cursor: tool === 'select' ? 'move' : 'default' }}
          >
            {shapeType === 'rect' && (
              <rect x={el.x} y={el.y} width={el.width} height={el.height} rx={4}
                fill={el.color + '30'} stroke={el.color} strokeWidth={2} />
            )}
            {shapeType === 'circle' && (
              <ellipse cx={el.x + el.width / 2} cy={el.y + el.height / 2}
                rx={el.width / 2} ry={el.height / 2}
                fill={el.color + '30'} stroke={el.color} strokeWidth={2} />
            )}
            {shapeType === 'diamond' && (
              <polygon
                points={`${el.x + el.width / 2},${el.y} ${el.x + el.width},${el.y + el.height / 2} ${el.x + el.width / 2},${el.y + el.height} ${el.x},${el.y + el.height / 2}`}
                fill={el.color + '30'} stroke={el.color} strokeWidth={2} />
            )}
            {isSelected && (
              <rect x={el.x - 3} y={el.y - 3} width={el.width + 6} height={el.height + 6}
                fill="none" stroke="#7B68EE" strokeWidth={1.5} strokeDasharray="4 2" rx={4} />
            )}
          </g>
        );
      }

      case 'arrow':
        return (
          <g key={el.id}
            onMouseDown={e => handleElementMouseDown(e, el)}
            style={{ cursor: tool === 'select' ? 'move' : 'default' }}
          >
            <defs>
              <marker id={`arrowhead-${el.id}`} markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill={el.color} />
              </marker>
            </defs>
            <line
              x1={el.x} y1={el.y}
              x2={el.x + el.width} y2={el.y + (el.height || 0)}
              stroke={el.color} strokeWidth={2}
              markerEnd={`url(#arrowhead-${el.id})`}
            />
            {isSelected && (
              <>
                <circle cx={el.x} cy={el.y} r={4} fill="#7B68EE" />
                <circle cx={el.x + el.width} cy={el.y + (el.height || 0)} r={4} fill="#7B68EE" />
              </>
            )}
          </g>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)]">
        <button onClick={onBack} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mr-4">{boardName}</h2>

        <div className="h-6 w-px bg-[var(--border-subtle)]" />

        {/* Tools */}
        <div className="flex items-center gap-0.5 ml-2">
          {TOOLS.map(toolItem => (
            <button
              key={toolItem.mode}
              onClick={() => setTool(toolItem.mode)}
              className={`p-2 rounded-lg text-sm transition ${
                tool === toolItem.mode
                  ? 'bg-[var(--accent-subtle)] text-[var(--accent)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
              }`}
              title={t(toolItem.labelKey)}
            >
              <toolItem.icon className="h-4 w-4" />
            </button>
          ))}
        </div>

        <div className="h-6 w-px bg-[var(--border-subtle)] ml-2" />

        {/* Zoom */}
        <div className="flex items-center gap-1 ml-2">
          <button onClick={() => setZoom(z => Math.max(0.2, z - 0.1))} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition" title={t('whiteboards.zoomOut')}>
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="text-[12px] text-[var(--text-muted)] font-mono w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(3, z + 0.1))} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition" title={t('whiteboards.zoomIn')}>
            <ZoomIn className="h-4 w-4" />
          </button>
          <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition" title={t('whiteboards.zoomReset')}>
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>

        {/* Selected element actions */}
        {selectedId && (
          <>
            <div className="h-6 w-px bg-[var(--border-subtle)] ml-2" />
            {onConvertToTask && (
              <button
                onClick={() => {
                  const el = elements.find(e => e.id === selectedId);
                  if (el && (el.content || el.type === 'sticky' || el.type === 'text')) {
                    onConvertToTask(el.content || el.type);
                  }
                }}
                className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-subtle)] transition"
                title={t('whiteboards.convertToTask') || 'Convert to Task'}
              >
                <ListPlus className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={handleDeleteSelected}
              className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--error-bg)] transition"
              title={t('whiteboards.deleteElement')}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-hidden bg-[var(--bg-base)] relative"
        style={{ cursor: tool === 'select' ? 'default' : 'crosshair' }}
      >
        {/* Grid pattern */}
        <svg
          ref={svgRef}
          className="w-full h-full"
          onClick={handleCanvasClick}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onMouseDown={handleMiddleMouseDown}
          onWheel={handleWheel}
        >
          <defs>
            <pattern id="grid" width={20 * zoom} height={20 * zoom} patternUnits="userSpaceOnUse"
              x={pan.x % (20 * zoom)} y={pan.y % (20 * zoom)}>
              <circle cx={1} cy={1} r={0.5} fill="var(--text-muted)" opacity={0.15} />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {elements.map(renderElement)}
          </g>
        </svg>
      </div>
    </div>
  );
}
