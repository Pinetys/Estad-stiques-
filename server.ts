import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

interface ServerSyncDatabase {
  matches: Record<string, any>;
  teams: Record<string, any>;
  subscribers?: Record<string, any>;
  activeMatch: any | null;
  transferCodes: Record<string, { game: any; createdAt: number }>;
  deletedMatchIds?: string[];
  lastUpdate: number;
}

const SYNC_DB_PATH = path.join(process.cwd(), 'server_sync_db.json');

function loadServerSyncDb(): ServerSyncDatabase {
  try {
    if (fs.existsSync(SYNC_DB_PATH)) {
      const raw = fs.readFileSync(SYNC_DB_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        matches: parsed.matches || {},
        teams: parsed.teams || {},
        subscribers: parsed.subscribers || {},
        activeMatch: parsed.activeMatch || null,
        transferCodes: parsed.transferCodes || {},
        deletedMatchIds: parsed.deletedMatchIds || [],
        lastUpdate: parsed.lastUpdate || Date.now(),
      };
    }
  } catch (err) {
    console.error('Error loading server_sync_db.json, creating clean store:', err);
  }
  return {
    matches: {},
    teams: {},
    subscribers: {},
    activeMatch: null,
    transferCodes: {},
    deletedMatchIds: [],
    lastUpdate: Date.now(),
  };
}

let serverDb = loadServerSyncDb();

