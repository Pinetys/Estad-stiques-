import React, { useState } from 'react';
import { Game, GameSettings } from '../types';
import { OPPONENT_TEAMS } from '../data/defaultData';
import { TeamLogoDisplay, TeamLogoPickerModal } from './TeamLogoPicker';
import { PlusCircle, Settings, Volume2, VolumeX, Smartphone, Sparkles, Check, ZapOff, Camera, Image, Crosshair } from 'lucide-react';
import { playSound } from '../utils/soundHaptics';

interface NewGameModalProps {
  currentGame: Game;
  onClose: () => void;
  onStartNewGame: (newGameConfig: {
    homeTeamName: string;
    awayTeamName: string;
    homeTeamLogo?: string;
    awayTeamLogo?: string;
    settings: GameSettings;
  }) => void;
}

export const NewGameModal: React.FC<NewGameModalProps> = ({
  currentGame,
  onClose,
  onStartNewGame,
}) => {
  const [homeTeam, setHomeTeam] = useState(currentGame.homeTeamName);
  const [awayTeam, setAwayTeam] = useState(currentGame.awayTeamName);
  const [homeLogo, setHomeLogo] = useState<string | undefined>(currentGame.homeTeamLogo);
  const [awayLogo, setAwayLogo] = useState<string | undefined>(currentGame.awayTeamLogo);
  const [editingLogoTeam, setEditingLogoTeam] = useState<'home' | 'away' | null>(null);

  const [quarterDuration, setQuarterDuration] = useState(currentGame.settings.quarterDurationMinutes);
  const [foulOutLimit, setFoulOutLimit] = useState(currentGame.settings.foulOutLimit);
  const [soundEnabled, setSoundEnabled] = useState(currentGame.settings.soundEnabled);
  const [vibrationEnabled, setVibrationEnabled] = useState(currentGame.settings.vibrationEnabled);
  const [assistPromptEnabled, setAssistPromptEnabled] = useState(
    currentGame.settings.assistPromptEnabled
  );
  const [shotChartAutoOpen, setShotChartAutoOpen] = useState<'baskets' | 'all' | 'off'>(
    currentGame.settings.shotChartAutoOpen || 'baskets'
  );
  const [courtMode, setCourtMode] = useState(currentGame.settings.courtMode || false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!homeTeam.trim() || !awayTeam.trim()) return;

    onStartNewGame({
      homeTeamName: homeTeam.trim(),
      awayTeamName: awayTeam.trim(),
      homeTeamLogo: homeLogo,
      awayTeamLogo: awayLogo,
      settings: {
        ...currentGame.settings,
        quarterDurationMinutes: quarterDuration,
        foulOutLimit,
        soundEnabled,
        vibrationEnabled,
        assistPromptEnabled,
        shotChartAutoOpen,
        courtMode,
      },
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2.5 animate-in fade-in">
      <div className="bg-[#1A1D23] border border-gray-800 rounded max-w-md w-full p-3.5 shadow-2xl space-y-3 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-gray-800">
          <div className="flex items-center gap-1.5">
            <PlusCircle className="w-4 h-4 text-orange-500" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-100">Nuevo Partido de Baloncesto</h2>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded bg-[#14161B] hover:bg-gray-800 text-gray-300 flex items-center justify-center text-xs font-bold border border-gray-700"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2.5">
          {/* Teams input & Logo Selectors */}
          <div className="space-y-2">
            {/* Home Team */}
            <div className="bg-[#14161B] p-2.5 rounded border border-gray-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] uppercase font-mono font-bold text-orange-400">
                  Tu Equipo (Local):
                </label>
                <button
                  type="button"
                  onClick={() => setEditingLogoTeam('home')}
                  className="text-[10px] text-gray-300 hover:text-orange-400 flex items-center gap-1 font-mono font-semibold"
                >
                  <Camera className="w-3 h-3 text-orange-400" />
                  <span>{homeLogo ? 'Cambiar Logo' : 'Añadir Logo / Foto'}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div
                  onClick={() => setEditingLogoTeam('home')}
                  className="cursor-pointer hover:opacity-80 transition"
                  title="Cambiar logo o hacer foto"
                >
                  <TeamLogoDisplay logo={homeLogo} teamName={homeTeam} size="md" />
                </div>
                <input
                  type="text"
                  value={homeTeam}
                  onChange={e => setHomeTeam(e.target.value)}
                  className="grow bg-[#0F1115] border border-gray-700 rounded px-2.5 py-1.5 text-xs text-gray-100 font-semibold focus:outline-none focus:border-orange-500"
                  placeholder="Nombre de tu equipo"
                  required
                />
              </div>
            </div>

            {/* Away Team */}
            <div className="bg-[#14161B] p-2.5 rounded border border-gray-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] uppercase font-mono font-bold text-sky-400">
                  Equipo Rival (Visitante):
                </label>
                <button
                  type="button"
                  onClick={() => setEditingLogoTeam('away')}
                  className="text-[10px] text-gray-300 hover:text-sky-400 flex items-center gap-1 font-mono font-semibold"
                >
                  <Camera className="w-3 h-3 text-sky-400" />
                  <span>{awayLogo ? 'Cambiar Logo' : 'Añadir Logo / Foto'}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div
                  onClick={() => setEditingLogoTeam('away')}
                  className="cursor-pointer hover:opacity-80 transition"
                  title="Cambiar logo o hacer foto"
                >
                  <TeamLogoDisplay logo={awayLogo} teamName={awayTeam} size="md" />
                </div>
                <input
                  type="text"
                  value={awayTeam}
                  onChange={e => setAwayTeam(e.target.value)}
                  className="grow bg-[#0F1115] border border-gray-700 rounded px-2.5 py-1.5 text-xs text-gray-100 font-semibold focus:outline-none focus:border-orange-500"
                  placeholder="Nombre del rival"
                  required
                />
              </div>

              {/* Quick rival suggestions */}
              <div className="flex items-center gap-1 flex-wrap mt-1">
                <span className="text-[9px] uppercase font-mono text-gray-400">Sugerencias:</span>
                {OPPONENT_TEAMS.slice(0, 4).map(team => (
                  <button
                    key={team}
                    type="button"
                    onClick={() => setAwayTeam(team)}
                    className="text-[9px] bg-[#0F1115] hover:bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded border border-gray-800 font-mono"
                  >
                    {team}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Logo Picker Modal */}
          {editingLogoTeam && (
            <TeamLogoPickerModal
              teamName={editingLogoTeam === 'home' ? homeTeam : awayTeam}
              currentLogo={editingLogoTeam === 'home' ? homeLogo : awayLogo}
              onSaveLogo={logo => {
                if (editingLogoTeam === 'home') setHomeLogo(logo);
                else setAwayLogo(logo);
                setEditingLogoTeam(null);
              }}
              onClose={() => setEditingLogoTeam(null)}
            />
          )}

          {/* Match rules settings */}
          <div className="pt-2 border-t border-gray-800 space-y-2">
            <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider block">
              Reglas y Duración del Partido:
            </span>

            {/* Quarter duration selector */}
            <div>
              <label className="text-[10px] uppercase font-mono text-gray-300 block mb-1">
                Duración por Cuarto:
              </label>
              <div className="grid grid-cols-4 gap-1">
                {[
                  { mins: 10, label: '10m (FIBA)' },
                  { mins: 8, label: '8m (Escolar)' },
                  { mins: 12, label: '12m (NBA)' },
                  { mins: 5, label: '5m (Mini)' },
                ].map(opt => (
                  <button
                    key={opt.mins}
                    type="button"
                    onClick={() => setQuarterDuration(opt.mins)}
                    className={`py-1.5 px-1 text-center rounded text-xs font-mono font-bold border transition ${
                      quarterDuration === opt.mins
                        ? 'bg-orange-600 border-orange-400 text-white'
                        : 'bg-[#14161B] border-gray-800 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Foul out limit */}
            <div>
              <label className="text-[10px] uppercase font-mono text-gray-300 block mb-1">
                Límite de Faltas para Expulsión:
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setFoulOutLimit(5)}
                  className={`py-1.5 rounded text-xs font-mono font-bold border transition ${
                    foulOutLimit === 5
                      ? 'bg-orange-600 border-orange-400 text-white'
                      : 'bg-[#14161B] border-gray-800 text-gray-400'
                  }`}
                >
                  5 Faltas (FIBA / FEB)
                </button>
                <button
                  type="button"
                  onClick={() => setFoulOutLimit(6)}
                  className={`py-1.5 rounded text-xs font-mono font-bold border transition ${
                    foulOutLimit === 6
                      ? 'bg-orange-600 border-orange-400 text-white'
                      : 'bg-[#14161B] border-gray-800 text-gray-400'
                  }`}
                >
                  6 Faltas (NBA)
                </button>
              </div>
            </div>

            {/* Quick Experience Toggles */}
            <div className="space-y-1.5 pt-1.5 border-t border-gray-800">
              <label className="flex items-center justify-between text-xs text-gray-200 cursor-pointer">
                <span className="flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-orange-400" />
                  Efectos de Sonido (Canasta, Silbato, Bocina)
                </span>
                <input
                  type="checkbox"
                  checked={soundEnabled}
                  onChange={e => setSoundEnabled(e.target.checked)}
                  className="rounded bg-[#14161B] border-gray-700 text-orange-500 focus:ring-orange-500 w-3.5 h-3.5"
                />
              </label>

              <label className="flex items-center justify-between text-xs text-gray-200 cursor-pointer">
                <span className="flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-orange-400" />
                  Vibración Háptica en Móvil
                </span>
                <input
                  type="checkbox"
                  checked={vibrationEnabled}
                  onChange={e => setVibrationEnabled(e.target.checked)}
                  className="rounded bg-[#14161B] border-gray-700 text-orange-500 focus:ring-orange-500 w-3.5 h-3.5"
                />
              </label>

              <label className="flex items-center justify-between text-xs text-gray-200 cursor-pointer">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                  Preguntar Asistente tras Canasta
                </span>
                <input
                  type="checkbox"
                  checked={assistPromptEnabled}
                  onChange={e => setAssistPromptEnabled(e.target.checked)}
                  className="rounded bg-[#14161B] border-gray-700 text-orange-500 focus:ring-orange-500 w-3.5 h-3.5"
                />
              </label>

              {/* Auto-Open Shot Chart Setting */}
              <div className="bg-[#14161B] p-2 rounded border border-gray-800 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-gray-200">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Crosshair className="w-3.5 h-3.5 text-orange-400" />
                    Abrir Carta de Tiro al Anotar
                  </span>
                  <span className="text-[10px] text-orange-400 font-mono font-bold">1 Paso</span>
                </div>
                <div className="grid grid-cols-3 gap-1 text-[11px] font-mono">
                  <button
                    type="button"
                    onClick={() => setShotChartAutoOpen('baskets')}
                    className={`py-1 px-1.5 rounded text-center transition font-bold ${
                      shotChartAutoOpen === 'baskets'
                        ? 'bg-orange-600 text-white shadow'
                        : 'bg-[#1D2027] text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    Canastas
                  </button>
                  <button
                    type="button"
                    onClick={() => setShotChartAutoOpen('all')}
                    className={`py-1 px-1.5 rounded text-center transition font-bold ${
                      shotChartAutoOpen === 'all'
                        ? 'bg-orange-600 text-white shadow'
                        : 'bg-[#1D2027] text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => setShotChartAutoOpen('off')}
                    className={`py-1 px-1.5 rounded text-center transition font-bold ${
                      shotChartAutoOpen === 'off'
                        ? 'bg-orange-600 text-white shadow'
                        : 'bg-[#1D2027] text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    Desactivado
                  </button>
                </div>
              </div>

              <label className="flex items-center justify-between text-xs text-emerald-300 font-semibold bg-emerald-950/40 p-2 rounded border border-emerald-800/60 cursor-pointer">
                <div className="flex flex-col">
                  <span className="flex items-center gap-1.5">
                    <ZapOff className="w-3.5 h-3.5 text-emerald-400" />
                    Modo Pista (Ahorro Batería)
                  </span>
                  <span className="text-[10px] text-emerald-400/80 font-normal">
                    Atenúa colores y desactiva animaciones no críticas
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={courtMode}
                  onChange={e => setCourtMode(e.target.checked)}
                  className="rounded bg-[#14161B] border-gray-700 text-emerald-500 focus:ring-emerald-500 w-4 h-4 ml-2"
                />
              </label>
            </div>
          </div>

          <div className="pt-1.5 flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="w-1/3 py-2 bg-[#14161B] hover:bg-gray-800 text-gray-300 font-bold rounded text-xs border border-gray-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="w-2/3 py-2 bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white font-extrabold rounded text-xs shadow flex items-center justify-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Comenzar Partido</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
