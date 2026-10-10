import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ArrowRight,
  Split,
  Minus,
  Target,
  Sparkles,
  Pen,
  Eraser,
  RotateCcw,
  RotateCw,
  Trash2,
  Download,
  Check,
  Palette,
  Users,
  Maximize2,
  Minimize2,
  ChevronDown,
} from 'lucide-react';
import { Player } from '../types';

export type DrawingType = 'corte' | 'pase' | 'bloqueo' | 'tiro' | 'bote' | 'lapiz' | 'borrador';
export type CourtView = 'half' | 'full';

export interface TacticalPoint {
  x: number; // 0 to 100 on court
  y: number; // 0 to 93.3 on half court (or 0 to 100 on full)
}

export interface TacticalStroke {
  id: string;
  type: DrawingType;
  color: string;
  width: number;
  points: TacticalPoint[];
}

export interface TacticalToken {
  id: string;
  label: string;
  type: 'offense' | 'defense' | 'ball' | 'cone';
  x: number; // 0 to 100
  y: number; // 0 to 93.3
  playerName?: string;
  dorsal?: number;
}

const DEFAULT_OFFENSE_HALF: TacticalToken[] = [
  { id: 'off-1', label: '1', type: 'offense', x: 50, y: 76, playerName: 'Base' },
  { id: 'off-2', label: '2', type: 'offense', x: 18, y: 56, playerName: 'Escolta' },
  { id: 'off-3', label: '3', type: 'offense', x: 82, y: 56, playerName: 'Alero' },
  { id: 'off-4', label: '4', type: 'offense', x: 12, y: 22, playerName: 'Ala-Pívot' },
  { id: 'off-5', label: '5', type: 'offense', x: 88, y: 22, playerName: 'Pívot' },
];

const DEFAULT_DEFENSE_HALF: TacticalToken[] = [
  { id: 'def-1', label: 'X1', type: 'defense', x: 50, y: 66 },
  { id: 'def-2', label: 'X2', type: 'defense', x: 26, y: 48 },
  { id: 'def-3', label: 'X3', type: 'defense', x: 74, y: 48 },
  { id: 'def-4', label: 'X4', type: 'defense', x: 38, y: 26 },
  { id: 'def-5', label: 'X5', type: 'defense', x: 62, y: 26 },
];

const DEFAULT_BALL: TacticalToken = {
  id: 'ball-1',
  label: '🏀',
  type: 'ball',
  x: 50,
  y: 83,
};

const DRAWING_OPTIONS: Array<{
  id: DrawingType;
  label: string;
  description: string;
  icon: string;
  badge: string;
}> = [
  {
    id: 'corte',
    label: 'Corte (Desplazamiento)',
    description: 'Flecha continua de movimiento o desmarque',
    icon: '➔',
    badge: 'Línea con flecha',
  },
  {
    id: 'pase',
    label: 'Pase de Balón',
    description: 'Línea discontinua táctica con punta de flecha',
    icon: '⇢',
    badge: 'Discontinua',
  },
  {
    id: 'bloqueo',
    label: 'Bloqueo (Screen / Pick)',
    description: 'Línea con tope perpendicular en forma de T',
    icon: '┴',
    badge: 'Tope en T',
  },
  {
    id: 'tiro',
    label: 'Tiro a Canasta',
    description: 'Línea de tiro con diana y objetivo hacia el aro',
    icon: '🎯',
    badge: 'Diana / Tiro',
  },
  {
    id: 'bote',
    label: 'Bote (Dribling)',
    description: 'Línea en zigzag de penetración con bote',
    icon: '∿➔',
    badge: 'Zigzag',
  },
  {
    id: 'lapiz',
    label: 'Lápiz Libre',
    description: 'Trazo manual libre para notas y círculos',
    icon: '✏️',
    badge: 'Mano alzada',
  },
  {
    id: 'borrador',
    label: 'Borrador',
    description: 'Toca trazos para eliminarlos de la pizarra',
    icon: '🧹',
    badge: 'Borrar',
  },
];

const INK_COLORS = [
  { name: 'Amarillo Neón', value: '#FACC15' },
  { name: 'Blanco', value: '#FFFFFF' },
  { name: 'Naranja', value: '#F97316' },
  { name: 'Rojo Fuego', value: '#EF4444' },
  { name: 'Verde Neón', value: '#22C55E' },
  { name: 'Cian Brillante', value: '#38BDF8' },
  { name: 'Magenta', value: '#EC4899' },
  { name: 'Negro Tinta', value: '#0F172A' },
];

const STROKE_WIDTHS = [
  { label: 'Fino', value: 0.8 },
  { label: 'Medio', value: 1.5 },
  { label: 'Grueso', value: 2.6 },
];

interface TacticalBoardProps {
  rosterPlayers?: Player[];
  teamName?: string;
  opponentName?: string;
  onClose?: () => void;
}