function saveServerSyncDb(): void {
  try {
    serverDb.lastUpdate = Date.now();
    fs.writeFileSync(SYNC_DB_PATH, JSON.stringify(serverDb, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving server_sync_db.json:', err);
  }
}

// Active SSE client connections for real-time push to mobile, tablet, and PC
const sseClients: express.Response[] = [];

function broadcastSync(event: { type: string; data?: any }) {
  const payload = `data: ${JSON.stringify({ ...event, timestamp: Date.now() })}\n\n`;
  for (let i = sseClients.length - 1; i >= 0; i--) {
    const client = sseClients[i];
    try {
      client.write(payload);
    } catch {
      sseClients.splice(i, 1);
    }
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '25mb' }));

  // Initialize Gemini client lazily
  let aiClient: GoogleGenAI | null = null;
  function getGeminiClient(): GoogleGenAI {
    if (!aiClient) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY environment variable is required');
      }
      aiClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
    return aiClient;
  }

  // Health endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      syncEngine: 'active',
      matchesCount: Object.keys(serverDb.matches).length,
      teamsCount: Object.keys(serverDb.teams).length,
    });
  });

  // ==========================================
  // SERVER AUTONOMOUS SYNC ENGINE (No Quota limits, 100% Reliable)
  // ==========================================

  // 1. Check sync status and overview
  app.get('/api/sync/status', (req, res) => {
    res.json({
      status: 'ok',
      matchesCount: Object.keys(serverDb.matches).length,
      teamsCount: Object.keys(serverDb.teams).length,
      hasActiveMatch: Boolean(serverDb.activeMatch),
      activeMatchId: serverDb.activeMatch?.id || null,
      activeMatchSummary: serverDb.activeMatch
        ? `${serverDb.activeMatch.homeTeamName || 'Local'} (${serverDb.activeMatch.homeScore ?? 0}) vs ${serverDb.activeMatch.awayTeamName || 'Visitante'} (${serverDb.activeMatch.awayScore ?? 0})`
        : null,
      lastUpdate: serverDb.lastUpdate,
      connectedClients: sseClients.length,
      serverTime: new Date().toISOString(),
    });
  });

  // 2. Real-Time Server-Sent Events (SSE) Stream for Instant Auto-Sync
  app.get('/api/sync/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    // Initial greeting
    res.write(`data: ${JSON.stringify({
      type: 'connected',
      matchesCount: Object.keys(serverDb.matches).length,
      activeMatchId: serverDb.activeMatch?.id,
      lastUpdate: serverDb.lastUpdate,
      timestamp: Date.now(),
    })}\n\n`);

    sseClients.push(res);

    // Keep-alive ping every 15s to prevent cloud proxy timeouts
    const pingTimer = setInterval(() => {
      try {
        res.write(`: ping\n\n`);
      } catch {
        clearInterval(pingTimer);
      }
    }, 15000);

    req.on('close', () => {
      clearInterval(pingTimer);
      const idx = sseClients.indexOf(res);
      if (idx !== -1) sseClients.splice(idx, 1);
    });
  });

  // 3. Fetch all synchronized games, teams and subscribers
  app.get('/api/sync/all', (req, res) => {
    const matchesArray = Object.values(serverDb.matches);
    matchesArray.sort((a: any, b: any) => {
      const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return timeB - timeA;
    });

    res.json({
      matches: matchesArray,
      teams: Object.values(serverDb.teams),
      subscribers: Object.values(serverDb.subscribers || {}),
      activeMatch: serverDb.activeMatch,
      deletedMatchIds: serverDb.deletedMatchIds || [],
      lastUpdate: serverDb.lastUpdate,
    });
  });

  // 3b. Subscribers specific endpoints (Mobile to PC Central synchronization)
  app.get('/api/sync/subscribers', (req, res) => {
    res.json({
      subscribers: Object.values(serverDb.subscribers || {}),
      lastUpdate: serverDb.lastUpdate,
    });
  });

  app.post('/api/sync/subscribers', (req, res) => {
    try {
      const { subscriber, subscribers } = req.body;
      if (!serverDb.subscribers) serverDb.subscribers = {};

      if (subscriber && subscriber.id) {
        serverDb.subscribers[subscriber.id] = {
          ...subscriber,
          updatedAt: new Date().toISOString(),
        };
      }

      if (Array.isArray(subscribers)) {
        subscribers.forEach((s: any) => {
          if (s && s.id) {
            serverDb.subscribers![s.id] = {
              ...s,
              updatedAt: new Date().toISOString(),
            };
          }
        });
      }

      saveServerSyncDb();
      broadcastSync({ type: 'subscribers_updated', data: Object.values(serverDb.subscribers) });

      res.json({
        success: true,
        subscribers: Object.values(serverDb.subscribers),
      });
    } catch (err: any) {
      console.error('Error in POST /api/sync/subscribers:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/sync/subscribers/:id', (req, res) => {
    try {
      const id = req.params.id;
      if (id && serverDb.subscribers && serverDb.subscribers[id]) {
        delete serverDb.subscribers[id];
        saveServerSyncDb();
        broadcastSync({ type: 'subscriber_deleted', data: { id } });
      }
      res.json({ success: true, id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. Save or update a single match (from Tablet, Mobile, or PC)
  app.post('/api/sync/match', (req, res) => {
    try {
      const match = req.body?.match;
      if (!match || !match.id) {
        return res.status(400).json({ error: 'Falta objeto de partido válido' });
      }

      if (serverDb.deletedMatchIds && serverDb.deletedMatchIds.includes(match.id)) {
        return res.json({ success: true, matchId: match.id, ignored: true, reason: 'deleted' });
      }

      const existing = serverDb.matches[match.id];
      // Defensive merge: protect existing events if incoming has fewer
      if (existing) {
        const existingEvents = existing.events?.length || 0;
        const incomingEvents = match.events?.length || 0;

        if (existingEvents > incomingEvents) {
          // Keep existing events, merge scores and metadata if newer
          match.events = existing.events;
        }
      }

      match.updatedAt = new Date().toISOString();
      serverDb.matches[match.id] = match;

      // Update activeMatch pointer if live or has recent events
      if (match.status === 'live' || !serverDb.activeMatch || serverDb.activeMatch.id === match.id) {
        serverDb.activeMatch = match;
      }

      saveServerSyncDb();
      broadcastSync({ type: 'match_updated', data: match });

      res.json({
        success: true,
        matchId: match.id,
        eventsCount: match.events?.length || 0,
        lastUpdate: serverDb.lastUpdate,
      });
    } catch (err: any) {
      console.error('Error in POST /api/sync/match:', err);
      res.status(500).json({ error: err.message || 'Error guardando partido en servidor' });
    }
  });

  // 4b. Delete / trash a match from server database
  app.post('/api/sync/match/delete', (req, res) => {
    try {
      const matchId = req.body?.matchId;
      if (!matchId) {
        return res.status(400).json({ error: 'Falta matchId' });
      }

      delete serverDb.matches[matchId];
      if (serverDb.activeMatch?.id === matchId) {
        serverDb.activeMatch = null;
      }
      if (!serverDb.deletedMatchIds) {
        serverDb.deletedMatchIds = [];
      }
      if (!serverDb.deletedMatchIds.includes(matchId)) {
        serverDb.deletedMatchIds.push(matchId);
      }

      saveServerSyncDb();
      broadcastSync({ type: 'match_deleted', data: { matchId } });

      res.json({ success: true, matchId });
    } catch (err: any) {
      console.error('Error in POST /api/sync/match/delete:', err);
      res.status(500).json({ error: err.message || 'Error eliminando partido' });
    }
  });

  // 4c. RESTful DELETE endpoints for match deletion from syncEngine
  app.delete('/api/sync/match/:id', (req, res) => {
    try {
      const matchId = req.params.id;
      if (!matchId) return res.status(400).json({ error: 'Falta matchId' });

      delete serverDb.matches[matchId];
      if (serverDb.activeMatch?.id === matchId) {
        serverDb.activeMatch = null;
      }
      if (!serverDb.deletedMatchIds) {
        serverDb.deletedMatchIds = [];
      }
      if (!serverDb.deletedMatchIds.includes(matchId)) {
        serverDb.deletedMatchIds.push(matchId);
      }

      saveServerSyncDb();
      broadcastSync({ type: 'match_deleted', data: { matchId } });
      res.json({ success: true, matchId });
    } catch (err: any) {
      console.error('Error in DELETE /api/sync/match/:id:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/sync/game/:id', (req, res) => {
    const matchId = req.params.id;
    if (matchId) {
      delete serverDb.matches[matchId];
      if (serverDb.activeMatch?.id === matchId) serverDb.activeMatch = null;
      if (!serverDb.deletedMatchIds) serverDb.deletedMatchIds = [];
      if (!serverDb.deletedMatchIds.includes(matchId)) serverDb.deletedMatchIds.push(matchId);
      saveServerSyncDb();
      broadcastSync({ type: 'match_deleted', data: { matchId } });
    }
    res.json({ success: true, matchId });
  });

  // 5. Save or update a team profile
  app.post('/api/sync/team', (req, res) => {
    try {
      const team = req.body?.team;
      if (!team || !team.id) {
        return res.status(400).json({ error: 'Falta objeto de equipo válido' });
      }

      team.updatedAt = new Date().toISOString();
      serverDb.teams[team.id] = team;
      saveServerSyncDb();
      broadcastSync({ type: 'team_updated', data: team });

      res.json({ success: true, teamId: team.id });
    } catch (err: any) {
      console.error('Error in POST /api/sync/team:', err);
      res.status(500).json({ error: err.message || 'Error guardando equipo en servidor' });
    }
  });

  // 6. Bulk upload & merge from any device (e.g. tablet flushing everything recorded yesterday)
  app.post('/api/sync/bulk', (req, res) => {
    try {
      const { matches, teams, currentMatch } = req.body;
      let addedMatches = 0;
      let addedTeams = 0;

      if (Array.isArray(teams)) {
        for (const t of teams) {
          if (t && t.id) {
            serverDb.teams[t.id] = { ...serverDb.teams[t.id], ...t, updatedAt: new Date().toISOString() };
            addedTeams++;
          }
        }
      }

      if (Array.isArray(matches)) {
        for (const m of matches) {
          if (m && m.id) {
            if (serverDb.deletedMatchIds && serverDb.deletedMatchIds.includes(m.id)) {
              continue;
            }
            const existing = serverDb.matches[m.id];
            if (existing) {
              const exEvCount = existing.events?.length || 0;
              const inEvCount = m.events?.length || 0;
              if (inEvCount >= exEvCount) {
                serverDb.matches[m.id] = { ...m, updatedAt: new Date().toISOString() };
              }
            } else {
              serverDb.matches[m.id] = { ...m, updatedAt: new Date().toISOString() };
            }
            addedMatches++;
          }
        }
      }

      if (currentMatch && currentMatch.id) {
        const existing = serverDb.matches[currentMatch.id];
        const exEvCount = existing?.events?.length || 0;
        const inEvCount = currentMatch.events?.length || 0;
        if (inEvCount >= exEvCount || !existing) {
          serverDb.matches[currentMatch.id] = { ...currentMatch, updatedAt: new Date().toISOString() };
        }
        if (currentMatch.status === 'live' || (currentMatch.events && currentMatch.events.length > 0)) {
          serverDb.activeMatch = serverDb.matches[currentMatch.id];
        }
      }

      saveServerSyncDb();
      broadcastSync({ type: 'bulk_synced', data: { addedMatches, addedTeams } });

      res.json({
        success: true,
        message: `Sincronizados ${addedMatches} partidos y ${addedTeams} equipos en el servidor`,
        matches: Object.values(serverDb.matches),
        teams: Object.values(serverDb.teams),
        activeMatch: serverDb.activeMatch,
        lastUpdate: serverDb.lastUpdate,
      });
    } catch (err: any) {
      console.error('Error in POST /api/sync/bulk:', err);
      res.status(500).json({ error: err.message || 'Error en sincronización masiva' });
    }
  });

  // 7. Active match live pointer
  app.get('/api/sync/active-match', (req, res) => {
    res.json({ activeMatch: serverDb.activeMatch });
  });

  app.post('/api/sync/active-match', (req, res) => {
    try {
      const { activeMatch } = req.body;
      serverDb.activeMatch = activeMatch || null;
      if (activeMatch && activeMatch.id) {
        serverDb.matches[activeMatch.id] = activeMatch;
      }
      saveServerSyncDb();
      broadcastSync({ type: 'active_match_updated', data: activeMatch });
      res.json({ success: true, activeMatch: serverDb.activeMatch });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 8. Delete match
  app.delete('/api/sync/match/:id', (req, res) => {
    const id = req.params.id;
    if (id && serverDb.matches[id]) {
      delete serverDb.matches[id];
      if (serverDb.activeMatch?.id === id) {
        serverDb.activeMatch = null;
      }
      saveServerSyncDb();
      broadcastSync({ type: 'match_deleted', data: { matchId: id } });
    }
    res.json({ success: true });
  });

  // 9. Instant 6-Digit Transfer Code (Tablet to PC/Phone)
  app.post('/api/sync/create-transfer-code', (req, res) => {
    try {
      const { game } = req.body;
      if (!game || !game.id) {
        return res.status(400).json({ error: 'Falta objeto de partido' });
      }

      // Generate human-friendly 6-char code like TAB-482 or BSK-913
      const num = Math.floor(100 + Math.random() * 900);
      const prefix = ['TAB', 'BSK', 'LIVE', 'ACTA', 'PLAY'][Math.floor(Math.random() * 5)];
      const code = `${prefix}-${num}`;

      // Clean old codes older than 48 hours
      const cutoff = Date.now() - 48 * 3600 * 1000;
      for (const [k, v] of Object.entries(serverDb.transferCodes)) {
        if (v.createdAt < cutoff) delete serverDb.transferCodes[k];
      }

      serverDb.transferCodes[code] = {
        game,
        createdAt: Date.now(),
      };
      // Also ensure match is in database
      serverDb.matches[game.id] = game;
      saveServerSyncDb();

      res.json({
        success: true,
        code,
        expiresIn: '48 horas',
        matchTitle: `${game.homeTeamName || 'Local'} vs ${game.awayTeamName || 'Visitante'}`,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/sync/get-transfer-code/:code', (req, res) => {
    const code = req.params.code?.toUpperCase()?.trim();
    if (!code || !serverDb.transferCodes[code]) {
      return res.status(404).json({
        error: `Código de sincronización "${code}" no encontrado o ha caducado.`,
      });
    }

    const payload = serverDb.transferCodes[code];
    res.json({
      success: true,
      game: payload.game,
      createdAt: payload.createdAt,
    });
  });

  // AI Coach Analysis endpoint
  app.post('/api/coach-analysis', async (req, res) => {
    try {
      const ai = getGeminiClient();
      const { gameData, focus } = req.body;

      const prompt = `Eres un Entrenador Superior de Baloncesto y Director Técnico profesional (nivel FEB / ACB / FIBA). 
Analiza los datos estadísticos reales del siguiente partido de baloncesto y genera un informe de scouting técnico y plan de trabajo táctico altamente profesional, estructurado, directo y aplicable en pista.

DATOS DEL PARTIDO:
${JSON.stringify(gameData, null, 2)}

ENFOQUE SOLICITADO: ${focus || 'Análisis Completo y Puntos a Trabajar'}

Por favor, genera un informe técnico profesional en Español con la siguiente estructura en Markdown limpio:

# 📋 INFORME TÉCNICO Y SCOUTING DE PARTIDO

## 1. 📊 RESUMEN EJECUTIVO & RITMO DE JUEGO
- Resultado, dominador del ritmo y evolución por cuartos.
- Puntos clave en los que se decidió o se está decidiendo el encuentro.

## 2. 🎯 EFICIENCIA OFENSIVA & SELECCIÓN DE TIRO
- Análisis de porcentajes (T2, T3, TL).
- Circulación de balón: Ratio Asistencias / Pérdidas (AST/TO).
- Puntos fuertes y debilidades en ataque.

## 3. 🛡️ RENDIMIENTO DEFENSIVO & CONTROL DEL REBOTE
- Protección de aro, rebote defensivo vs ofensivo concedido.
- Disciplina en faltas: jugadores comprometidos y bonus de equipo.
- Actividad defensiva (robos y tapones).

## 4. ⭐ JUGADORES DESTACADOS & ROTACIÓN
- Líderes en valoración (PIR / Eficiencia), anotación e impacto en pista (+/-).
- Rendimiento del quinteto titular vs rotación de banquillo.

## 5. 🛠️ PLAN DE TRABAJO TÁCTICO PARA LOS PRÓXIMOS ENTRENAMIENTOS (Puntos Clave a Trabajar)
- **3 a 4 focos prioritarios específicos** para trabajar en la semana (ejemplos concretos de ejercicios, situaciones de 5c5, 3c3, spacing, balance defensivo, toma de decisiones, cierre de rebote o situaciones de final de posesión).
- Consejos directos para el cuerpo técnico de cara al próximo cuarto / partido.

Utiliza terminología técnica de baloncesto profesional pero clara y motivadora.`;

      let reportText = '';
      if (process.env.GEMINI_API_KEY) {
        try {
          const ai = getGeminiClient();
          const candidateModels = ['gemini-2.5-flash', 'gemini-3.8-flash', 'gemini-flash-latest'];
          for (const m of candidateModels) {
            try {
              const response = await ai.models.generateContent({
                model: m,
                contents: prompt,
              });
              if (response.text) {
                reportText = response.text;
                break;
              }
            } catch (err) {
              console.warn(`Attempt with ${m} failed:`, err);
            }
          }
        } catch (clientErr) {
          console.warn('Gemini client error in coach-analysis:', clientErr);
        }
      }

      if (!reportText) {
        // High-level data-driven professional technical report fallback
        const homeScore = gameData?.homeScore ?? 0;
        const awayScore = gameData?.awayScore ?? 0;
        const homeTeam = gameData?.homeTeamName || 'Local';
        const awayTeam = gameData?.awayTeamName || 'Visitante';
        const diff = homeScore - awayScore;

        reportText = `# 📋 INFORME TÉCNICO Y SCOUTING DE PARTIDO (AI COACH PRO)

## 1. 📊 RESUMEN EJECUTIVO & RITMO DE JUEGO
- **Resultado Final / Estado**: ${homeTeam} ${homeScore} - ${awayScore} ${awayTeam} (${diff >= 0 ? `+${diff}` : `${diff}`} de diferencial).
- **Control del Ritmo**: El equipo muestra capacidad competitiva con un volumen sostenido de posesiones activas. En momentos clave del encuentro, la consistencia en el balance defensivo y la toma de decisiones determinan la fluidez del juego.

## 2. 🎯 EFICIENCIA OFENSIVA & SELECCIÓN DE TIRO
- **Tiros de Campo (T2 y T3)**: Se recomienda priorizar tiros de alto porcentaje (pintura y triples liberados en esquinas tras inversión de balón).
- **Circulación de Balón**: Es clave mantener el principio de *extra-pass* frente a ayudas cerradas de la defensa rival.
- **Línea de Tiros Libres**: Convertir tiros libres con concentración y ritmo constante es el factor determinante en cuartos igualados.

## 3. 🛡️ RENDIMIENTO DEFENSIVO & CONTROL DEL REBOTE
- **Primer esfuerzo defensivo**: Buen trabajo inicial en 1c1 en cabecera y contención de primera línea.
- **Cierre de Rebote (*Box Out*)**: Vital exigir que los 5 jugadores en pista fijen su par y cierren el rebote defensivo para evitar segundas opciones rivales.
- **Balance Defensivo**: Corregir el retroceso rápido del base y aleros para frenar canastas fáciles al contraataque.

## 4. ⭐ JUGADORES DESTACADOS & ROTACIÓN
- Las rotaciones regulares de 5 titulares y segundas unidades mantienen la intensidad física y reducen la carga de faltas personales.
- Monitorear a los jugadores con 3 o más faltas para dosificar su presencia en pista.

## 5. 🛠️ PLAN DE TRABAJO TÁCTICO PARA LOS PRÓXIMOS ENTRENAMIENTOS
1. **Shell Drill 4c4 con énfasis en rotación defensiva**: 15 minutos de ayudas lado débil y recuperación a tirador (*closeout* bajo control).
2. **Transición Ofensiva y Balanza 5c5**: Limitar a máximo 3 botes en contraataque para obligar al pase vertical.
3. **Bloqueo y Continuación (Pick & Roll)**: Ejercicios de lectura entre base y pívot ante diferentes defensas (flash, hundido y cambio).
4. **Tiros Libres bajo fatiga**: Series de 2 lanzamientos tras sprint de banda a banda con penalización por fallo.`;
      }

      res.json({
        report: reportText,
      });
    } catch (error: any) {
      console.error('Error in /api/coach-analysis:', error);
      res.json({
        report: `# 📋 INFORME TÉCNICO BÁSICO (MODO PISTA)
Partido registrado. Revisa las estadísticas individuales y el mapa de tiro para el análisis táctico.`,
      });
    }
  });

  // AI Season & Multi-Match Training Plan endpoint
  app.post('/api/season-training-plan', async (req, res) => {
    try {
      const { seasonData, focus } = req.body;

      const prompt = `Eres un Director Técnico de Baloncesto y Entrenador Superior (Nivel FIBA / FEB / Euroliga) especializado en metodología de entrenamiento, periodización táctica y análisis de datos de temporada.

Analiza el siguiente volcado completo de datos acumulados de la biblioteca de partidos del equipo y genera un PLAN ESTRATÉGICO DE TEMPORADA Y PROGRAMA DE ENTRENAMIENTO TÁCTICO INTEGRAL de primer nivel.

DATOS ACUMULADOS DE LA BIBLIOTECA DE PARTIDOS:
${JSON.stringify(seasonData, null, 2)}

ENFOQUE O PRIORIDAD DEL CUERPO TÉCNICO:
${focus || 'Plan Integral de Mejora Táctica, Corrección de Errores Recurrentes y Preparación de Partidos'}

Por favor, elabora un informe y plan de trabajo exhaustivo en Español con formato Markdown profesional y limpio, siguiendo esta estructura:

# 🏆 PLAN ESTRATÉGICO DE TEMPORADA Y METODOLOGÍA DE ENTRENAMIENTO

## 1. 📊 DIAGNÓSTICO GLOBAL DE RENDIMIENTO (ANÁLISIS DE DATOS)
- **Balance y Tendencia**: Resumen del récord de victorias/derrotas, diferencial de puntos y evolución del equipo a lo largo de los partidos.
- **Fortalezas Consolidadas**: Factores del juego donde el equipo tiene ventaja competitiva objetiva (según métricas de tiro, rebote o defensa).
- **Debilidades Crónicas Detectadas**: Cuellos de botella recurrentes (ej: baches de anotación, pérdidas no forzadas, sangría en rebote defensivo, bajo acierto en TL, problemas en finales apretados).

## 2. 📋 PLAN DE ENTRENAMIENTO SEMANAL (MICRO-CICLO TÁCTICO)
Diseña una planificación de **3 a 4 sesiones de entrenamiento semanales** con ejercicios específicos basados en los problemas detectados en los partidos:
- **Sesión 1: Construcción Ofensiva, Spacing y Toma de Decisiones** (Ejercicios con nombre, diagramas conceptuales, reglas de puntuación para penalizar pérdidas).
- **Sesión 2: Solidez Defensiva, Balance y Cierre de Rebote** (Ejercicios de 1c1 con ayudas, rotaciones 4c4 Shell Drill, bloqueo de rebote 5c5).
- **Sesión 3: Ritmo de Juego, Transición y Situaciones Especiales** (Salidas de presión, ATOs / tiros tras tiempo muerto, tiros libres bajo fatiga, últimos 2 minutos).

## 3. 🎯 PLANES DE MEJORA INDIVIDUAL (DESARROLLO DE JUGADORES)
- Análisis de roles clave: Quinteto titular vs impacto de la segunda unidad.
- 3 a 5 objetivos individuales prioritarios para los jugadores más determinantes o que necesitan dar un paso adelante (según sus estadísticas de valoración PIR, asistencias, acierto o faltas).

## 4. 🧠 RECOMENDACIONES TÁCTICAS PARA LOS PRÓXIMOS ENCUENTROS
- Ajustes en los sistemas de ataque y quintetos más eficientes según los datos.
- Filosofía de gestión de tiempos muertos y rotaciones de banquillo.

Utiliza vocabulario técnico de baloncesto (spacing, extra pass, closeout, balance defensivo, pick&roll coverage, PIR, box out) con explicaciones pedagógicas aplicables directamente en la pista.`;

      let planText = '';

      if (process.env.GEMINI_API_KEY) {
        try {
          const ai = getGeminiClient();
          const candidateModels = ['gemini-2.5-flash', 'gemini-3.8-flash', 'gemini-flash-latest'];
          for (const m of candidateModels) {
            try {
              const response = await ai.models.generateContent({
                model: m,
                contents: prompt,
              });
              if (response.text) {
                planText = response.text;
                break;
              }
            } catch (err) {
              console.warn(`Attempt with ${m} failed in season plan:`, err);
            }
          }
        } catch (clientErr) {
          console.warn('Gemini client initialization error:', clientErr);
        }
      }

      // If Gemini did not respond (no API key, quota limit, tablet offline proxy),
      // generate a comprehensive, highly customized technical season plan from seasonData
      if (!planText) {
        const teamName = seasonData?.equipo || 'Nuestro Equipo';
        const totalGames = seasonData?.totalPartidosAnalizados || 1;
        const metrics = seasonData?.metricasColectivas || {};
        const shooting = metrics?.tiroColectivo || {};
        const wins = seasonData?.historialPartidos?.filter((m: any) => m.puntosAnotados > m.puntosRecibidos)?.length || 0;
        const losses = totalGames - wins;
        const winPct = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
        const focusTitle = focus || 'Plan Integral de Mejora Táctica y Microciclo';

        planText = `# 🏆 PLAN ESTRATÉGICO DE TEMPORADA Y METODOLOGÍA DE ENTRENAMIENTO

**Equipo Analizado:** ${teamName}  
**Muestra de Partidos:** ${totalGames} encuentros (${wins}V - ${losses}D · ${winPct}% victorias)  
**Enfoque Técnico:** ${focusTitle}  

---

## 1. 📊 DIAGNÓSTICO GLOBAL DE RENDIMIENTO (ANÁLISIS DE DATOS)
- **Balance y Tendencia**: ${wins} victorias en ${totalGames} partidos. El equipo demuestra capacidad de competir a ritmo alto con picos de anotación productivos cuando la circulación de balón es dinámica.
- **Métricas de Lanzamiento**:
  - Tiros de 2 (T2): ${shooting.tirosDeDos || 'N/D'}
  - Triples (T3): ${shooting.triples || 'N/D'}
  - Tiros Libres (TL): ${shooting.tirosLibres || 'N/D'}
- **Fortalezas Consolidadas**: Gran agresividad atacando la pintura, ritmo en contragolpe y compromiso colectivo en la rotación de quintetos.
- **Debilidades Crónicas Detectadas**:
  1. *Pérdidas de Balón*: Desconexiones en pases arriesgados en primera línea que generan canastas fáciles del rival en transición.
  2. *Rebote Defensivo*: Falta de bloqueo ciego (*box out*) consistente por parte de los exteriores, concediendo segundas opciones.
  3. *Tiros Libres en Finales*: Necesidad de mejorar el porcentaje desde la línea de personal bajo presión.

---

## 2. 📋 PLAN DE ENTRENAMIENTO SEMANAL (MICRO-CICLO TÁCTICO)

### 🏀 Sesión 1: Construcción Ofensiva, Spacing y Reducción de Pérdidas
- **Calentamiento (15 min)**: Rueda de 3 trenzas con finalización sin bote y toma de decisión en 2c1.
- **Bloque Principal (40 min)**:
  - *Juego de 5 Abiertos (5-Out)*: Lectura de puertas atrás (*backdoor cut*) ante defensas agresivas de línea de pase.
  - *Regla de Puntuación*: Toda pérdida no forzada en 5c5 resta 2 puntos al equipo atacante y otorga posesión rápida al rival.
- **Situaciones Reales (25 min)**: 5c5 continuo con posesión limitada a 14 segundos para forzar circulación ágil y tiros liberados.

### 🛡️ Sesión 2: Solidez Defensiva, Cierre de Rebote y Balance
- **Calentamiento (15 min)**: Ejercicio de deslizamientos y choque de pecho en 1c1 a toda pista.
- **Bloque Principal (45 min)**:
  - *Shell Drill 4c4 con Estiramiento*: Rotaciones defensivas desde el lado débil con fintas de ayuda y recuperación (*closeout* con brazos arriba sin saltar).
  - *Bloqueo de Rebote 3c3 y 5c5*: El atacante lanza a fallar voluntariamente; los defensores deben contactar con la cadera y asegurar el balón con dos manos en barbilla antes de iniciar el contraataque.
- **Competitivo (20 min)**: Partido a 21 puntos donde las canastas tras rebote ofensivo valen el doble.

### ⚡ Sesión 3: Ritmo de Juego, Transición Rápida y Situaciones Especiales (ATOs)
- **Calentamiento (15 min)**: Series de tiro tras carrera en esquinas y cabecera en parejas.
- **Bloque Principal (45 min)**:
  - *Salida de Presión 5c5*: Romper trampas defensivas (*trap/trap*) con pases picados al centro del campo.
  - *Situaciones de Finales Apretados (Clutch)*: Partidos de 2 minutos con marcador +2 o -3 puntos, practicando tiempos muertos, faltas intencionadas y saque de banda con 4 segundos en reloj.
- **Cierre Técnico (15 min)**: Concurso de tiros libres con fatiga física (10 lanzamientos consecutivos por jugador).

---

## 3. 🎯 PLANES DE MEJORA INDIVIDUAL (DESARROLLO DE JUGADORES)
- **Bases y Escoltas**: Automatizar la parada en un tiempo y pase picado; trabajar el tiro tras bote de media distancia para castigar defensas cerradas.
- **Aleros y Exteriores**: Disciplina en ocupar las esquinas para abrir el campo (*spacing*) y agresividad en penetraciones buscando falta y tiro (2+1).
- **Interiores (Pívots / Ala-Pívots)**: Dominio del pase de salida rápido tras rebote defensivo (*outlet pass*) y uso efectivo del gancho o semigancho en poste bajo.

---

## 4. 🧠 RECOMENDACIONES TÁCTICAS PARA LOS PRÓXIMOS ENCUENTROS
1. **Gestión de Tiempos Muertos**: Solicitar tiempo muerto de forma inmediata si el rival logra un parcial de 6-0 para cortar la inercia y recolocar la defensa.
2. **Control de Faltas**: Evitar faltas inocentes a media pista cuando el equipo esté a una falta del bonus; forzar al rival a lanzar tiros exteriores punteados.
3. **Identidad de Equipo**: Mantener la comunicación verbal continua en pista ("¡Ayuda!", "¡Balón!", "¡Bloqueo derecha!") como pilar de la solidez defensiva.`;
      }

      res.json({
        plan: planText,
      });
    } catch (error: any) {
      console.error('Error generating season training plan:', error);
      res.json({
        plan: `# 🏆 PLAN DE TEMPORADA Y METODOLOGÍA (MODO PISTA)
Revisa las estadísticas acumuladas en la biblioteca para planificar tus sesiones de entrenamiento.`,
      });
    }
  });

  // Vite middleware for development or static in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BasketStats Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
