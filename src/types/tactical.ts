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

export interface TacticalFrame {
  id: string;
  title: string; // e.g. "Gráfico 1: Inicio / Spacing", "Gráfico 2: Bloqueo directo"
  notes?: string;
  strokes: TacticalStroke[];
  tokens: TacticalToken[];
}

export type PlayCategory = 'ataque' | 'defensa' | 'fondo' | 'banda' | 'transicion' | 'especial';

export interface TacticalStep {
  id: string;
  stepNumber: number;
  title: string;
  instruction: string;
  frameIndex?: number;
}

export interface TacticalPlay {
  id: string;
  name: string;
  description?: string;
  category: PlayCategory; // Tipo táctico: ataque, defensa, fondo, banda, transicion, especial
  ageCategory?: string; // Categoría por edad / equipo: Infantil, Cadete, Junior, Senior, Escola, Todas...
  teamId?: string; // ID del equipo asociado opcional
  frames: TacticalFrame[];
  steps?: TacticalStep[];
  createdAt: number;
  updatedAt: number;
}

