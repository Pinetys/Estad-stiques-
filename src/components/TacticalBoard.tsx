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
  BookOpen,
  Save,
  Plus,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Layers,
  FilePlus,
  Edit3,
  Copy,
  FolderOpen,
  Shield,
  ShieldOff,
  Camera,
  Share2,
} from 'lucide-react';
import { Player } from '../types';
import {
  TacticalPlay,
  TacticalFrame,
  TacticalStroke,
  TacticalToken,
  TacticalPoint,
  DrawingType,
  CourtView,
  PlayCategory,
} from '../types/tactical';
import { DEFAULT_TACTICAL_PLAYS } from '../data/defaultTacticalPlays';
import { TacticalPlayHistoryModal } from './TacticalPlayHistoryModal';
import {
  syncTacticalPlayToCloud,
  deleteTacticalPlayFromCloud,
  fetchAllTacticalPlaysFromCloud,
} from '../lib/firebase';
import { getRegisteredTeams, getActiveTeamId } from '../utils/teamStorage';

export type { DrawingType, CourtView, TacticalPoint, TacticalStroke, TacticalToken, TacticalFrame, TacticalPlay };

const STORAGE_KEY = 'basketstats_tactical_plays_v2';

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
  { label: 'Fino', value: 0.20 },
  { label: 'Medio', value: 0.32 },
  { label: 'Grueso', value: 0.46 },
];

interface TacticalBoardProps {
  rosterPlayers?: Player[];
  teamName?: string;
  opponentName?: string;
  gameCategory?: string;
  teamId?: string;
  onClose?: () => void;
}

