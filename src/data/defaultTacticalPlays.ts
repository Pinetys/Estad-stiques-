import { TacticalPlay } from '../types/tactical';

export const DEFAULT_TACTICAL_PLAYS: TacticalPlay[] = [
  {
    id: 'play-horns-flare',
    name: 'Cuernos (Horns) - Flare & Roll',
    category: 'ataque',
    description: 'Ataque clásico de cuernos con poste alto, bloqueo ciego flare y continuación agresiva al aro.',
    createdAt: 1710000000000,
    updatedAt: 1710000000000,
    frames: [
      {
        id: 'frame-horns-1',
        title: 'Gráfico 1: Disposición Cuernos y Pase al Codo',
        notes: 'Base 1 sube con balón. 4 y 5 colocados en los codos (Horns). Pase de 1 a 4.',
        tokens: [
          { id: 'off-1', label: '1', type: 'offense', x: 50, y: 78, playerName: 'Base' },
          { id: 'off-2', label: '2', type: 'offense', x: 12, y: 35, playerName: 'Escolta' },
          { id: 'off-3', label: '3', type: 'offense', x: 88, y: 35, playerName: 'Alero' },
          { id: 'off-4', label: '4', type: 'offense', x: 38, y: 46, playerName: 'Ala-Pívot' },
          { id: 'off-5', label: '5', type: 'offense', x: 62, y: 46, playerName: 'Pívot' },
          { id: 'def-1', label: 'X1', type: 'defense', x: 50, y: 68 },
          { id: 'def-2', label: 'X2', type: 'defense', x: 18, y: 34 },
          { id: 'def-3', label: 'X3', type: 'defense', x: 82, y: 34 },
          { id: 'def-4', label: 'X4', type: 'defense', x: 38, y: 40 },
          { id: 'def-5', label: 'X5', type: 'defense', x: 62, y: 40 },
          { id: 'ball-1', label: '🏀', type: 'ball', x: 50, y: 84 },
        ],
        strokes: [
          // Pase de 1 a 4
          {
            id: 'stroke-h1-1',
            type: 'pase',
            color: '#FACC15',
            width: 1.6,
            points: [
              { x: 50, y: 76 },
              { x: 40, y: 50 },
            ],
          },
          // Corte de 1 hacia el lado contrario usando el bloqueo de 5
          {
            id: 'stroke-h1-2',
            type: 'corte',
            color: '#22C55E',
            width: 1.5,
            points: [
              { x: 48, y: 74 },
              { x: 66, y: 54 },
            ],
          },
          // Bloqueo ciego de 5
          {
            id: 'stroke-h1-3',
            type: 'bloqueo',
            color: '#EF4444',
            width: 1.6,
            points: [
              { x: 60, y: 48 },
              { x: 54, y: 62 },
            ],
          },
        ],
      },
      {
        id: 'frame-horns-2',
        title: 'Gráfico 2: Flare al Escolta y Finalización',
        notes: '5 pone bloqueo ciego indirecto (Flare) para la salida de 2 a 45º. 4 asiste para triple liberado o pase picado a 5 en la caída.',
        tokens: [
          { id: 'off-1', label: '1', type: 'offense', x: 74, y: 50, playerName: 'Base' },
          { id: 'off-2', label: '2', type: 'offense', x: 30, y: 64, playerName: 'Escolta' },
          { id: 'off-3', label: '3', type: 'offense', x: 90, y: 22, playerName: 'Alero' },
          { id: 'off-4', label: '4', type: 'offense', x: 38, y: 46, playerName: 'Ala-Pívot' },
          { id: 'off-5', label: '5', type: 'offense', x: 50, y: 30, playerName: 'Pívot' },
          { id: 'def-1', label: 'X1', type: 'defense', x: 70, y: 48 },
          { id: 'def-2', label: 'X2', type: 'defense', x: 34, y: 58 },
          { id: 'def-3', label: 'X3', type: 'defense', x: 86, y: 24 },
          { id: 'def-4', label: 'X4', type: 'defense', x: 38, y: 40 },
          { id: 'def-5', label: 'X5', type: 'defense', x: 50, y: 24 },
          { id: 'ball-1', label: '🏀', type: 'ball', x: 36, y: 48 },
        ],
        strokes: [
          // Pase de 4 a 2 abierto
          {
            id: 'stroke-h2-1',
            type: 'pase',
            color: '#FACC15',
            width: 1.6,
            points: [
              { x: 38, y: 48 },
              { x: 32, y: 62 },
            ],
          },
          // Tiro de 2 a canasta
          {
            id: 'stroke-h2-2',
            type: 'tiro',
            color: '#EF4444',
            width: 1.8,
            points: [
              { x: 30, y: 64 },
              { x: 50, y: 12 },
            ],
          },
          // Continuación de 5 al rebote
          {
            id: 'stroke-h2-3',
            type: 'corte',
            color: '#38BDF8',
            width: 1.4,
            points: [
              { x: 50, y: 30 },
              { x: 50, y: 16 },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'play-ato-fondo-espana',
    name: 'Fondo ATO - Pick & Roll España',
    category: 'fondo',
    description: 'Saque de fondo tras tiempo muerto con pick & roll central y bloqueo indirecto ciego de escolta al pívot rival.',
    createdAt: 1710100000000,
    updatedAt: 1710100000000,
    frames: [
      {
        id: 'frame-fondo-1',
        title: 'Gráfico 1: Saque de Fondo y Entrada de Balón',
        notes: 'Sacador 3 busca pase a 1 que sube tras pantalla de 4.',
        tokens: [
          { id: 'off-3', label: '3', type: 'offense', x: 50, y: 3, playerName: 'Alero' },
          { id: 'off-1', label: '1', type: 'offense', x: 50, y: 55, playerName: 'Base' },
          { id: 'off-2', label: '2', type: 'offense', x: 20, y: 30, playerName: 'Escolta' },
          { id: 'off-4', label: '4', type: 'offense', x: 42, y: 40, playerName: 'Ala-Pívot' },
          { id: 'off-5', label: '5', type: 'offense', x: 75, y: 30, playerName: 'Pívot' },
          { id: 'def-3', label: 'X3', type: 'defense', x: 50, y: 8 },
          { id: 'def-1', label: 'X1', type: 'defense', x: 50, y: 60 },
          { id: 'def-2', label: 'X2', type: 'defense', x: 24, y: 30 },
          { id: 'def-4', label: 'X4', type: 'defense', x: 44, y: 36 },
          { id: 'def-5', label: 'X5', type: 'defense', x: 70, y: 30 },
          { id: 'ball-1', label: '🏀', type: 'ball', x: 50, y: 2 },
        ],
        strokes: [
          {
            id: 'stroke-f1-1',
            type: 'pase',
            color: '#FACC15',
            width: 1.6,
            points: [
              { x: 50, y: 4 },
              { x: 50, y: 53 },
            ],
          },
          {
            id: 'stroke-f1-2',
            type: 'bloqueo',
            color: '#EF4444',
            width: 1.6,
            points: [
              { x: 44, y: 38 },
              { x: 48, y: 50 },
            ],
          },
        ],
      },
      {
        id: 'frame-fondo-2',
        title: 'Gráfico 2: Bloqueo España (Backscreen al Defensor del Roll)',
        notes: '5 pone pick a 1; inmediatamente 2 pone bloqueo ciego a X5. 1 penetra o pasa al alley-oop de 5.',
        tokens: [
          { id: 'off-3', label: '3', type: 'offense', x: 12, y: 18, playerName: 'Alero' },
          { id: 'off-1', label: '1', type: 'offense', x: 42, y: 46, playerName: 'Base' },
          { id: 'off-2', label: '2', type: 'offense', x: 52, y: 38, playerName: 'Escolta' },
          { id: 'off-4', label: '4', type: 'offense', x: 88, y: 40, playerName: 'Ala-Pívot' },
          { id: 'off-5', label: '5', type: 'offense', x: 50, y: 22, playerName: 'Pívot' },
          { id: 'def-3', label: 'X3', type: 'defense', x: 16, y: 20 },
          { id: 'def-1', label: 'X1', type: 'defense', x: 46, y: 50 },
          { id: 'def-2', label: 'X2', type: 'defense', x: 50, y: 42 },
          { id: 'def-4', label: 'X4', type: 'defense', x: 82, y: 38 },
          { id: 'def-5', label: 'X5', type: 'defense', x: 50, y: 28 },
          { id: 'ball-1', label: '🏀', type: 'ball', x: 42, y: 48 },
        ],
        strokes: [
          // Bote de 1 hacia el aro
          {
            id: 'stroke-f2-1',
            type: 'bote',
            color: '#F97316',
            width: 1.6,
            points: [
              { x: 42, y: 46 },
              { x: 42, y: 26 },
            ],
          },
          // Pase bombeado a 5 en el aro
          {
            id: 'stroke-f2-2',
            type: 'pase',
            color: '#FACC15',
            width: 1.6,
            points: [
              { x: 42, y: 30 },
              { x: 50, y: 16 },
            ],
          },
          // Tiro de 5
          {
            id: 'stroke-f2-3',
            type: 'tiro',
            color: '#22C55E',
            width: 1.8,
            points: [
              { x: 50, y: 20 },
              { x: 50, y: 11 },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'play-banda-zipper',
    name: 'Saque Banda - Salida Zipper',
    category: 'banda',
    description: 'Saque lateral con corte Zipper hacia el centro para generar tiro en cabecera o inversión rápida.',
    createdAt: 1710200000000,
    updatedAt: 1710200000000,
    frames: [
      {
        id: 'frame-zipper-1',
        title: 'Gráfico 1: Corte Zipper y Salida a Cabecera',
        notes: '2 sube verticalmente con bloqueo ciego de 5 en poste bajo. 3 saca desde la banda.',
        tokens: [
          { id: 'off-3', label: '3', type: 'offense', x: 2, y: 55, playerName: 'Alero' },
          { id: 'off-1', label: '1', type: 'offense', x: 80, y: 65, playerName: 'Base' },
          { id: 'off-2', label: '2', type: 'offense', x: 50, y: 68, playerName: 'Escolta' },
          { id: 'off-4', label: '4', type: 'offense', x: 80, y: 22, playerName: 'Ala-Pívot' },
          { id: 'off-5', label: '5', type: 'offense', x: 50, y: 36, playerName: 'Pívot' },
          { id: 'def-3', label: 'X3', type: 'defense', x: 6, y: 55 },
          { id: 'def-1', label: 'X1', type: 'defense', x: 76, y: 62 },
          { id: 'def-2', label: 'X2', type: 'defense', x: 52, y: 62 },
          { id: 'def-4', label: 'X4', type: 'defense', x: 76, y: 24 },
          { id: 'def-5', label: 'X5', type: 'defense', x: 50, y: 30 },
          { id: 'ball-1', label: '🏀', type: 'ball', x: 2, y: 57 },
        ],
        strokes: [
          // Pase de 3 a 2
          {
            id: 'stroke-z1-1',
            type: 'pase',
            color: '#FACC15',
            width: 1.6,
            points: [
              { x: 3, y: 55 },
              { x: 48, y: 68 },
            ],
          },
          // Bloqueo de 5
          {
            id: 'stroke-z1-2',
            type: 'bloqueo',
            color: '#EF4444',
            width: 1.6,
            points: [
              { x: 50, y: 40 },
              { x: 50, y: 52 },
            ],
          },
          // Tiro de 2
          {
            id: 'stroke-z1-3',
            type: 'tiro',
            color: '#38BDF8',
            width: 1.6,
            points: [
              { x: 50, y: 68 },
              { x: 50, y: 12 },
            ],
          },
        ],
      },
    ],
  },
];