export const TacticalBoard: React.FC<TacticalBoardProps> = ({
  rosterPlayers = [],
  teamName = 'Nuestro Equipo',
  opponentName = 'Rival',
}) => {
  const courtContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Selected drawing type from the dropdown menu
  const [drawingType, setDrawingType] = useState<DrawingType>('corte');
  const [inkColor, setInkColor] = useState<string>('#FACC15');
  const [strokeWidth, setStrokeWidth] = useState<number>(1.5);
  const [courtTheme, setCourtTheme] = useState<'parquet' | 'dark'>('parquet');
  const [courtView, setCourtView] = useState<CourtView>('half');

  // Strokes history
  const [strokes, setStrokes] = useState<TacticalStroke[]>([]);
  const [redoStack, setRedoStack] = useState<TacticalStroke[]>([]);

  // Tokens (players, ball, cones)
  const [tokens, setTokens] = useState<TacticalToken[]>([
    ...DEFAULT_OFFENSE_HALF,
    ...DEFAULT_DEFENSE_HALF,
    DEFAULT_BALL,
  ]);
  const [draggingTokenId, setDraggingTokenId] = useState<string | null>(null);

  // Active stroke in progress
  const activeStrokeRef = useRef<TacticalStroke | null>(null);
  const isDrawingRef = useRef<boolean>(false);

  // Load starter players if provided
  useEffect(() => {
    if (rosterPlayers && rosterPlayers.length > 0) {
      const courtStarters = rosterPlayers.filter(p => p.onCourt).slice(0, 5);
      const playersToUse = courtStarters.length >= 3 ? courtStarters : rosterPlayers.slice(0, 5);

      if (playersToUse.length > 0) {
        setTokens(prev => {
          const nonOffense = prev.filter(t => t.type !== 'offense');
          const newOffense: TacticalToken[] = playersToUse.map((p, idx) => {
            const basePos = DEFAULT_OFFENSE_HALF[idx] || { x: 30 + idx * 10, y: 60 };
            return {
              id: `off-${p.id || idx}`,
              label: p.number !== undefined ? `${p.number}` : `${idx + 1}`,
              type: 'offense',
              x: basePos.x,
              y: basePos.y,
              playerName: p.name,
              dorsal: p.number,
            };
          });
          return [...newOffense, ...nonOffense];
        });
      }
    }
  }, [rosterPlayers]);

  // Master Redraw on Canvas (coordinates normalized to 0..100 x 0..93.3)
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Reset transform and clear
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply scale mapping 0..100 -> canvas.width and 0..93.3 -> canvas.height
    const scaleX = canvas.width / 100;
    const scaleY = canvas.height / 93.3;
    ctx.scale(scaleX, scaleY);

    // Render all saved strokes
    strokes.forEach(stroke => {
      drawTacticalStroke(ctx, stroke);
    });

    // Render active stroke in progress
    if (activeStrokeRef.current) {
      drawTacticalStroke(ctx, activeStrokeRef.current);
    }
  }, [strokes]);

  // Handle Resize: match canvas pixel buffer with its CSS display dimensions * devicePixelRatio
  useEffect(() => {
    const updateCanvasResolution = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const targetW = Math.round(rect.width * dpr);
      const targetH = Math.round(rect.height * dpr);

      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      redrawCanvas();
    };

    updateCanvasResolution();

    const resizeObserver = new ResizeObserver(() => {
      updateCanvasResolution();
    });

    if (courtContainerRef.current) {
      resizeObserver.observe(courtContainerRef.current);
    }

    window.addEventListener('resize', updateCanvasResolution);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateCanvasResolution);
    };
  }, [redrawCanvas]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // Precise pointer coordinate translation: converts screen pointer to court coordinates [0..100, 0..93.3]
  const getCourtCoordinates = (clientX: number, clientY: number): TacticalPoint | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    const relX = clientX - rect.left;
    const relY = clientY - rect.top;

    const x = Math.max(0, Math.min(100, (relX / rect.width) * 100));
    const y = Math.max(0, Math.min(93.3, (relY / rect.height) * 93.3));

    return { x, y };
  };

  // Erase stroke by distance
  const eraseStrokeAtPoint = (point: TacticalPoint) => {
    const threshold = 3.5; // in court units
    setStrokes(prev => {
      const filtered = prev.filter(stroke => {
        return !stroke.points.some(p => Math.hypot(p.x - point.x, p.y - point.y) < threshold);
      });
      if (filtered.length !== prev.length) {
        setRedoStack([]);
      }
      return filtered;
    });
  };

  // Pointer Down (Mouse / Touch / Stylus)
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (draggingTokenId) return;

    const coords = getCourtCoordinates(e.clientX, e.clientY);
    if (!coords) return;

    // Capture pointer to guarantee tracking even outside element boundaries
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    isDrawingRef.current = true;

    if (drawingType === 'borrador') {
      eraseStrokeAtPoint(coords);
      return;
    }

    activeStrokeRef.current = {
      id: `stroke-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      type: drawingType,
      color: inkColor,
      width: strokeWidth,
      points: [coords, coords],
    };

    redrawCanvas();
  };

  // Pointer Move
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;

    const coords = getCourtCoordinates(e.clientX, e.clientY);
    if (!coords) return;

    if (drawingType === 'borrador') {
      eraseStrokeAtPoint(coords);
      return;
    }

    if (!activeStrokeRef.current) return;

    if (drawingType === 'lapiz') {
      // Continuous freehand path
      activeStrokeRef.current.points.push(coords);
    } else {
      // Vector shapes: start point and current destination tip
      activeStrokeRef.current.points = [activeStrokeRef.current.points[0], coords];
    }

    redrawCanvas();
  };

  // Pointer Up
  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    if (activeStrokeRef.current) {
      const finalStroke = activeStrokeRef.current;
      activeStrokeRef.current = null;

      const pts = finalStroke.points;
      if (pts.length > 0) {
        const p1 = pts[0];
        const p2 = pts[pts.length - 1];
        const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);

        // Discard accidental zero-distance micro-taps for vector lines
        if (finalStroke.type === 'lapiz' || dist > 1.2) {
          setStrokes(prev => [...prev, finalStroke]);
          setRedoStack([]);
        }
      }
    }

    redrawCanvas();
  };

  // Undo / Redo controls
  const handleUndo = () => {
    if (strokes.length === 0) return;
    const last = strokes[strokes.length - 1];
    setStrokes(prev => prev.slice(0, -1));
    setRedoStack(prev => [...prev, last]);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    setStrokes(prev => [...prev, next]);
  };

  // Clear Board
  const handleClearBoard = () => {
    if (strokes.length === 0) return;
    setStrokes([]);
    setRedoStack([]);
  };

  // Reset player tokens
  const handleResetPositions = () => {
    setTokens([
      ...DEFAULT_OFFENSE_HALF,
      ...DEFAULT_DEFENSE_HALF,
      DEFAULT_BALL,
    ]);
  };

  // Tactical Formations
  const handleApplyFormation = (formation: '5out' | '4out1in' | 'horns' | 'zone23') => {
    if (formation === '5out') {
      setTokens(prev =>
        prev.map(t => {
          if (t.id === 'off-1') return { ...t, x: 50, y: 78 };
          if (t.id === 'off-2') return { ...t, x: 18, y: 55 };
          if (t.id === 'off-3') return { ...t, x: 82, y: 55 };
          if (t.id === 'off-4') return { ...t, x: 10, y: 22 };
          if (t.id === 'off-5') return { ...t, x: 90, y: 22 };
          if (t.id === 'ball-1') return { ...t, x: 50, y: 84 };
          return t;
        })
      );
    } else if (formation === '4out1in') {
      setTokens(prev =>
        prev.map(t => {
          if (t.id === 'off-1') return { ...t, x: 50, y: 79 };
          if (t.id === 'off-2') return { ...t, x: 16, y: 58 };
          if (t.id === 'off-3') return { ...t, x: 84, y: 58 };
          if (t.id === 'off-4') return { ...t, x: 12, y: 24 };
          if (t.id === 'off-5') return { ...t, x: 50, y: 34 };
          if (t.id === 'ball-1') return { ...t, x: 50, y: 85 };
          return t;
        })
      );
    } else if (formation === 'horns') {
      setTokens(prev =>
        prev.map(t => {
          if (t.id === 'off-1') return { ...t, x: 50, y: 80 };
          if (t.id === 'off-2') return { ...t, x: 12, y: 25 };
          if (t.id === 'off-3') return { ...t, x: 88, y: 25 };
          if (t.id === 'off-4') return { ...t, x: 35, y: 53 };
          if (t.id === 'off-5') return { ...t, x: 65, y: 53 };
          if (t.id === 'ball-1') return { ...t, x: 50, y: 86 };
          return t;
        })
      );
    } else if (formation === 'zone23') {
      setTokens(prev =>
        prev.map(t => {
          if (t.id === 'def-1') return { ...t, x: 38, y: 62 };
          if (t.id === 'def-2') return { ...t, x: 62, y: 62 };
          if (t.id === 'def-3') return { ...t, x: 22, y: 28 };
          if (t.id === 'def-4') return { ...t, x: 50, y: 24 };
          if (t.id === 'def-5') return { ...t, x: 78, y: 28 };
          return t;
        })
      );
    }
  };

  // Dragging tokens across the court
  const handleTokenPointerDown = (tokenId: string, e: React.PointerEvent) => {
    e.stopPropagation();
    setDraggingTokenId(tokenId);
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handleTokenPointerMove = (tokenId: string, e: React.PointerEvent) => {
    if (draggingTokenId !== tokenId) return;
    const coords = getCourtCoordinates(e.clientX, e.clientY);
    if (!coords) return;

    setTokens(prev =>
      prev.map(t => (t.id === tokenId ? { ...t, x: coords.x, y: coords.y } : t))
    );
  };

  const handleTokenPointerUp = (tokenId: string, e: React.PointerEvent) => {
    if (draggingTokenId === tokenId) {
      setDraggingTokenId(null);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  // Export board as high-res PNG image
  const handleExportImage = () => {
    const container = courtContainerRef.current;
    if (!container) return;

    const exportCanvas = document.createElement('canvas');
    const width = 1200;
    const height = Math.round((1200 * 93.3) / 100);
    exportCanvas.width = width;
    exportCanvas.height = height;

    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;

    // Draw court background SVG onto export canvas via Image
    const svgElement = container.querySelector('svg');
    if (!svgElement) return;

    const svgString = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const blobURL = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(blobURL);

      // Draw all tactical strokes on export
      ctx.save();
      const scaleX = width / 100;
      const scaleY = height / 93.3;
      ctx.scale(scaleX, scaleY);
      strokes.forEach(stroke => {
        drawTacticalStroke(ctx, stroke);
      });
      ctx.restore();

      // Draw tokens
      tokens.forEach(token => {
        const px = (token.x / 100) * width;
        const py = (token.y / 93.3) * height;
        const radius = token.type === 'ball' ? 20 : 25;

        ctx.save();
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);

        if (token.type === 'offense') {
          ctx.fillStyle = '#EA580C';
          ctx.fill();
          ctx.lineWidth = 3.5;
          ctx.strokeStyle = '#FFFFFF';
          ctx.stroke();

          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 20px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(token.label, px, py);
        } else if (token.type === 'defense') {
          ctx.fillStyle = '#2563EB';
          ctx.fill();
          ctx.lineWidth = 3.5;
          ctx.strokeStyle = '#FFFFFF';
          ctx.stroke();

          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 18px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(token.label, px, py);
        } else if (token.type === 'ball') {
          ctx.fillStyle = '#D97706';
          ctx.fill();
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = '#FFFFFF';
          ctx.stroke();

          ctx.font = '24px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🏀', px, py + 1);
        }
        ctx.restore();
      });

      // Title header watermark
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(16, 16, 360, 54);
      ctx.strokeStyle = '#D4AF37';
      ctx.lineWidth = 2;
      ctx.strokeRect(16, 16, 360, 54);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`PIZARRA TÁCTICA • ${teamName}`, 28, 24);

      ctx.fillStyle = '#F5C542';
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillText(`${new Date().toLocaleDateString('es-ES')} • BasketStats PRO`, 28, 46);
      ctx.restore();

      const dataUrl = exportCanvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `pizarra_tactica_${Date.now()}.png`;
      a.click();
    };
    img.src = blobURL;
  };

  const activeOption = DRAWING_OPTIONS.find(o => o.id === drawingType) || DRAWING_OPTIONS[0];

  return (
    <div className="flex flex-col h-full w-full bg-[#070c1e] text-slate-100 select-none">
      {/* 1. TOP TOOLBAR: Dropdown for Drawing Type, Inks, Actions */}
      <div className="bg-[#0c1633] border-b border-blue-900/60 p-2 sm:p-2.5 flex flex-wrap items-center justify-between gap-2 shrink-0 z-20 shadow-md">
        {/* Left: Prominent Dropdown Menu for Drawing Type */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <label
              htmlFor="tactical-drawing-type-select"
              className="text-[10px] font-mono uppercase font-extrabold text-amber-400 block mb-0.5"
            >
              Tipo de Jugada / Flecha:
            </label>
            <div className="relative flex items-center">
              <select
                id="tactical-drawing-type-select"
                value={drawingType}
                onChange={e => setDrawingType(e.target.value as DrawingType)}
                className="appearance-none bg-[#0a1638] hover:bg-[#0f2154] text-white font-black text-xs sm:text-sm pl-8 pr-8 py-2 rounded-xl border-2 border-amber-500/80 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition cursor-pointer shadow-md min-w-[200px]"
              >
                {DRAWING_OPTIONS.map(opt => (
                  <option key={opt.id} value={opt.id} className="bg-[#0a1638] text-white py-1">
                    {opt.icon} {opt.label} ({opt.badge})
                  </option>
                ))}
              </select>

              {/* Leading Icon */}
              <span className="absolute left-2.5 text-base pointer-events-none text-amber-400">
                {activeOption.icon}
              </span>

              {/* Trailing Chevron */}
              <ChevronDown className="w-4 h-4 text-amber-400 absolute right-2.5 pointer-events-none" />
            </div>
          </div>

          {/* Quick Active Badge Feedback */}
          <div className="hidden md:flex flex-col justify-center text-[10px] text-slate-300 font-mono pl-1">
            <span className="font-bold text-amber-300">{activeOption.badge}</span>
            <span className="text-slate-400 truncate max-w-[160px]">{activeOption.description}</span>
          </div>
        </div>

        {/* Center: Ink Color Palette Controls */}
        <div className="flex items-center gap-1.5 bg-[#091129] p-1 rounded-xl border border-blue-900/60">
          <Palette className="w-3.5 h-3.5 text-slate-400 ml-1 shrink-0" />
          <div className="flex items-center gap-1">
            {INK_COLORS.map(c => (
              <button
                key={c.value}
                type="button"
                onClick={() => setInkColor(c.value)}
                className={`w-6 h-6 rounded-full transition-transform flex items-center justify-center relative ${
                  inkColor === c.value
                    ? 'ring-2 ring-white scale-110 shadow-sm z-10'
                    : 'opacity-85 hover:opacity-100 hover:scale-105'
                }`}
                style={{ backgroundColor: c.value }}
                title={`Color de tinta: ${c.name}`}
              >
                {inkColor === c.value && (
                  <Check
                    className={`w-3 h-3 ${
                      c.value === '#FFFFFF' || c.value === '#FACC15' ? 'text-black' : 'text-white'
                    }`}
                  />
                )}
              </button>
            ))}

            {/* Custom native color picker */}
            <label
              className="w-6 h-6 rounded-full border border-dashed border-slate-400 cursor-pointer flex items-center justify-center bg-gradient-to-tr from-pink-500 via-amber-400 to-cyan-400 text-[10px] overflow-hidden"
              title="Personalizar color de tinta"
            >
              <input
                type="color"
                value={inkColor}
                onChange={e => setInkColor(e.target.value)}
                className="opacity-0 w-0 h-0 cursor-pointer"
              />
            </label>
          </div>

          <div className="h-4 w-px bg-blue-900 mx-0.5" />

          {/* Stroke Width Toggle */}
          <div className="flex items-center gap-0.5">
            {STROKE_WIDTHS.map(sw => (
              <button
                key={sw.value}
                type="button"
                onClick={() => setStrokeWidth(sw.value)}
                className={`px-1.5 py-0.5 text-[10px] font-mono rounded transition ${
                  strokeWidth === sw.value
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
                title={`Grosor de trazo: ${sw.label}`}
              >
                {sw.label[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Actions (Undo, Redo, Clear Board, Export) */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleUndo}
            disabled={strokes.length === 0}
            className="p-1.5 rounded-lg bg-blue-950/80 hover:bg-blue-900 text-slate-200 border border-blue-800/60 disabled:opacity-40 transition shadow-xs"
            title="Deshacer último trazo (Undo)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className="p-1.5 rounded-lg bg-blue-950/80 hover:bg-blue-900 text-slate-200 border border-blue-800/60 disabled:opacity-40 transition shadow-xs"
            title="Rehacer trazo (Redo)"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <button
            type="button"
            id="tactical-board-clear-btn"
            onClick={handleClearBoard}
            disabled={strokes.length === 0}
            className="px-2.5 py-1.5 rounded-lg bg-rose-950/70 hover:bg-rose-900 text-rose-300 border border-rose-800/60 disabled:opacity-40 text-xs font-bold transition flex items-center gap-1 shadow-xs"
            title="Limpiar todos los dibujos de la pizarra"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>Limpiar</span>
          </button>

          <button
            type="button"
            onClick={handleExportImage}
            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1 shadow-sm active:scale-95"
            title="Descargar imagen PNG de la jugada"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Guardar</span>
          </button>
        </div>
      </div>

      {/* 2. SUB-TOOLBAR: Parquet Theme Toggle & Formations */}
      <div className="bg-[#091129] border-b border-blue-950 px-2.5 py-1 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0 z-10">
        <div className="flex items-center gap-2 font-mono text-[11px]">
          {/* Theme switcher: Parquet identical to shot map vs Dark arena */}
          <div className="flex items-center bg-black/40 p-0.5 rounded-lg border border-blue-900/60">
            <button
              type="button"
              onClick={() => setCourtTheme('parquet')}
              className={`px-2.5 py-1 rounded-md transition font-black flex items-center gap-1 ${
                courtTheme === 'parquet'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>🪵</span>
              <span>Parquet Real FIBA</span>
            </button>
            <button
              type="button"
              onClick={() => setCourtTheme('dark')}
              className={`px-2.5 py-1 rounded-md transition font-black flex items-center gap-1 ${
                courtTheme === 'dark'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>🏟️</span>
              <span>Pista Oscura</span>
            </button>
          </div>
        </div>

        {/* Quick Set Plays & Reset Tokens */}
        <div className="flex items-center gap-1.5 text-[11px] font-mono">
          <span className="text-slate-400 text-[10px] uppercase font-bold hidden sm:inline">
            Alineación:
          </span>
          <button
            type="button"
            onClick={() => handleApplyFormation('5out')}
            className="px-2 py-0.5 rounded bg-blue-950/80 hover:bg-blue-900 text-cyan-300 border border-blue-800/60"
            title="Alineación 5 Abiertos"
          >
            5 Abiertos
          </button>
          <button
            type="button"
            onClick={() => handleApplyFormation('4out1in')}
            className="px-2 py-0.5 rounded bg-blue-950/80 hover:bg-blue-900 text-cyan-300 border border-blue-800/60"
            title="Alineación 4 Abiertos + 1 Interior"
          >
            4-Out 1-In
          </button>
          <button
            type="button"
            onClick={() => handleApplyFormation('horns')}
            className="px-2 py-0.5 rounded bg-blue-950/80 hover:bg-blue-900 text-cyan-300 border border-blue-800/60"
            title="Alineación Cuernos"
          >
            Cuernos
          </button>
          <button
            type="button"
            onClick={() => handleApplyFormation('zone23')}
            className="px-2 py-0.5 rounded bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-800/60"
            title="Defensa Zona 2-3"
          >
            Zona 2-3
          </button>

          <button
            type="button"
            onClick={handleResetPositions}
            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
            title="Restablecer fichas"
          >
            Reset Fichas
          </button>
        </div>
      </div>

      {/* 3. MAIN COURT: Exact Parquet Background from Shot Selection + Interactive Canvas */}
      <div className="flex-1 min-h-0 w-full overflow-hidden flex items-center justify-center p-1 sm:p-2.5 relative touch-none select-none bg-[#050a18]">
        {/* Court Container locked to exact FIBA aspect ratio [100 / 93.3] */}
        <div
          ref={courtContainerRef}
          className="relative max-h-full max-w-full aspect-[100/93.3] rounded-2xl border-2 border-neutral-700 shadow-2xl overflow-hidden touch-none"
          style={{ width: '100%', height: '100%' }}
        >
          {/* 3.1 EXACT BASKETBALL COURT SVG FROM SHOT SELECTION (PlayerShotMap.tsx / ShotChartModal.tsx) */}
          <svg
            viewBox="0 0 100 93.3"
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full pointer-events-none select-none"
          >
            <defs>
              {/* Ultra-realistic Maple Hardwood Court Pattern identical to Shot Chart */}
              <pattern
                id="tactical-parquet-floor"
                width="24"
                height="8"
                patternUnits="userSpaceOnUse"
              >
                {/* Natural maple base wood tone */}
                <rect width="24" height="8" fill="#c9975a" />
                {/* Alternating plank tones */}
                <rect x="0" y="0" width="10" height="2" fill="#d7a96d" opacity="0.32" />
                <rect x="10" y="0" width="14" height="2" fill="#bc894c" opacity="0.22" />
                <rect x="0" y="2" width="16" height="2" fill="#b98547" opacity="0.25" />
                <rect x="16" y="2" width="8" height="2" fill="#dfb377" opacity="0.35" />
                <rect x="0" y="4" width="7" height="2" fill="#d4a365" opacity="0.3" />
                <rect x="7" y="4" width="17" height="2" fill="#be8c4e" opacity="0.2" />
                <rect x="0" y="6" width="13" height="2" fill="#bc8849" opacity="0.26" />
                <rect x="13" y="6" width="11" height="2" fill="#ddaf73" opacity="0.34" />
                {/* Fine horizontal plank seams */}
                <line x1="0" y1="0" x2="24" y2="0" stroke="#7e5321" strokeWidth="0.16" opacity="0.75" />
                <line x1="0" y1="2" x2="24" y2="2" stroke="#7e5321" strokeWidth="0.14" opacity="0.6" />
                <line x1="0" y1="4" x2="24" y2="4" stroke="#7e5321" strokeWidth="0.14" opacity="0.6" />
                <line x1="0" y1="6" x2="24" y2="6" stroke="#7e5321" strokeWidth="0.14" opacity="0.6" />
                <line x1="0" y1="8" x2="24" y2="8" stroke="#7e5321" strokeWidth="0.16" opacity="0.75" />
                {/* Staggered vertical end joints */}
                <line x1="10" y1="0" x2="10" y2="2" stroke="#684217" strokeWidth="0.16" opacity="0.8" />
                <line x1="16" y1="2" x2="16" y2="4" stroke="#684217" strokeWidth="0.16" opacity="0.8" />
                <line x1="7" y1="4" x2="7" y2="6" stroke="#684217" strokeWidth="0.16" opacity="0.8" />
                <line x1="13" y1="6" x2="13" y2="8" stroke="#684217" strokeWidth="0.16" opacity="0.8" />
              </pattern>

              {/* Dark Arena Parquet Pattern */}
              <pattern
                id="tactical-dark-arena"
                width="24"
                height="8"
                patternUnits="userSpaceOnUse"
              >
                <rect width="24" height="8" fill="#141720" />
                <line x1="0" y1="0" x2="24" y2="0" stroke="#090b10" strokeWidth="0.18" opacity="0.85" />
                <line x1="0" y1="2" x2="24" y2="2" stroke="#090b10" strokeWidth="0.14" opacity="0.75" />
                <line x1="0" y1="4" x2="24" y2="4" stroke="#090b10" strokeWidth="0.14" opacity="0.75" />
                <line x1="0" y1="6" x2="24" y2="6" stroke="#090b10" strokeWidth="0.14" opacity="0.75" />
                <line x1="10" y1="0" x2="10" y2="2" stroke="#090b10" strokeWidth="0.16" opacity="0.8" />
                <line x1="16" y1="2" x2="16" y2="4" stroke="#090b10" strokeWidth="0.16" opacity="0.8" />
                <line x1="7" y1="4" x2="7" y2="6" stroke="#090b10" strokeWidth="0.16" opacity="0.8" />
                <line x1="13" y1="6" x2="13" y2="8" stroke="#090b10" strokeWidth="0.16" opacity="0.8" />
              </pattern>

              {/* Key / Paint Lane Gradient Stain */}
              <linearGradient id="tactical-fiba-key" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#1e3a8a" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#172554" stopOpacity="0.55" />
              </linearGradient>

              {/* Arena Spotlight Overhead Glow */}
              <radialGradient id="tactical-spotlight" cx="50%" cy="32%" r="68%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity={courtTheme === 'parquet' ? '0.12' : '0.06'} />
                <stop offset="65%" stopColor="#ffffff" stopOpacity="0" />
                <stop offset="100%" stopColor="#000000" stopOpacity="0.3" />
              </radialGradient>
            </defs>

            {/* 1. Out of Bounds Apron Perimeter */}
            <rect x="0" y="0" width="100" height="93.3" fill="#0b0e14" />

            {/* 2. Playing Court Hardwood Floor */}
            <rect
              x="2.5"
              y="2"
              width="95"
              height="89.3"
              rx="0.5"
              fill={courtTheme === 'parquet' ? 'url(#tactical-parquet-floor)' : 'url(#tactical-dark-arena)'}
            />

            {/* 3. Key / Paint Lane Painted Area */}
            <rect
              x="33.7"
              y="2"
              width="32.6"
              height="38.6"
              fill="url(#tactical-fiba-key)"
            />

            {/* 4. Center Jump Circle Area (half-circle on court) */}
            <path
              d="M 38 91.3 A 12 12 0 0 1 62 91.3 Z"
              fill="url(#tactical-fiba-key)"
              fillOpacity="0.4"
            />

            {/* 5. FIBA Regulation Court Lines (Crisp White High Contrast) */}
            <g stroke="#ffffff" strokeWidth="0.75" fill="none" opacity="0.95">
              {/* Outer Boundary Perimeter Line */}
              <rect x="2.5" y="2" width="95" height="89.3" />

              {/* Half-Court Line */}
              <line x1="2.5" y1="91.3" x2="97.5" y2="91.3" />

              {/* Center Circle */}
              <path d="M 38 91.3 A 12 12 0 0 1 62 91.3" />

              {/* 3-Point Straight Baseline Corners (FIBA 6.75m layout) */}
              <line x1="7.5" y1="2" x2="7.5" y2="28" strokeWidth="0.8" />
              <line x1="92.5" y1="2" x2="92.5" y2="28" strokeWidth="0.8" />

              {/* 3-Point Arc */}
              <path d="M 7.5 28 A 43.5 43.5 0 0 0 92.5 28" strokeWidth="0.8" />

              {/* Key / Paint Lane Border */}
              <rect x="33.7" y="2" width="32.6" height="38.6" />

              {/* Free Throw Line */}
              <line x1="33.7" y1="40.6" x2="66.3" y2="40.6" strokeWidth="0.8" />

              {/* Free Throw Circle: Solid half towards half-court */}
              <path d="M 33.7 40.6 A 16.3 16.3 0 0 0 66.3 40.6" />

              {/* Free Throw Circle: Dashed half inside key */}
              <path
                d="M 33.7 40.6 A 16.3 16.3 0 0 1 66.3 40.6"
                strokeDasharray="1.6, 1.6"
                opacity="0.8"
              />

              {/* Key Rebound Hash Marks */}
              <line x1="32.3" y1="17.5" x2="33.7" y2="17.5" strokeWidth="0.6" />
              <rect x="31.8" y="22.7" width="1.9" height="1.6" fill="#ffffff" stroke="none" />
              <line x1="32.3" y1="29.5" x2="33.7" y2="29.5" strokeWidth="0.6" />
              <line x1="32.3" y1="35.5" x2="33.7" y2="35.5" strokeWidth="0.6" />

              <line x1="66.3" y1="17.5" x2="67.7" y2="17.5" strokeWidth="0.6" />
              <rect x="66.3" y="22.7" width="1.9" height="1.6" fill="#ffffff" stroke="none" />
              <line x1="66.3" y1="29.5" x2="67.7" y2="29.5" strokeWidth="0.6" />
              <line x1="66.3" y1="35.5" x2="67.7" y2="35.5" strokeWidth="0.6" />

              {/* Restricted Area Arc */}
              <path d="M 41.7 11 A 8.3 8.3 0 0 0 58.3 11" strokeWidth="0.75" />
              <line x1="41.7" y1="11" x2="41.7" y2="7.5" strokeWidth="0.75" />
              <line x1="58.3" y1="11" x2="58.3" y2="7.5" strokeWidth="0.75" />
            </g>

            {/* 6. Backboard, Orange Rim & Net */}
            <g>
              <line x1="39" y1="7.5" x2="61" y2="7.5" stroke="#ffffff" strokeWidth="1.2" />
              <rect x="45.5" y="7.3" width="9" height="0.4" fill="none" stroke="#ffffff" strokeWidth="0.5" />
              <line x1="50" y1="7.5" x2="50" y2="9.2" stroke="#ea580c" strokeWidth="1.2" />
              <circle cx="50" cy="11" r="2.8" fill="none" stroke="#ea580c" strokeWidth="1.3" />
              <path
                d="M 47.7 11 L 48.6 13.6 L 51.4 13.6 L 52.3 11"
                fill="none"
                stroke="#ffffff"
                strokeWidth="0.35"
                strokeDasharray="0.6, 0.6"
                opacity="0.6"
              />
            </g>

            {/* 7. Arena Spotlight Overlay */}
            <rect x="2.5" y="2" width="95" height="89.3" fill="url(#tactical-spotlight)" pointerEvents="none" />
          </svg>

          {/* 3.2 HTML5 CANVAS DRAWING LAYER: Completely Synced with Court Coordinates */}
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="absolute inset-0 w-full h-full cursor-crosshair touch-none z-20"
            style={{ touchAction: 'none' }}
          />

          {/* 3.3 DRAGGABLE PLAYER & BALL TOKENS OVERLAY */}
          <div className="absolute inset-0 pointer-events-none z-30">
            {tokens.map(token => {
              const isOffense = token.type === 'offense';
              const isDefense = token.type === 'defense';
              const isBall = token.type === 'ball';
              const isCone = token.type === 'cone';

              return (
                <div
                  key={token.id}
                  onPointerDown={e => handleTokenPointerDown(token.id, e)}
                  onPointerMove={e => handleTokenPointerMove(token.id, e)}
                  onPointerUp={e => handleTokenPointerUp(token.id, e)}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing pointer-events-auto touch-none select-none transition-transform duration-75 flex flex-col items-center justify-center ${
                    draggingTokenId === token.id ? 'scale-125 z-40' : 'hover:scale-110'
                  }`}
                  style={{
                    left: `${token.x}%`,
                    top: `${(token.y / 93.3) * 100}%`,
                  }}
                  title={token.playerName ? `${token.label} (${token.playerName})` : token.label}
                >
                  {isOffense && (
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 text-white font-black text-xs sm:text-sm flex items-center justify-center shadow-lg border-2 border-white ring-2 ring-orange-950/60 drop-shadow-md">
                      {token.label}
                    </div>
                  )}

                  {isDefense && (
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-black text-xs sm:text-sm flex items-center justify-center shadow-lg border-2 border-white ring-2 ring-blue-950/60 drop-shadow-md">
                      {token.label}
                    </div>
                  )}

                  {isBall && (
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-700 flex items-center justify-center text-sm shadow-xl border-2 border-white ring-2 ring-amber-950 drop-shadow-md">
                      🏀
                    </div>
                  )}

                  {isCone && (
                    <div className="w-6 h-6 rounded-md bg-amber-500 text-black font-black text-xs flex items-center justify-center shadow-md border border-white">
                      ▲
                    </div>
                  )}

                  {token.playerName && token.type !== 'ball' && (
                    <span className="text-[9px] font-bold text-white bg-black/80 px-1 py-0.2 rounded mt-0.5 whitespace-nowrap max-w-[65px] truncate drop-shadow pointer-events-none">
                      {token.playerName.split(' ')[0]}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Tactical Legend Floating Note */}
          <div className="absolute bottom-2 left-2 z-20 bg-black/80 backdrop-blur-xs border border-white/10 rounded-lg px-2.5 py-1 text-[10px] font-mono text-slate-300 flex items-center gap-3 pointer-events-none">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500 border border-white" />
              <span>{teamName}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 border border-white" />
              <span>{opponentName}</span>
            </div>
            <div className="flex items-center gap-1">
              <span>🏀</span>
              <span>Balón</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// =========================================================================
// CANVAS VECTOR RENDERING HELPERS: Pase, Bloqueo, Corte, Tiro, Bote, Lápiz
// =========================================================================

function drawTacticalStroke(ctx: CanvasRenderingContext2D, stroke: TacticalStroke) {
  const pts = stroke.points;
  if (!pts || pts.length === 0) return;

  ctx.save();
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.lineWidth = stroke.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const pStart = pts[0];
  const pEnd = pts[pts.length - 1];

  if (stroke.type === 'lapiz') {
    // Smooth continuous freehand path
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(pStart.x, pStart.y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();
  } else if (stroke.type === 'corte') {
    // CORTE: Solid directional movement arrow
    ctx.setLineDash([]);
    drawArrowVector(ctx, pStart.x, pStart.y, pEnd.x, pEnd.y, stroke.width);
  } else if (stroke.type === 'pase') {
    // PASE: Dashed line with solid arrowhead
    ctx.setLineDash([2.2, 1.6]);
    drawArrowVector(ctx, pStart.x, pStart.y, pEnd.x, pEnd.y, stroke.width);
  } else if (stroke.type === 'bloqueo') {
    // BLOQUEO: Screen line ending in perpendicular T-bar cap
    ctx.setLineDash([]);
    drawScreenVector(ctx, pStart.x, pStart.y, pEnd.x, pEnd.y, stroke.width);
  } else if (stroke.type === 'tiro') {
    // TIRO: Dotted shot line ending in target ring at hoop
    ctx.setLineDash([1.2, 1.2]);
    drawShotVector(ctx, pStart.x, pStart.y, pEnd.x, pEnd.y, stroke.width);
  } else if (stroke.type === 'bote') {
    // BOTE: Zigzag line of dribbling penetration ending in arrowhead
    ctx.setLineDash([]);
    drawDribbleVector(ctx, pStart.x, pStart.y, pEnd.x, pEnd.y, stroke.width);
  }

  ctx.restore();
}

function drawArrowVector(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  strokeW: number
) {
  const headLength = Math.max(3.2, strokeW * 2.2);
  const angle = Math.atan2(y2 - y1, x2 - x1);

  // Main line
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  // Solid arrowhead
  ctx.save();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - headLength * Math.cos(angle - Math.PI / 6),
    y2 - headLength * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    x2 - headLength * Math.cos(angle + Math.PI / 6),
    y2 - headLength * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawScreenVector(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  strokeW: number
) {
  const tLength = Math.max(4.2, strokeW * 3.2);
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const perpAngle = angle + Math.PI / 2;

  // Main line
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  // Perpendicular T-bar cap
  ctx.save();
  ctx.lineWidth = strokeW * 1.5;
  ctx.beginPath();
  ctx.moveTo(
    x2 - (tLength / 2) * Math.cos(perpAngle),
    y2 - (tLength / 2) * Math.sin(perpAngle)
  );
  ctx.lineTo(
    x2 + (tLength / 2) * Math.cos(perpAngle),
    y2 + (tLength / 2) * Math.sin(perpAngle)
  );
  ctx.stroke();
  ctx.restore();
}

function drawShotVector(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  strokeW: number
) {
  // Main dotted trajectory line
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  // Shot destination: Target bulls-eye ring at the rim
  ctx.save();
  ctx.setLineDash([]);

  // Outer target ring
  ctx.lineWidth = Math.max(0.6, strokeW * 0.6);
  ctx.beginPath();
  ctx.arc(x2, y2, 2.6, 0, Math.PI * 2);
  ctx.stroke();

  // Inner center bullseye
  ctx.beginPath();
  ctx.arc(x2, y2, 1.0, 0, Math.PI * 2);
  ctx.fill();

  // Arrowhead pointing into the target
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headLength = Math.max(2.5, strokeW * 1.8);
  const tipX = x2 - 2.8 * Math.cos(angle);
  const tipY = y2 - 2.8 * Math.sin(angle);

  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(
    tipX - headLength * Math.cos(angle - Math.PI / 6),
    tipY - headLength * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    tipX - headLength * Math.cos(angle + Math.PI / 6),
    tipY - headLength * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawDribbleVector(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  strokeW: number
) {
  const dist = Math.hypot(x2 - x1, y2 - y1);
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const perpAngle = angle + Math.PI / 2;

  const segmentLength = 3.6;
  const numSegments = Math.max(2, Math.floor(dist / segmentLength));
  const amplitude = 1.8;

  ctx.beginPath();
  ctx.moveTo(x1, y1);

  for (let i = 1; i < numSegments; i++) {
    const t = i / numSegments;
    const midX = x1 + (x2 - x1) * t;
    const midY = y1 + (y2 - y1) * t;
    const offset = (i % 2 === 0 ? 1 : -1) * amplitude;

    ctx.lineTo(
      midX + offset * Math.cos(perpAngle),
      midY + offset * Math.sin(perpAngle)
    );
  }

  ctx.lineTo(x2, y2);
  ctx.stroke();

  // End arrowhead
  const headLength = Math.max(3.2, strokeW * 2.2);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - headLength * Math.cos(angle - Math.PI / 6),
    y2 - headLength * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    x2 - headLength * Math.cos(angle + Math.PI / 6),
    y2 - headLength * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