export const TacticalBoard: React.FC<TacticalBoardProps> = ({
  rosterPlayers = [],
  teamName = 'Nuestro Equipo',
  opponentName = 'Rival',
  gameCategory,
  teamId,
}) => {
  const courtContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Selected drawing type & styles (proporcionados y limpios para diagramación táctica)
  const [drawingType, setDrawingType] = useState<DrawingType>('corte');
  const [prevDrawingType, setPrevDrawingType] = useState<DrawingType>('corte');
  const [drawMode, setDrawMode] = useState<'freehand' | 'straight'>('freehand');
  const [inkColor, setInkColor] = useState<string>('#FACC15');
  const [strokeWidth, setStrokeWidth] = useState<number>(0.32);
  const [courtTheme, setCourtTheme] = useState<'parquet' | 'dark'>('parquet');

  // Active stroke in progress
  const activeStrokeRef = useRef<TacticalStroke | null>(null);
  const isDrawingRef = useRef<boolean>(false);
  const [draggingTokenId, setDraggingTokenId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // -------------------------------------------------------------------------
  // PLAYBOOK & MULTI-GRAPHIC SYSTEM STATE
  // -------------------------------------------------------------------------
  // All plays saved in localStorage (with legacy key fallback)
  const [plays, setPlays] = useState<TacticalPlay[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('basketstats_tactical_plays');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((p: any) => ({
            ...p,
            ageCategory: p.ageCategory?.trim() || 'Todas',
          }));
        }
      }
    } catch {}
    return DEFAULT_TACTICAL_PLAYS;
  });

  // Current play metadata
  const [currentPlayId, setCurrentPlayId] = useState<string>('play-new-1');
  const [playName, setPlayName] = useState<string>('Nueva Jugada');
  const [playCategory, setPlayCategory] = useState<PlayCategory>('ataque');
  const [playAgeCategory, setPlayAgeCategory] = useState<string>(() => {
    return gameCategory?.trim() || 'Todas';
  });
  const [playDescription, setPlayDescription] = useState<string>('');

  // Synchronize tactical plays with Firebase Cloud Firestore on mount
  useEffect(() => {
    fetchAllTacticalPlaysFromCloud()
      .then(cloudPlays => {
        if (Array.isArray(cloudPlays) && cloudPlays.length > 0) {
          setPlays(prevLocal => {
            const map = new Map<string, TacticalPlay>();
            prevLocal.forEach(p => map.set(p.id, p));
            let hasNew = false;
            cloudPlays.forEach((cp: any) => {
              if (cp && cp.id && cp.name) {
                const existing = map.get(cp.id);
                if (!existing || (cp.updatedAt && cp.updatedAt > (existing.updatedAt || 0))) {
                  map.set(cp.id, {
                    ...cp,
                    ageCategory: cp.ageCategory?.trim() || 'Todas',
                  });
                  hasNew = true;
                }
              }
            });
            if (!hasNew) return prevLocal;
            const merged = Array.from(map.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
            } catch {}
            return merged;
          });
        }
      })
      .catch(() => {});
  }, []);

  // Frames / Graphics of the current play
  const [frames, setFrames] = useState<TacticalFrame[]>([
    {
      id: 'frame-1',
      title: 'Gráfico 1: Inicio',
      notes: '',
      strokes: [],
      tokens: [...DEFAULT_OFFENSE_HALF, ...DEFAULT_DEFENSE_HALF, DEFAULT_BALL],
    },
  ]);
  const [activeFrameIndex, setActiveFrameIndex] = useState<number>(0);

  // Live strokes and tokens for the currently active frame
  const [strokes, setStrokes] = useState<TacticalStroke[]>([]);
  const [redoStack, setRedoStack] = useState<TacticalStroke[]>([]);
  const [tokens, setTokens] = useState<TacticalToken[]>([
    ...DEFAULT_OFFENSE_HALF,
    ...DEFAULT_DEFENSE_HALF,
    DEFAULT_BALL,
  ]);

  // Modal / Drawer controls
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isEditingFrameTitle, setIsEditingFrameTitle] = useState<boolean>(false);

  // Helper toast feedback
  const showToastFeedback = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => (prev === msg ? null : prev));
    }, 2800);
  }, []);

  // Save plays to localStorage
  const persistPlays = useCallback((newPlays: TacticalPlay[]) => {
    setPlays(newPlays);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newPlays));
    } catch (e) {
      console.warn('Could not save plays to localStorage', e);
    }
  }, []);

  // -------------------------------------------------------------------------
  // INITIAL ROSTER INTEGRATION
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (rosterPlayers && rosterPlayers.length > 0) {
      const courtStarters = rosterPlayers.filter(p => p.onCourt).slice(0, 5);
      const playersToUse = courtStarters.length >= 3 ? courtStarters : rosterPlayers.slice(0, 5);

      if (playersToUse.length > 0) {
        setTokens(prev => {
          // If already customized with players, keep; else map roster
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

  // -------------------------------------------------------------------------
  // CANVAS RENDERING & RESIZE
  // -------------------------------------------------------------------------
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scaleX = canvas.width / 100;
    const scaleY = canvas.height / 93.3;
    ctx.scale(scaleX, scaleY);

    strokes.forEach(stroke => {
      drawTacticalStroke(ctx, stroke);
    });

    if (activeStrokeRef.current) {
      drawTacticalStroke(ctx, activeStrokeRef.current);
    }
  }, [strokes]);

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

  // Pointer coordinate translator [0..100, 0..93.3]
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

  // Precise distance from point P to line segment A -> B
  const distanceToSegment = (p: TacticalPoint, a: TacticalPoint, b: TacticalPoint): number => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const projX = a.x + t * dx;
    const projY = a.y + t * dy;
    return Math.hypot(p.x - projX, p.y - projY);
  };

  // Precise minimum distance from point P to any segment in a stroke polyline
  const distanceToStroke = (point: TacticalPoint, stroke: TacticalStroke): number => {
    const pts = stroke.points;
    if (!pts || pts.length === 0) return Infinity;
    if (pts.length === 1) {
      return Math.hypot(point.x - pts[0].x, point.y - pts[0].y);
    }
    let minDist = Infinity;
    for (let i = 0; i < pts.length - 1; i++) {
      const d = distanceToSegment(point, pts[i], pts[i + 1]);
      if (d < minDist) minDist = d;
    }
    return minDist;
  };

  // Erase stroke by proximity: deletes the exact single line clicked or touched
  const eraseStrokeAtPoint = (point: TacticalPoint) => {
    const threshold = 3.2; // Generous hit radius in court coordinates
    setStrokes(prev => {
      let closestIdx = -1;
      let minDistance = Infinity;

      prev.forEach((stroke, idx) => {
        const d = distanceToStroke(point, stroke);
        if (d < threshold && d < minDistance) {
          minDistance = d;
          closestIdx = idx;
        }
      });

      if (closestIdx !== -1) {
        const removed = prev[closestIdx];
        setRedoStack(r => [...r, removed]);
        showToastFeedback('Línea borrada');
        return prev.filter((_, idx) => idx !== closestIdx);
      }
      return prev;
    });
  };

  // Pointer Down (Draw or Erase)
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (draggingTokenId) return;

    // Right-click always acts as quick eraser without having to switch tool
    if (e.button === 2) {
      const coords = getCourtCoordinates(e.clientX, e.clientY);
      if (coords) eraseStrokeAtPoint(coords);
      return;
    }

    const coords = getCourtCoordinates(e.clientX, e.clientY);
    if (!coords) return;

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
      points: [coords],
    };

    redrawCanvas();
  };

  // Pointer Move (Draw following mouse trajectory or Erase while dragging)
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;

    const coords = getCourtCoordinates(e.clientX, e.clientY);
    if (!coords) return;

    if (drawingType === 'borrador') {
      eraseStrokeAtPoint(coords);
      return;
    }

    if (!activeStrokeRef.current) return;

    const pts = activeStrokeRef.current.points;
    const lastPt = pts[pts.length - 1];

    if (drawMode === 'straight') {
      // Straight vector mode: connect start and current cursor
      activeStrokeRef.current.points = [pts[0], coords];
    } else {
      // Freehand drawing as if writing with the mouse ("el dibujo que yo hago con el raton, como si escribiera")
      if (!lastPt || Math.hypot(coords.x - lastPt.x, coords.y - lastPt.y) > 0.28) {
        activeStrokeRef.current.points.push(coords);
      }
    }

    redrawCanvas();
  };

  // Pointer Up (Finalize Stroke)
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

        // Keep stroke if it has multiple points or minimal motion
        if (pts.length >= 2 || dist > 0.4) {
          setStrokes(prev => [...prev, finalStroke]);
          setRedoStack([]);
        }
      }
    }

    redrawCanvas();
  };

  // Undo / Redo
  const handleUndo = useCallback(() => {
    setStrokes(prev => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setRedoStack(r => [...r, last]);
      showToastFeedback('Línea deshecha');
      return prev.slice(0, -1);
    });
  }, []);

  const handleRedo = useCallback(() => {
    setRedoStack(prev => {
      if (prev.length === 0) return prev;
      const next = prev[prev.length - 1];
      setStrokes(s => [...s, next]);
      return prev.slice(0, -1);
    });
  }, []);

  // Keyboard shortcut listener for effortless undo/redo & deleting mistaken lines
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        e.preventDefault();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        handleRedo();
        e.preventDefault();
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        handleUndo();
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  // Clear current graphic's strokes
  const handleClearBoard = () => {
    if (strokes.length === 0) return;
    setStrokes([]);
    setRedoStack([]);
    showToastFeedback('Pizarra limpiada');
  };

  // Reset player tokens
  const handleResetPositions = () => {
    setTokens([
      ...DEFAULT_OFFENSE_HALF,
      ...DEFAULT_DEFENSE_HALF,
      DEFAULT_BALL,
    ]);
    showToastFeedback('Posiciones iniciales restablecidas (5c5 con balón)');
  };

  // Defenders management (5c0, 5c5, toggle, remove individual)
  const handleRemoveAllDefenders = () => {
    setTokens(prev => prev.filter(t => t.type !== 'defense'));
    showToastFeedback('Defensores eliminados (Ataque 5 contra 0)');
  };

  const handleRestoreDefenders = () => {
    setTokens(prev => {
      const nonDefense = prev.filter(t => t.type !== 'defense');
      return [...nonDefense, ...DEFAULT_DEFENSE_HALF];
    });
    showToastFeedback('5 Defensores añadidos a la cancha');
  };

  const handleRemoveSingleToken = (tokenId: string) => {
    setTokens(prev => {
      const target = prev.find(t => t.id === tokenId);
      const name = target ? (target.type === 'defense' ? `Defensor ${target.label}` : target.label) : 'Ficha';
      showToastFeedback(`${name} eliminado`);
      return prev.filter(t => t.id !== tokenId);
    });
  };

  const handleAddDefender = () => {
    setTokens(prev => {
      const currentDefs = prev.filter(t => t.type === 'defense');
      if (currentDefs.length >= 5) {
        showToastFeedback('Ya están los 5 defensores en pista');
        return prev;
      }
      const nextIdx = currentDefs.length;
      const base = DEFAULT_DEFENSE_HALF[nextIdx] || { x: 50, y: 50 };
      const newDef: TacticalToken = {
        id: `def-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        label: `X${nextIdx + 1}`,
        type: 'defense',
        x: base.x,
        y: base.y,
      };
      showToastFeedback(`Defensor X${nextIdx + 1} añadido`);
      return [...prev, newDef];
    });
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
      showToastFeedback('Formación: 5 Abiertos aplicada');
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
      showToastFeedback('Formación: 4-Out 1-In aplicada');
    } else if (formation === 'horns') {
      setTokens(prev =>
        prev.map(t => {
          if (t.id === 'off-1') return { ...t, x: 50, y: 78 };
          if (t.id === 'off-2') return { ...t, x: 12, y: 32 };
          if (t.id === 'off-3') return { ...t, x: 88, y: 32 };
          if (t.id === 'off-4') return { ...t, x: 38, y: 46 };
          if (t.id === 'off-5') return { ...t, x: 62, y: 46 };
          if (t.id === 'ball-1') return { ...t, x: 50, y: 84 };
          return t;
        })
      );
      showToastFeedback('Formación: Cuernos (Horns) aplicada');
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
      showToastFeedback('Defensa: Zona 2-3 aplicada');
    }
  };

  // Dragging tokens (or deleting if eraser is selected)
  const handleTokenPointerDown = (tokenId: string, e: React.PointerEvent) => {
    // If eraser tool is selected, clicking any token deletes it directly!
    if (drawingType === 'borrador') {
      e.stopPropagation();
      handleRemoveSingleToken(tokenId);
      return;
    }
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

  // -------------------------------------------------------------------------
  // MULTI-GRAPHIC / FRAME MANAGEMENT
  // -------------------------------------------------------------------------

  // Switch active graphic
  const handleSwitchFrame = (targetIndex: number) => {
    if (targetIndex < 0 || targetIndex >= frames.length || targetIndex === activeFrameIndex) return;

    // First save current frame strokes and tokens
    setFrames(prevFrames => {
      const copy = [...prevFrames];
      copy[activeFrameIndex] = {
        ...copy[activeFrameIndex],
        strokes: strokes,
        tokens: tokens,
      };
      return copy;
    });

    const targetFrame = frames[targetIndex];
    setActiveFrameIndex(targetIndex);
    setStrokes(targetFrame.strokes || []);
    setTokens(targetFrame.tokens || [...DEFAULT_OFFENSE_HALF, ...DEFAULT_DEFENSE_HALF, DEFAULT_BALL]);
    setRedoStack([]);
  };

  // Add a new graphic/frame to the play
  const handleAddFrame = (mode: 'transition' | 'clean' | 'duplicate' = 'transition') => {
    // 1. Commit active frame
    const currentUpdatedFrames = [...frames];
    currentUpdatedFrames[activeFrameIndex] = {
      ...currentUpdatedFrames[activeFrameIndex],
      strokes: strokes,
      tokens: tokens,
    };

    const newIndex = currentUpdatedFrames.length;
    const newFrameId = `frame-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

    let newTokens: TacticalToken[];
    let newStrokes: TacticalStroke[];

    if (mode === 'duplicate') {
      newTokens = tokens.map(t => ({ ...t }));
      newStrokes = strokes.map(s => ({ ...s, id: `s-${Date.now()}-${Math.random().toString(36).substr(2, 4)}` }));
    } else if (mode === 'clean') {
      newTokens = [...DEFAULT_OFFENSE_HALF, ...DEFAULT_DEFENSE_HALF, DEFAULT_BALL];
      newStrokes = [];
    } else {
      // Transition: keep token positions from current frame (natural basketball continuity) + clean drawing
      newTokens = tokens.map(t => ({ ...t }));
      newStrokes = [];
    }

    const newFrame: TacticalFrame = {
      id: newFrameId,
      title: `Gráfico ${newIndex + 1}`,
      notes: '',
      tokens: newTokens,
      strokes: newStrokes,
    };

    const nextFrames = [...currentUpdatedFrames, newFrame];
    setFrames(nextFrames);
    setActiveFrameIndex(newIndex);
    setTokens(newTokens);
    setStrokes(newStrokes);
    setRedoStack([]);

    showToastFeedback(`Gráfico ${newIndex + 1} añadido a "${playName}"`);
  };

  // Delete a graphic/frame
  const handleDeleteFrame = (indexToDelete: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (frames.length <= 1) {
      showToastFeedback('La jugada debe tener al menos un gráfico');
      return;
    }

    const nextFrames = frames.filter((_, idx) => idx !== indexToDelete);
    let nextIndex = activeFrameIndex;
    if (indexToDelete === activeFrameIndex) {
      nextIndex = Math.max(0, indexToDelete - 1);
    } else if (indexToDelete < activeFrameIndex) {
      nextIndex = activeFrameIndex - 1;
    }

    setFrames(nextFrames);
    setActiveFrameIndex(nextIndex);
    const target = nextFrames[nextIndex];
    setTokens(target.tokens || [...DEFAULT_OFFENSE_HALF, ...DEFAULT_DEFENSE_HALF, DEFAULT_BALL]);
    setStrokes(target.strokes || []);
    setRedoStack([]);
    showToastFeedback(`Gráfico eliminado (${nextFrames.length} restantes)`);
  };

  // Update current graphic's title or notes
  const handleUpdateFrameTitle = (newTitle: string) => {
    setFrames(prev => {
      const copy = [...prev];
      copy[activeFrameIndex] = {
        ...copy[activeFrameIndex],
        title: newTitle,
      };
      return copy;
    });
  };

  // -------------------------------------------------------------------------
  // PLAYBACK / ANIMATION STEPPER
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!isPlaying) return;
    if (frames.length <= 1) {
      setIsPlaying(false);
      return;
    }

    const interval = setInterval(() => {
      setActiveFrameIndex(prevIdx => {
        const nextIdx = (prevIdx + 1) % frames.length;
        const targetFrame = frames[nextIdx];
        if (targetFrame) {
          setTokens(targetFrame.tokens);
          setStrokes(targetFrame.strokes);
          setRedoStack([]);
        }
        return nextIdx;
      });
    }, 2400);

    return () => clearInterval(interval);
  }, [isPlaying, frames]);

  // -------------------------------------------------------------------------
  // SAVE & LOAD PLAYS (PLAYBOOK LIBRARY)
  // -------------------------------------------------------------------------
  // Save current play
  const handleSavePlay = () => {
    const trimmedName = playName.trim() || 'Jugada sin título';

    // Sync active frame into frames list
    const currentUpdatedFrames = [...frames];
    currentUpdatedFrames[activeFrameIndex] = {
      ...currentUpdatedFrames[activeFrameIndex],
      strokes: strokes,
      tokens: tokens,
    };

    const targetPlayId = currentPlayId.startsWith('play-new-')
      ? `play-${Date.now()}`
      : currentPlayId;

    const existingPlay = plays.find(p => p.id === targetPlayId);
    const resolvedAgeCategory = playAgeCategory?.trim() || 'Todas';

    const playToSave: TacticalPlay = {
      id: targetPlayId,
      name: trimmedName,
      category: playCategory,
      ageCategory: resolvedAgeCategory,
      teamId: teamId || undefined,
      description: playDescription,
      frames: currentUpdatedFrames,
      createdAt: existingPlay?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    const existsIndex = plays.findIndex(p => p.id === targetPlayId);
    let updatedPlaysList: TacticalPlay[];
    if (existsIndex >= 0) {
      updatedPlaysList = [...plays];
      updatedPlaysList[existsIndex] = playToSave;
    } else {
      updatedPlaysList = [playToSave, ...plays];
    }

    setCurrentPlayId(targetPlayId);
    setFrames(currentUpdatedFrames);
    persistPlays(updatedPlaysList);

    // Sync to Cloud Firestore in the background
    syncTacticalPlayToCloud(playToSave).catch(() => {});

    showToastFeedback(
      resolvedAgeCategory === 'Todas'
        ? `¡Jugada "${trimmedName}" guardada en ${playCategory.toUpperCase()} (Universal para todos los partidos)!`
        : `¡Jugada "${trimmedName}" guardada en ${playCategory.toUpperCase()} (${resolvedAgeCategory})!`
    );
  };

  // Start fresh new play
  const handleNewPlay = () => {
    const newId = `play-new-${Date.now()}`;
    setCurrentPlayId(newId);
    setPlayName('Nueva Jugada');
    setPlayCategory('ataque');
    setPlayAgeCategory(gameCategory?.trim() || 'Todas');
    setPlayDescription('');

    const initialTokens = [...DEFAULT_OFFENSE_HALF, ...DEFAULT_DEFENSE_HALF, DEFAULT_BALL];
    const initialFrames: TacticalFrame[] = [
      {
        id: `frame-${Date.now()}`,
        title: 'Gráfico 1: Inicio',
        notes: '',
        strokes: [],
        tokens: initialTokens,
      },
    ];

    setFrames(initialFrames);
    setActiveFrameIndex(0);
    setTokens(initialTokens);
    setStrokes([]);
    setRedoStack([]);
    showToastFeedback('Nueva jugada creada. Dibuja y añade los gráficos necesarios.');
  };

  // Load play from history modal
  const handleSelectPlayFromHistory = (selectedPlay: TacticalPlay) => {
    setCurrentPlayId(selectedPlay.id);
    setPlayName(selectedPlay.name);
    setPlayCategory(selectedPlay.category || 'ataque');
    setPlayAgeCategory(selectedPlay.ageCategory?.trim() || 'Todas');
    setPlayDescription(selectedPlay.description || '');

    const validFrames =
      selectedPlay.frames && selectedPlay.frames.length > 0
        ? selectedPlay.frames
        : [
            {
              id: 'frame-1',
              title: 'Gráfico 1: Inicio',
              notes: '',
              strokes: [],
              tokens: [...DEFAULT_OFFENSE_HALF, ...DEFAULT_DEFENSE_HALF, DEFAULT_BALL],
            },
          ];

    setFrames(validFrames);
    setActiveFrameIndex(0);
    setTokens(validFrames[0].tokens || [...DEFAULT_OFFENSE_HALF, ...DEFAULT_DEFENSE_HALF, DEFAULT_BALL]);
    setStrokes(validFrames[0].strokes || []);
    setRedoStack([]);
    showToastFeedback(`Jugada "${selectedPlay.name}" cargada con ${validFrames.length} gráfico(s)`);
  };

  // Delete play from history modal
  const handleDeletePlayFromHistory = (playIdToDelete: string) => {
    const updated = plays.filter(p => p.id !== playIdToDelete);
    persistPlays(updated);
    deleteTacticalPlayFromCloud(playIdToDelete).catch(() => {});

    if (currentPlayId === playIdToDelete) {
      handleNewPlay();
    }
    showToastFeedback('Jugada eliminada del historial');
  };

  // Duplicate play from history modal
  const handleDuplicatePlayFromHistory = (playToDuplicate: TacticalPlay) => {
    const duplicate: TacticalPlay = {
      ...playToDuplicate,
      id: `play-${Date.now()}`,
      name: `Copia de ${playToDuplicate.name}`,
      category: playToDuplicate.category,
      ageCategory: playToDuplicate.ageCategory || 'Todas',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      frames: playToDuplicate.frames.map((f, i) => ({
        ...f,
        id: `f-${Date.now()}-${i}`,
        tokens: f.tokens.map(t => ({ ...t })),
        strokes: f.strokes.map(s => ({ ...s })),
      })),
    };

    const updated = [duplicate, ...plays];
    persistPlays(updated);
    syncTacticalPlayToCloud(duplicate).catch(() => {});
    showToastFeedback(`Copia creada: "${duplicate.name}"`);
  };

  // Reset default plays
  const handleResetDefaultPlays = () => {
    persistPlays(DEFAULT_TACTICAL_PLAYS);
    DEFAULT_TACTICAL_PLAYS.forEach(p => syncTacticalPlayToCloud(p).catch(() => {}));
    showToastFeedback('Jugadas de muestra restauradas');
  };

  // Import plays
  const handleImportPlays = (imported: TacticalPlay[]) => {
    const updated = [...imported, ...plays];
    persistPlays(updated);
    imported.forEach(p => syncTacticalPlayToCloud(p).catch(() => {}));
  };

  // -------------------------------------------------------------------------
  // EXPORT CURRENT GRAPHIC OR PLAY AS PNG
  // -------------------------------------------------------------------------
  const handleExportImage = () => {
    const container = courtContainerRef.current;
    if (!container || isExporting) return;

    setIsExporting(true);
    showToastFeedback('Capturando diseño de la cancha...');

    const exportCanvas = document.createElement('canvas');
    // High-resolution canvas (1600px width) for ultra-sharp tactical diagrams
    const width = 1600;
    const height = Math.round((1600 * 93.3) / 100);
    exportCanvas.width = width;
    exportCanvas.height = height;

    const ctx = exportCanvas.getContext('2d');
    if (!ctx) {
      setIsExporting(false);
      return;
    }

    const svgElement = container.querySelector('svg');
    if (!svgElement) {
      setIsExporting(false);
      return;
    }

    // Solid court base color to prevent transparency issues
    ctx.fillStyle = courtTheme === 'parquet' ? '#c9975a' : '#141720';
    ctx.fillRect(0, 0, width, height);

    const svgString = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const blobURL = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(blobURL);

      // 1. Draw all tactical strokes (freehand, cuts, passes, screens, shots, dribbles)
      ctx.save();
      const scaleX = width / 100;
      const scaleY = height / 93.3;
      ctx.scale(scaleX, scaleY);
      strokes.forEach(stroke => {
        drawTacticalStroke(ctx, stroke);
      });
      ctx.restore();

      // 2. Draw all player and ball tokens
      tokens.forEach(token => {
        const px = (token.x / 100) * width;
        const py = (token.y / 93.3) * height;
        const radius = token.type === 'ball' ? 12 : 32;

        ctx.save();
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);

        if (token.type === 'offense') {
          // Offense player circle with gradient
          const grad = ctx.createLinearGradient(px - radius, py - radius, px + radius, py + radius);
          grad.addColorStop(0, '#F97316');
          grad.addColorStop(1, '#D97706');
          ctx.fillStyle = grad;
          ctx.fill();
          ctx.lineWidth = 4;
          ctx.strokeStyle = '#FFFFFF';
          ctx.stroke();

          // Dorsal / label
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 24px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(token.label, px, py);

          // Player name badge underneath (crucial for sharing strategy with team members)
          if (token.playerName) {
            const shortName = token.playerName.split(' ')[0];
            ctx.save();
            ctx.font = 'bold 15px system-ui, sans-serif';
            const m = ctx.measureText(shortName);
            const badgeW = m.width + 16;
            const badgeH = 22;
            const badgeY = py + radius + 5;
            ctx.fillStyle = 'rgba(10, 15, 30, 0.9)';
            ctx.beginPath();
            ctx.roundRect(px - badgeW / 2, badgeY, badgeW, badgeH, 6);
            ctx.fill();
            ctx.strokeStyle = 'rgba(249, 115, 22, 0.7)';
            ctx.lineWidth = 1.2;
            ctx.stroke();

            ctx.fillStyle = '#FFFFFF';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(shortName, px, badgeY + badgeH / 2);
            ctx.restore();
          }
        } else if (token.type === 'defense') {
          // Defense player circle
          const grad = ctx.createLinearGradient(px - radius, py - radius, px + radius, py + radius);
          grad.addColorStop(0, '#2563EB');
          grad.addColorStop(1, '#1D4ED8');
          ctx.fillStyle = grad;
          ctx.fill();
          ctx.lineWidth = 4;
          ctx.strokeStyle = '#FFFFFF';
          ctx.stroke();

          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 22px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(token.label, px, py);
        } else if (token.type === 'ball') {
          // Basketball with realistic seams
          const ballRadius = 11;
          ctx.beginPath();
          ctx.arc(px, py, ballRadius, 0, Math.PI * 2);
          ctx.fillStyle = '#EA580C';
          ctx.fill();
          ctx.lineWidth = 1.4;
          ctx.strokeStyle = '#FFFFFF';
          ctx.stroke();

          ctx.strokeStyle = '#7C2D12';
          ctx.lineWidth = 1.0;
          ctx.beginPath();
          ctx.moveTo(px, py - ballRadius);
          ctx.lineTo(px, py + ballRadius);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(px - ballRadius, py);
          ctx.lineTo(px + ballRadius, py);
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(px - ballRadius * 0.7, py, ballRadius * 0.8, -Math.PI * 0.35, Math.PI * 0.35);
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(px + ballRadius * 0.7, py, ballRadius * 0.8, Math.PI * 0.65, Math.PI * 1.35);
          ctx.stroke();
        } else if (token.type === 'cone') {
          ctx.fillStyle = '#F59E0B';
          ctx.beginPath();
          ctx.moveTo(px, py - radius * 0.8);
          ctx.lineTo(px - radius * 0.7, py + radius * 0.7);
          ctx.lineTo(px + radius * 0.7, py + radius * 0.7);
          ctx.closePath();
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#FFFFFF';
          ctx.stroke();
        }
        ctx.restore();
      });

      // 3. Strategy Header Card / Watermark on top-left of image
      ctx.save();
      const cardW = 540;
      const cardH = 92;
      ctx.fillStyle = 'rgba(7, 12, 30, 0.94)';
      ctx.beginPath();
      ctx.roundRect(20, 20, cardW, cardH, 12);
      ctx.fill();
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Title
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const cleanTitle = playName.length > 28 ? playName.substring(0, 26) + '...' : playName;
      ctx.fillText(cleanTitle.toUpperCase(), 36, 32);

      // Step & Frame details
      ctx.fillStyle = '#FBBF24';
      ctx.font = 'bold 15px system-ui, sans-serif';
      const frameTitle = frames[activeFrameIndex]?.title || `Gráfico ${activeFrameIndex + 1}`;
      ctx.fillText(
        `${frameTitle} • Paso ${activeFrameIndex + 1}/${frames.length}`,
        36,
        60
      );

      // Team & Category footer
      ctx.fillStyle = '#94A3B8';
      ctx.font = '13px system-ui, sans-serif';
      const catBadge = playCategory.toUpperCase();
      const ageBadge = playAgeCategory && playAgeCategory !== 'Todas' ? ` [${playAgeCategory}]` : '';
      ctx.fillText(`${teamName} • ${catBadge}${ageBadge} • BasketStats PRO`, 36, 82);
      ctx.restore();

      // 4. Tactical Notes Badge (if current frame or play has instructions)
      const currentNotes = frames[activeFrameIndex]?.notes?.trim() || playDescription?.trim();
      if (currentNotes) {
        ctx.save();
        const notesW = Math.min(width - 40, 800);
        const notesH = 64;
        const notesY = height - notesH - 20;
        ctx.fillStyle = 'rgba(7, 12, 30, 0.94)';
        ctx.beginPath();
        ctx.roundRect(20, notesY, notesW, notesH, 10);
        ctx.fill();
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#38BDF8';
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('📋 INSTRUCCIONES TÁCTICAS:', 36, notesY + 12);

        ctx.fillStyle = '#F1F5F9';
        ctx.font = '14px system-ui, sans-serif';
        const displayNotes = currentNotes.length > 95 ? currentNotes.substring(0, 92) + '...' : currentNotes;
        ctx.fillText(displayNotes, 36, notesY + 34);
        ctx.restore();
      }

      // 5. Generate PNG file & trigger download / Web Share
      exportCanvas.toBlob(async blob => {
        setIsExporting(false);
        if (!blob) return;

        const cleanFileName = playName.toLowerCase().replace(/[^a-z0-9]/gi, '_');
        const fileName = `Estrategia_${cleanFileName}_grafico_${activeFrameIndex + 1}.png`;

        // Direct browser download
        const dataUrl = exportCanvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = fileName;
        a.click();

        // Native share if supported on mobile/tablet
        const file = new File([blob], fileName, { type: 'image/png' });
        if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              title: `Estrategia: ${playName}`,
              text: `Pizarra Táctica: ${playName} - ${frames[activeFrameIndex]?.title || `Gráfico ${activeFrameIndex + 1}`}`,
              files: [file],
            });
          } catch {}
        }

        showToastFeedback('📸 Cancha capturada: Imagen PNG descargada para compartir');
      }, 'image/png');
    };

    img.onerror = () => {
      setIsExporting(false);
      showToastFeedback('Error al exportar la imagen de la cancha');
    };

    img.src = blobURL;
  };

  const activeOption = DRAWING_OPTIONS.find(o => o.id === drawingType) || DRAWING_OPTIONS[0];

  return (
    <div className="flex flex-col h-full w-full bg-[#070c1e] text-slate-100 select-none overflow-hidden relative">
      {/* Toast feedback banner */}
      {toastMessage && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-slate-950 font-black text-xs px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2 border border-amber-300 animate-in fade-in slide-in-from-top-2 duration-150">
          <Check className="w-4 h-4 stroke-[3]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 1. TOP BAR: PLAY NAME & PLAYBOOK HISTORY CONTROLS */}
      {/* ----------------------------------------------------------------- */}
      <div className="bg-gradient-to-r from-[#0c1633] via-[#0f1f4b] to-[#0c1633] border-b border-blue-900/70 px-2.5 sm:px-4 py-1.5 flex flex-wrap items-center justify-between gap-2 shrink-0 z-30 shadow-md">
        {/* Left: Play Name input and Category Selectors */}
        <div className="flex items-center gap-2 flex-1 min-w-[280px] flex-wrap sm:flex-nowrap">
          <div className="relative flex-1 min-w-[170px] max-w-sm sm:max-w-md">
            <label htmlFor="play-name-input" className="sr-only">
              Nombre de la jugada
            </label>
            <div className="relative flex items-center">
              <input
                id="play-name-input"
                type="text"
                value={playName}
                onChange={e => setPlayName(e.target.value)}
                placeholder="Nombre de la jugada (ej. Cuernos Salida 2)..."
                className="w-full bg-[#091129] hover:bg-[#0d183a] focus:bg-[#0d183a] text-white font-black text-xs sm:text-sm pl-7 pr-3 py-1.5 rounded-xl border border-amber-500/70 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 transition placeholder-slate-400"
              />
              <span className="absolute left-2.5 text-amber-400 text-xs pointer-events-none">
                🏷️
              </span>
            </div>
          </div>

          {/* Tactical Category Dropdown */}
          <select
            value={playCategory}
            onChange={e => setPlayCategory(e.target.value as PlayCategory)}
            className="bg-[#091129] text-amber-300 font-bold text-xs px-2.5 py-1.5 rounded-xl border border-blue-800/80 focus:outline-none focus:border-amber-400 cursor-pointer"
            title="Categoría táctica de la jugada"
          >
            <option value="ataque">⚡ Ataque</option>
            <option value="defensa">🛡️ Defensa</option>
            <option value="fondo">📐 Saque Fondo</option>
            <option value="banda">📏 Saque Banda</option>
            <option value="transicion">🏃 Transición</option>
            <option value="especial">⏱️ Especial / ATO</option>
          </select>

          {/* Age / Team Category Selector */}
          <div className="flex items-center gap-1.5">
            <select
              value={
                playAgeCategory === 'Todas' || playAgeCategory === 'all'
                  ? 'Todas'
                  : ['Senior', 'Junior', 'Cadete', 'Infantil', 'Pre-Infantil', 'Minibasket', 'Escola', gameCategory].filter(Boolean).includes(playAgeCategory)
                  ? playAgeCategory
                  : 'custom'
              }
              onChange={e => {
                const val = e.target.value;
                if (val === 'custom') {
                  const custom = prompt('Escribe el nombre de la categoría para esta jugada:', playAgeCategory !== 'Todas' ? playAgeCategory : '');
                  if (custom && custom.trim()) {
                    setPlayAgeCategory(custom.trim());
                  }
                } else {
                  setPlayAgeCategory(val);
                }
              }}
              className="bg-[#091129] text-purple-300 font-bold text-xs px-2.5 py-1.5 rounded-xl border border-purple-800/60 focus:outline-none focus:border-purple-400 cursor-pointer"
              title="Categoría de equipo o ámbito (Universal para todos los partidos o por categoría)"
            >
              <option value="Todas">🌐 Universal (Todos los partidos)</option>
              {gameCategory && gameCategory.trim() && gameCategory.trim() !== 'Todas' && (
                <option value={gameCategory.trim()}>
                  🏀 {gameCategory.trim()} (Partido actual)
                </option>
              )}
              <option value="Senior">🏀 Senior</option>
              <option value="Junior">🏀 Junior</option>
              <option value="Cadete">🏀 Cadete</option>
              <option value="Infantil">🏀 Infantil</option>
              <option value="Pre-Infantil">🏀 Pre-Infantil</option>
              <option value="Minibasket">🏀 Minibasket / Escola</option>
              {playAgeCategory &&
                !['Todas', 'all', 'Senior', 'Junior', 'Cadete', 'Infantil', 'Pre-Infantil', 'Minibasket', 'Escola', gameCategory].includes(playAgeCategory) && (
                  <option value={playAgeCategory}>✏️ {playAgeCategory}</option>
                )}
              <option value="custom">✏️ Otra categoría...</option>
            </select>

            {playAgeCategory === 'Todas' ? (
              <span
                className="hidden xl:inline-flex text-[10px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-lg whitespace-nowrap"
                title="Esta jugada se guardará para todas las categorías y siempre saldrá en todos los partidos nuevos"
              >
                🌐 Siempre en partidos nuevos
              </span>
            ) : (
              <span className="hidden xl:inline-flex text-[10px] font-bold text-purple-300 bg-purple-950/60 border border-purple-800/60 px-2 py-0.5 rounded-lg whitespace-nowrap">
                🏀 {playAgeCategory}
              </span>
            )}
          </div>
        </div>

        {/* Right: Save Play, New Play, Capture PNG, & Open History Button */}
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={handleExportImage}
            disabled={isExporting}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-black text-xs flex items-center gap-1.5 transition shadow-sm active:scale-95 border border-emerald-400/40 disabled:opacity-50 cursor-pointer"
            title="Capturar diseño actual de la cancha como imagen PNG descargable para compartir la estrategia con el equipo"
          >
            <Camera className="w-3.5 h-3.5 stroke-[2.2]" />
            <span className="hidden sm:inline">Capturar Cancha (PNG)</span>
            <span className="sm:hidden">Capturar PNG</span>
          </button>

          <button
            type="button"
            onClick={handleSavePlay}
            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 transition shadow-sm active:scale-95"
            title="Guardar jugada grabada por categoría (se mantendrá en todos los partidos)"
          >
            <Save className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Guardar Jugada</span>
          </button>

          <button
            type="button"
            onClick={handleNewPlay}
            className="px-2.5 py-1.5 rounded-xl bg-blue-950/80 hover:bg-blue-900 text-slate-200 border border-blue-800/70 font-bold text-xs flex items-center gap-1 transition"
            title="Empezar una nueva jugada en blanco"
          >
            <FilePlus className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden xs:inline">Nueva</span>
          </button>

          {/* Historial de Jugadas Button */}
          <button
            type="button"
            onClick={() => setShowHistoryModal(true)}
            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs flex items-center gap-1.5 transition shadow-md active:scale-95"
            title="Ver biblioteca e historial de jugadas guardadas por categoría"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Historial ({plays.length})</span>
          </button>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 2. SECONDARY BAR: DRAWING TOOLS, PALETTES & ACTIONS */}
      {/* ----------------------------------------------------------------- */}
      <div className="bg-[#091129] border-b border-blue-900/60 px-2 sm:px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 shrink-0 z-20">
        {/* Left: Tool dropdown, Freehand/Straight mode, and Quick Eraser Button */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Tool Selector Dropdown */}
          <div className="relative">
            <select
              id="tactical-drawing-type-select"
              value={drawingType}
              onChange={e => {
                const val = e.target.value as DrawingType;
                setDrawingType(val);
                if (val !== 'borrador') setPrevDrawingType(val);
              }}
              className="appearance-none bg-[#0a1638] hover:bg-[#0f2154] text-white font-black text-xs pl-7 pr-7 py-1.5 rounded-xl border border-amber-500/80 focus:border-amber-400 focus:outline-none transition cursor-pointer shadow-xs min-w-[160px]"
            >
              {DRAWING_OPTIONS.map(opt => (
                <option key={opt.id} value={opt.id} className="bg-[#0a1638] text-white py-1">
                  {opt.icon} {opt.label} ({opt.badge})
                </option>
              ))}
            </select>
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm pointer-events-none text-amber-400">
              {activeOption.icon}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-amber-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Dedicated Eraser (Goma de Borrar) Button */}
          <button
            type="button"
            onClick={() => {
              if (drawingType === 'borrador') {
                setDrawingType(prevDrawingType || 'corte');
              } else {
                setPrevDrawingType(drawingType);
                setDrawingType('borrador');
              }
            }}
            className={`px-2.5 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition shadow-xs active:scale-95 border ${
              drawingType === 'borrador'
                ? 'bg-rose-500 hover:bg-rose-600 text-white border-rose-300 ring-2 ring-rose-300/80 shadow-rose-950/60 animate-pulse'
                : 'bg-rose-950/40 hover:bg-rose-950/80 text-rose-300 border-rose-800/60'
            }`}
            title={
              drawingType === 'borrador'
                ? 'Borrador ACTIVO: haz clic en cualquier línea para borrarla (o pulsa de nuevo para salir)'
                : 'Goma de borrar: haz clic para eliminar líneas individuales'
            }
          >
            <Eraser className="w-3.5 h-3.5 stroke-[2.4]" />
            <span>{drawingType === 'borrador' ? 'Borrando...' : 'Borrador'}</span>
          </button>

          {/* Freehand vs Straight Mode Toggle ("hagas el dibujo que yo hago con el raton. como si escribiera") */}
          <div
            className="flex items-center bg-[#060c1e] p-0.5 rounded-xl border border-blue-900/60"
            title="Modo de trazo: Mano alzada con el ratón (como escribir) o Línea recta"
          >
            <button
              type="button"
              onClick={() => setDrawMode('freehand')}
              className={`px-2 py-1 rounded-lg text-xs font-black flex items-center gap-1 transition ${
                drawMode === 'freehand'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Mano alzada: Dibuja libremente siguiendo tu mano/ratón como si escribieras"
            >
              <span>✍️</span>
              <span className="hidden sm:inline">Mano alzada</span>
            </button>
            <button
              type="button"
              onClick={() => setDrawMode('straight')}
              className={`px-2 py-1 rounded-lg text-xs font-black flex items-center gap-1 transition ${
                drawMode === 'straight'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Línea recta: Dibuja vectores directos entre punto inicial y final"
            >
              <span>📏</span>
              <span className="hidden sm:inline">Recta</span>
            </button>
          </div>
        </div>

        {/* Center: Ink Colors & Stroke Width */}
        <div className="flex items-center gap-1.5 bg-[#060c1e] p-1 rounded-xl border border-blue-900/60">
          <Palette className="w-3 h-3 text-slate-400 ml-0.5 shrink-0 hidden xs:inline" />
          <div className="flex items-center gap-1">
            {INK_COLORS.map(c => (
              <button
                key={c.value}
                type="button"
                onClick={() => setInkColor(c.value)}
                className={`w-5 h-5 rounded-full transition-transform flex items-center justify-center ${
                  inkColor === c.value
                    ? 'ring-2 ring-white scale-110 shadow-xs'
                    : 'opacity-85 hover:opacity-100 hover:scale-105'
                }`}
                style={{ backgroundColor: c.value }}
                title={`Color: ${c.name}`}
              >
                {inkColor === c.value && (
                  <Check
                    className={`w-2.5 h-2.5 ${
                      c.value === '#FFFFFF' || c.value === '#FACC15' ? 'text-black' : 'text-white'
                    }`}
                  />
                )}
              </button>
            ))}
          </div>

          <div className="h-3.5 w-px bg-blue-900 mx-0.5" />

          {/* Stroke Width Toggle */}
          <div className="flex items-center gap-1 bg-black/40 px-1.5 py-0.5 rounded-lg border border-blue-900/60" title="Grosor de trazo proporcionado">
            {STROKE_WIDTHS.map(sw => {
              const isSelected = strokeWidth === sw.value;
              const barHeight = sw.value <= 0.25 ? 'h-[1.5px]' : sw.value <= 0.35 ? 'h-[2.5px]' : 'h-[4px]';
              return (
                <button
                  key={sw.value}
                  type="button"
                  onClick={() => setStrokeWidth(sw.value)}
                  className={`flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono rounded transition ${
                    isSelected
                      ? 'bg-blue-600 text-white font-bold shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                  title={`Trazo ${sw.label} proporcionado`}
                >
                  <span className={`w-2.5 ${barHeight} bg-current rounded-full inline-block`} />
                  <span className="hidden sm:inline">{sw.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Undo, Redo, Clear, Export PNG */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleUndo}
            disabled={strokes.length === 0}
            className="px-2 py-1.5 rounded-xl bg-blue-950/90 hover:bg-blue-900 text-slate-200 border border-blue-800/70 disabled:opacity-30 transition flex items-center gap-1 text-xs font-bold"
            title="Deshacer última línea (Ctrl+Z o Backspace)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Deshacer</span>
          </button>

          <button
            type="button"
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className="p-1.5 rounded-xl bg-blue-950/80 hover:bg-blue-900 text-slate-200 border border-blue-800/60 disabled:opacity-30 transition"
            title="Rehacer trazo (Ctrl+Y)"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleClearBoard}
            disabled={strokes.length === 0}
            className="px-2 py-1 rounded-xl bg-rose-950/70 hover:bg-rose-900 text-rose-300 border border-rose-800/60 disabled:opacity-30 text-xs font-bold transition flex items-center gap-1"
            title="Limpiar todas las líneas del gráfico actual"
          >
            <Trash2 className="w-3 h-3 text-rose-400" />
            <span className="hidden xs:inline">Limpiar</span>
          </button>

          <button
            type="button"
            onClick={handleExportImage}
            disabled={isExporting}
            className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition flex items-center gap-1.5 shadow-xs border border-emerald-400/30 active:scale-95 disabled:opacity-50 cursor-pointer"
            title="Capturar y descargar diseño actual de la cancha en imagen PNG para compartir con el equipo"
          >
            <Camera className="w-3.5 h-3.5 stroke-[2.2]" />
            <span className="hidden sm:inline">Capturar PNG</span>
            <span className="sm:hidden">PNG</span>
          </button>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 3. MULTI-GRAPHICS STEPPER BAR: ADD/SWITCH/ANIMATE GRAPHICS */}
      {/* ----------------------------------------------------------------- */}
      <div className="bg-[#0b142e] border-b border-blue-950 px-2 sm:px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 shrink-0 z-10 text-xs">
        {/* Left: Graphic Tabs & Add Graphic Button */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-x-auto scrollbar-none py-0.5">
          <div className="flex items-center gap-1 text-[11px] font-mono text-amber-400 font-extrabold shrink-0 mr-1">
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Gráficos:</span>
          </div>

          {/* Frame Buttons */}
          <div className="flex items-center gap-1 shrink-0">
            {frames.map((frame, idx) => {
              const isActive = idx === activeFrameIndex;
              return (
                <div
                  key={frame.id || idx}
                  className={`group relative flex items-center rounded-lg transition-all ${
                    isActive
                      ? 'bg-amber-500 text-slate-950 font-black shadow-sm ring-1 ring-amber-300'
                      : 'bg-blue-950/80 hover:bg-blue-900 text-slate-200 border border-blue-900/60 font-semibold'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleSwitchFrame(idx)}
                    className="px-2.5 py-1 text-xs flex items-center gap-1 truncate max-w-[130px]"
                    title={`Ver ${frame.title || `Gráfico ${idx + 1}`}`}
                  >
                    <span>{idx + 1}.</span>
                    <span className="truncate">{frame.title || `Gráfico ${idx + 1}`}</span>
                  </button>

                  {/* Delete Frame if > 1 frame */}
                  {frames.length > 1 && (
                    <button
                      type="button"
                      onClick={e => handleDeleteFrame(idx, e)}
                      className={`p-1 pr-1.5 rounded-r-lg transition opacity-60 hover:opacity-100 ${
                        isActive ? 'hover:bg-amber-600 text-slate-950' : 'hover:bg-rose-900 text-rose-300'
                      }`}
                      title={`Eliminar Gráfico ${idx + 1}`}
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add Frame Button */}
          <button
            type="button"
            onClick={() => handleAddFrame('transition')}
            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 transition shadow-xs shrink-0 active:scale-95"
            title="Añadir un nuevo gráfico a la jugada (las fichas inician donde quedaron en el gráfico anterior)"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Añadir Gráfico</span>
          </button>
        </div>

        {/* Right: Stepper Navigation (Previous, Next, Playback) & Formations */}
        <div className="flex items-center gap-1.5 shrink-0 text-xs">
          {/* Frame Step Controls */}
          <div className="flex items-center bg-[#060c1e] p-0.5 rounded-lg border border-blue-900/60">
            <button
              type="button"
              onClick={() => handleSwitchFrame(activeFrameIndex - 1)}
              disabled={activeFrameIndex === 0}
              className="p-1 rounded text-slate-300 hover:text-white disabled:opacity-30 transition"
              title="Gráfico anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-1.5 text-[11px] font-mono font-bold text-slate-300">
              {activeFrameIndex + 1}/{frames.length}
            </span>

            <button
              type="button"
              onClick={() => handleSwitchFrame(activeFrameIndex + 1)}
              disabled={activeFrameIndex === frames.length - 1}
              className="p-1 rounded text-slate-300 hover:text-white disabled:opacity-30 transition"
              title="Gráfico siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Play/Pause Sequence Animation */}
            {frames.length > 1 && (
              <button
                type="button"
                onClick={() => setIsPlaying(prev => !prev)}
                className={`p-1 rounded ml-1 transition ${
                  isPlaying
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-blue-900/80 hover:bg-blue-800 text-cyan-300'
                }`}
                title={isPlaying ? 'Pausar reproducción' : 'Reproducir secuencia de gráficos paso a paso'}
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>

          {/* Defenders & Formations Controls */}
          <div className="flex items-center gap-1 flex-wrap">
            {/* Toggle / Remove Defenders Button */}
            {tokens.some(t => t.type === 'defense') ? (
              <button
                type="button"
                onClick={handleRemoveAllDefenders}
                className="px-2 py-1 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/70 text-[11px] font-mono font-bold flex items-center gap-1 transition shadow-xs active:scale-95"
                title="Eliminar todos los defensores de la pizarra para diagramar ataque 5 contra 0"
              >
                <ShieldOff className="w-3.5 h-3.5 text-rose-400 stroke-[2.2]" />
                <span>Quitar Defensores ({tokens.filter(t => t.type === 'defense').length})</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRestoreDefenders}
                className="px-2 py-1 rounded-lg bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-800/70 text-[11px] font-mono font-bold flex items-center gap-1 transition shadow-xs active:scale-95"
                title="Añadir los 5 defensores a la pizarra (defensa 5 contra 5)"
              >
                <Shield className="w-3.5 h-3.5 text-indigo-400 stroke-[2.2]" />
                <span>+ Poner Defensores</span>
              </button>
            )}

            {/* Quick button to add 1 defender if 1..4 present */}
            {tokens.filter(t => t.type === 'defense').length > 0 &&
              tokens.filter(t => t.type === 'defense').length < 5 && (
                <button
                  type="button"
                  onClick={handleAddDefender}
                  className="px-1.5 py-1 rounded-lg bg-blue-950/80 hover:bg-blue-900 text-cyan-300 border border-blue-800/60 text-[11px] font-mono font-bold transition active:scale-95"
                  title="Añadir 1 defensor más a la pizarra"
                >
                  + Def
                </button>
              )}

            <div className="hidden md:flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleApplyFormation('5out')}
                className="px-2 py-0.5 rounded bg-blue-950/80 hover:bg-blue-900 text-cyan-300 border border-blue-800/60 text-[11px] font-mono"
                title="5 Abiertos"
              >
                5 Out
              </button>
              <button
                type="button"
                onClick={() => handleApplyFormation('horns')}
                className="px-2 py-0.5 rounded bg-blue-950/80 hover:bg-blue-900 text-cyan-300 border border-blue-800/60 text-[11px] font-mono"
                title="Cuernos"
              >
                Horns
              </button>
              <button
                type="button"
                onClick={handleResetPositions}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] font-mono"
                title="Restablecer todas las fichas a la posición inicial (5c5)"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 4. MAIN BASKETBALL COURT: LOCKED TO EXACT FIBA RATIO [100 / 93.3] */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex-1 min-h-0 w-full overflow-hidden flex items-center justify-center p-1 sm:p-2.5 relative touch-none select-none bg-[#050a18]">
        {/* Court Container: Locked aspect ratio without deformation */}
        <div
          ref={courtContainerRef}
          className="relative max-h-full max-w-full aspect-[100/93.333] rounded-2xl border-2 border-neutral-700 shadow-2xl overflow-hidden touch-none mx-auto shrink-0"
          style={{
            aspectRatio: '100 / 93.333',
            height: '100%',
            width: 'auto',
            maxHeight: '100%',
            maxWidth: '100%',
          }}
        >
          {/* BASKETBALL COURT SVG */}
          <svg
            viewBox="0 0 100 93.3"
            preserveAspectRatio="xMidYMid meet"
            className="absolute inset-0 w-full h-full pointer-events-none select-none"
          >
            <defs>
              {/* Maple Hardwood Court Pattern */}
              <pattern
                id="tactical-parquet-floor"
                width="24"
                height="8"
                patternUnits="userSpaceOnUse"
              >
                <rect width="24" height="8" fill="#c9975a" />
                <rect x="0" y="0" width="10" height="2" fill="#d7a96d" opacity="0.32" />
                <rect x="10" y="0" width="14" height="2" fill="#bc894c" opacity="0.22" />
                <rect x="0" y="2" width="16" height="2" fill="#b98547" opacity="0.25" />
                <rect x="16" y="2" width="8" height="2" fill="#dfb377" opacity="0.35" />
                <rect x="0" y="4" width="7" height="2" fill="#d4a365" opacity="0.3" />
                <rect x="7" y="4" width="17" height="2" fill="#be8c4e" opacity="0.2" />
                <rect x="0" y="6" width="13" height="2" fill="#bc8849" opacity="0.26" />
                <rect x="13" y="6" width="11" height="2" fill="#ddaf73" opacity="0.34" />
                <line x1="0" y1="0" x2="24" y2="0" stroke="#7e5321" strokeWidth="0.16" opacity="0.75" />
                <line x1="0" y1="2" x2="24" y2="2" stroke="#7e5321" strokeWidth="0.14" opacity="0.6" />
                <line x1="0" y1="4" x2="24" y2="4" stroke="#7e5321" strokeWidth="0.14" opacity="0.6" />
                <line x1="0" y1="6" x2="24" y2="6" stroke="#7e5321" strokeWidth="0.14" opacity="0.6" />
                <line x1="0" y1="8" x2="24" y2="8" stroke="#7e5321" strokeWidth="0.16" opacity="0.75" />
                <line x1="10" y1="0" x2="10" y2="2" stroke="#684217" strokeWidth="0.16" opacity="0.8" />
                <line x1="16" y1="2" x2="16" y2="4" stroke="#684217" strokeWidth="0.16" opacity="0.8" />
                <line x1="7" y1="4" x2="7" y2="6" stroke="#684217" strokeWidth="0.16" opacity="0.8" />
                <line x1="13" y1="6" x2="13" y2="8" stroke="#684217" strokeWidth="0.16" opacity="0.8" />
              </pattern>

              {/* Dark Arena Pattern */}
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
              </pattern>

              {/* Key / Paint Lane Gradient */}
              <linearGradient id="tactical-fiba-key" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#1e3a8a" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#172554" stopOpacity="0.55" />
              </linearGradient>

              {/* Arena Spotlight Glow */}
              <radialGradient id="tactical-spotlight" cx="50%" cy="32%" r="68%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity={courtTheme === 'parquet' ? '0.12' : '0.06'} />
                <stop offset="65%" stopColor="#ffffff" stopOpacity="0" />
                <stop offset="100%" stopColor="#000000" stopOpacity="0.3" />
              </radialGradient>
            </defs>

            {/* Perimeter */}
            <rect x="0" y="0" width="100" height="93.3" fill="#0b0e14" />

            {/* Court Floor */}
            <rect
              x="2.5"
              y="2"
              width="95"
              height="89.3"
              rx="0.5"
              fill={courtTheme === 'parquet' ? 'url(#tactical-parquet-floor)' : 'url(#tactical-dark-arena)'}
            />

            {/* Key / Paint */}
            <rect
              x="33.7"
              y="2"
              width="32.6"
              height="38.6"
              fill="url(#tactical-fiba-key)"
            />

            {/* Center Jump Circle */}
            <path
              d="M 38 91.3 A 12 12 0 0 1 62 91.3 Z"
              fill="url(#tactical-fiba-key)"
              fillOpacity="0.4"
            />

            {/* FIBA Lines */}
            <g stroke="#ffffff" strokeWidth="0.75" fill="none" opacity="0.95">
              <rect x="2.5" y="2" width="95" height="89.3" />
              <line x1="2.5" y1="91.3" x2="97.5" y2="91.3" />
              <path d="M 38 91.3 A 12 12 0 0 1 62 91.3" />
              <line x1="7.5" y1="2" x2="7.5" y2="28" strokeWidth="0.8" />
              <line x1="92.5" y1="2" x2="92.5" y2="28" strokeWidth="0.8" />
              <path d="M 7.5 28 A 43.5 43.5 0 0 0 92.5 28" strokeWidth="0.8" />
              <rect x="33.7" y="2" width="32.6" height="38.6" />
              <line x1="33.7" y1="40.6" x2="66.3" y2="40.6" strokeWidth="0.8" />
              <path d="M 33.7 40.6 A 16.3 16.3 0 0 0 66.3 40.6" />
              <path
                d="M 33.7 40.6 A 16.3 16.3 0 0 1 66.3 40.6"
                strokeDasharray="1.6, 1.6"
                opacity="0.8"
              />
              <line x1="32.3" y1="17.5" x2="33.7" y2="17.5" strokeWidth="0.6" />
              <rect x="31.8" y="22.7" width="1.9" height="1.6" fill="#ffffff" stroke="none" />
              <line x1="32.3" y1="29.5" x2="33.7" y2="29.5" strokeWidth="0.6" />
              <line x1="32.3" y1="35.5" x2="33.7" y2="35.5" strokeWidth="0.6" />
              <line x1="66.3" y1="17.5" x2="67.7" y2="17.5" strokeWidth="0.6" />
              <rect x="66.3" y="22.7" width="1.9" height="1.6" fill="#ffffff" stroke="none" />
              <line x1="66.3" y1="29.5" x2="67.7" y2="29.5" strokeWidth="0.6" />
              <line x1="66.3" y1="35.5" x2="67.7" y2="35.5" strokeWidth="0.6" />
              <path d="M 41.7 11 A 8.3 8.3 0 0 0 58.3 11" strokeWidth="0.75" />
              <line x1="41.7" y1="11" x2="41.7" y2="7.5" strokeWidth="0.75" />
              <line x1="58.3" y1="11" x2="58.3" y2="7.5" strokeWidth="0.75" />
            </g>

            {/* Rim & Net */}
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

            {/* Spotlight */}
            <rect x="2.5" y="2" width="95" height="89.3" fill="url(#tactical-spotlight)" pointerEvents="none" />
          </svg>

          {/* HTML5 CANVAS DRAWING LAYER */}
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onContextMenu={e => {
              e.preventDefault();
              const coords = getCourtCoordinates(e.clientX, e.clientY);
              if (coords) eraseStrokeAtPoint(coords);
            }}
            className={`absolute inset-0 w-full h-full touch-none z-20 ${
              drawingType === 'borrador' ? 'cursor-pointer' : 'cursor-crosshair'
            }`}
            style={{ touchAction: 'none' }}
          />

          {/* Active Eraser Mode Banner on Court */}
          {drawingType === 'borrador' && (
            <div className="absolute top-2 right-2 z-30 bg-rose-950/90 border border-rose-500/70 text-rose-100 text-xs px-3 py-1.5 rounded-xl shadow-xl flex items-center gap-2 backdrop-blur-xs animate-in fade-in slide-in-from-top-1 pointer-events-none">
              <Eraser className="w-3.5 h-3.5 text-rose-400 stroke-[2.5]" />
              <span className="font-bold">Modo Borrador:</span>
              <span className="text-rose-200">Haz clic sobre cualquier línea para eliminarla</span>
            </div>
          )}

          {/* DRAGGABLE PLAYER & BALL TOKENS */}
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
                  onContextMenu={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (isDefense) {
                      handleRemoveSingleToken(token.id);
                    }
                  }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing pointer-events-auto touch-none select-none transition-transform duration-75 flex flex-col items-center justify-center ${
                    draggingTokenId === token.id
                      ? (isBall ? 'scale-115 z-40' : 'scale-125 z-40')
                      : 'hover:scale-110'
                  }`}
                  style={{
                    left: `${token.x}%`,
                    top: `${(token.y / 93.3) * 100}%`,
                  }}
                  title={
                    token.playerName
                      ? `${token.label} (${token.playerName})`
                      : token.type === 'ball'
                      ? 'Balón'
                      : isDefense
                      ? `${token.label} (Clic derecho o ✕ para eliminar)`
                      : token.label
                  }
                >
                  {isOffense && (
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 text-white font-black text-xs sm:text-sm flex items-center justify-center shadow-lg border-2 border-white ring-2 ring-orange-950/60 drop-shadow-md">
                      {token.label}
                    </div>
                  )}

                  {isDefense && (
                    <div className="relative group/def">
                      <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-black text-xs sm:text-sm flex items-center justify-center shadow-lg border-2 border-white ring-2 ring-blue-950/60 drop-shadow-md">
                        {token.label}
                      </div>
                      {/* Delete individual defender button */}
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          handleRemoveSingleToken(token.id);
                        }}
                        onPointerDown={e => e.stopPropagation()}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center text-[10px] font-black shadow-md border border-white opacity-80 sm:opacity-0 group-hover/def:opacity-100 transition-opacity active:scale-90 z-50 pointer-events-auto"
                        title={`Eliminar defensor ${token.label}`}
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {isBall && (
                    <div
                      className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-gradient-to-br from-orange-500 via-amber-600 to-orange-700 flex items-center justify-center shadow-sm border border-white ring-1 ring-black/50 drop-shadow select-none"
                      title="Balón (arrastra para posicionarlo)"
                    >
                      <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 sm:w-3 sm:h-3" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" r="10" stroke="#7c2d12" strokeWidth="1.8" fill="#ea580c" />
                        <line x1="12" y1="2" x2="12" y2="22" stroke="#7c2d12" strokeWidth="1.4" />
                        <line x1="2" y1="12" x2="22" y2="12" stroke="#7c2d12" strokeWidth="1.4" />
                        <path d="M4.5 4.5c4.5 4 4.5 11 0 15" stroke="#7c2d12" strokeWidth="1.3" />
                        <path d="M19.5 4.5c-4.5 4-4.5 11 0 15" stroke="#7c2d12" strokeWidth="1.3" />
                      </svg>
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

          {/* Current Frame Title & Notes Header Overlay on Court */}
          <div className="absolute top-2 left-2 z-20 bg-black/80 backdrop-blur-xs border border-white/10 rounded-lg px-2.5 py-1 text-[11px] font-mono text-slate-200 flex items-center gap-2">
            <span className="text-amber-400 font-black">
              {frames[activeFrameIndex]?.title || `Gráfico ${activeFrameIndex + 1}`}
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400 text-[10px]">
              Fase {activeFrameIndex + 1} de {frames.length}
            </span>
          </div>

          {/* Quick Capture Button on Court Overlay */}
          {drawingType !== 'borrador' && (
            <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5 pointer-events-auto">
              <button
                type="button"
                onClick={handleExportImage}
                disabled={isExporting}
                className="bg-emerald-600/90 hover:bg-emerald-500 active:bg-emerald-700 text-white text-[11px] font-black px-2.5 py-1 rounded-lg border border-emerald-400/50 shadow-lg flex items-center gap-1.5 backdrop-blur-xs transition active:scale-95 cursor-pointer disabled:opacity-50"
                title="Capturar diseño actual de la cancha como imagen PNG descargable para compartir con el equipo"
              >
                <Camera className="w-3.5 h-3.5 stroke-[2.2]" />
                <span className="hidden sm:inline">Capturar Cancha (PNG)</span>
                <span className="sm:hidden">PNG</span>
              </button>
            </div>
          )}

          {/* Floating Legend */}
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

      {/* ----------------------------------------------------------------- */}
      {/* 5. TACTICAL PLAY HISTORY MODAL (PLAYBOOK) */}
      {/* ----------------------------------------------------------------- */}
      <TacticalPlayHistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        plays={plays}
        onSelectPlay={handleSelectPlayFromHistory}
        onDeletePlay={handleDeletePlayFromHistory}
        onDuplicatePlay={handleDuplicatePlayFromHistory}
        onResetDefaultPlays={handleResetDefaultPlays}
        onImportPlays={handleImportPlays}
        currentPlayId={currentPlayId}
        initialAgeCategoryFilter={gameCategory}
      />
    </div>
  );
};

// =========================================================================
// CANVAS VECTOR RENDERING HELPERS: Pase, Bloqueo, Corte, Tiro, Bote, Lápiz
// =========================================================================

function getEndAngle(pts: TacticalPoint[]): number {
  if (pts.length < 2) return 0;
  const pEnd = pts[pts.length - 1];
  let pPrev = pts[0];
  for (let i = pts.length - 2; i >= 0; i--) {
    if (Math.hypot(pEnd.x - pts[i].x, pEnd.y - pts[i].y) >= 0.7) {
      pPrev = pts[i];
      break;
    }
  }
  return Math.atan2(pEnd.y - pPrev.y, pEnd.x - pPrev.x);
}

function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  strokeW: number
) {
  const headLength = Math.max(1.2, strokeW * 2.8);
  const spread = Math.PI / 6.5;

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(
    x - headLength * Math.cos(angle - spread),
    y - headLength * Math.sin(angle - spread)
  );
  ctx.lineTo(
    x - headLength * Math.cos(angle + spread),
    y - headLength * Math.sin(angle + spread)
  );
  ctx.closePath();
  ctx.fill();
}

function drawScreenTBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  strokeW: number
) {
  const barLength = Math.max(1.8, strokeW * 3.6);
  const perpAngle = angle + Math.PI / 2;
  const bx1 = x - (barLength / 2) * Math.cos(perpAngle);
  const by1 = y - (barLength / 2) * Math.sin(perpAngle);
  const bx2 = x + (barLength / 2) * Math.cos(perpAngle);
  const by2 = y + (barLength / 2) * Math.sin(perpAngle);

  ctx.save();
  ctx.lineWidth = Math.max(strokeW * 1.25, 0.42);
  ctx.beginPath();
  ctx.moveTo(bx1, by1);
  ctx.lineTo(bx2, by2);
  ctx.stroke();
  ctx.restore();
}

function drawTacticalStroke(ctx: CanvasRenderingContext2D, stroke: TacticalStroke) {
  const pts = stroke.points;
  if (!pts || pts.length === 0) return;

  // Clean, proportionate stroke width (normalize any legacy oversized values)
  const rawWidth = stroke.width || 0.32;
  const effectiveWidth = rawWidth >= 0.9 ? rawWidth * 0.45 : rawWidth;

  ctx.save();
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.lineWidth = effectiveWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const pEnd = pts[pts.length - 1];
  const angle = getEndAngle(pts);

  if (stroke.type === 'lapiz') {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();
  } else if (stroke.type === 'corte') {
    // Cut / movement follows exact mouse trajectory with sleek arrowhead at the tip
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();
    drawArrowHead(ctx, pEnd.x, pEnd.y, angle, effectiveWidth);
  } else if (stroke.type === 'pase') {
    // Pass follows mouse trajectory with dashed line and sleek arrowhead at the tip
    ctx.save();
    ctx.setLineDash([1.1, 0.9]);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();
    ctx.restore();
    drawArrowHead(ctx, pEnd.x, pEnd.y, angle, effectiveWidth);
  } else if (stroke.type === 'bloqueo') {
    // Screen follows mouse trajectory with T-bar perpendicular to arrival direction
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();
    drawScreenTBar(ctx, pEnd.x, pEnd.y, angle, effectiveWidth);
  } else if (stroke.type === 'tiro') {
    // Shot vector / arc with target bullseye at the rim or target point
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();

    ctx.save();
    const targetRadius = Math.max(1.2, effectiveWidth * 2.2);
    const dotRadius = Math.max(0.4, effectiveWidth * 0.7);

    ctx.lineWidth = Math.max(0.28, effectiveWidth * 0.7);
    ctx.beginPath();
    ctx.arc(pEnd.x, pEnd.y, targetRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(pEnd.x, pEnd.y, dotRadius, 0, Math.PI * 2);
    ctx.fill();

    const tipX = pEnd.x - (targetRadius + 0.2) * Math.cos(angle);
    const tipY = pEnd.y - (targetRadius + 0.2) * Math.sin(angle);
    drawArrowHead(ctx, tipX, tipY, angle, effectiveWidth);
    ctx.restore();
  } else if (stroke.type === 'bote') {
    // Dribble / bote: zigzag or wave along user trajectory
    if (pts.length <= 2) {
      const x1 = pts[0].x;
      const y1 = pts[0].y;
      const x2 = pEnd.x;
      const y2 = pEnd.y;
      const dist = Math.hypot(x2 - x1, y2 - y1);
      const perpAngle = angle + Math.PI / 2;
      const segmentLength = 2.0;
      const numSegments = Math.max(3, Math.floor(dist / segmentLength));
      const amplitude = Math.max(0.65, effectiveWidth * 1.3);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      for (let i = 1; i < numSegments; i++) {
        const t = i / numSegments;
        const midX = x1 + (x2 - x1) * t;
        const midY = y1 + (y2 - y1) * t;
        const offset = (i % 2 === 0 ? 1 : -1) * amplitude;
        ctx.lineTo(midX + offset * Math.cos(perpAngle), midY + offset * Math.sin(perpAngle));
      }
      ctx.lineTo(x2, y2);
      ctx.stroke();
    } else {
      // Freehand dribble path with subtle bounce ripples
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        const prev = pts[i - 1];
        const curr = pts[i];
        const midX = (prev.x + curr.x) / 2;
        const midY = (prev.y + curr.y) / 2;
        const segAngle = Math.atan2(curr.y - prev.y, curr.x - prev.x) + Math.PI / 2;
        const waveOffset = (i % 2 === 0 ? 0.45 : -0.45) * Math.min(1.0, effectiveWidth * 1.5);
        const waveX = midX + waveOffset * Math.cos(segAngle);
        const waveY = midY + waveOffset * Math.sin(segAngle);
        ctx.quadraticCurveTo(waveX, waveY, curr.x, curr.y);
      }
      ctx.stroke();
    }

    drawArrowHead(ctx, pEnd.x, pEnd.y, angle, effectiveWidth);
  }

  ctx.restore();
}
