import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

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
    res.json({ status: 'ok' });
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

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: prompt,
      });

      res.json({
        report: response.text || 'No se pudo generar el informe.',
      });
    } catch (error: any) {
      console.error('Error generating AI coach report:', error);
      res.status(500).json({
        error: error.message || 'Error al generar el análisis táctico con IA',
      });
    }
  });

  // AI Season & Multi-Match Training Plan endpoint
  app.post('/api/season-training-plan', async (req, res) => {
    try {
      const ai = getGeminiClient();
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

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: prompt,
      });

      res.json({
        plan: response.text || 'No se pudo generar el plan de entrenamiento.',
      });
    } catch (error: any) {
      console.error('Error generating season training plan:', error);
      res.status(500).json({
        error: error.message || 'Error al generar el plan de temporada con IA',
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
