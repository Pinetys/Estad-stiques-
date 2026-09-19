import React, { useState } from 'react';
import {
  AlertTriangle,
  Play,
  Pause,
  X,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  ArrowRight,
  Flame,
  Award,
  Users,
} from 'lucide-react';
import { Player, Game } from '../types';
import { playSound } from '../utils/soundHaptics';

export interface FoulModalData {
  isOpponentFoul: boolean;
  player?: Player;
  foulType?: 'PF' | 'PFT' | 'UF' | 'TF' | 'DISQ' | 'OPP_FOUL';
}

interface FoulResolutionModalProps {
  game: Game;
  foulData: FoulModalData;
  onClose: () => void;
  onResumeClock: () => void;
  onRecordFreeThrow: (params: {
    isOpponent: boolean;
    playerId?: string;
    made: boolean;
  }) => void;
}

export const FoulResolutionModal: React.FC<FoulResolutionModalProps> = ({
  game,
  foulData,
  onClose,
  onResumeClock,
  onRecordFreeThrow,
}) => {
  const { isOpponentFoul, player } = foulData;
  const isBonusActive = isOpponentFoul
    ? (game.awayQuarterFouls || 0) >= (game.settings.bonusFoulsLimit || 5)
    : (game.homeQuarterFouls || 0) >= (game.settings.bonusFoulsLimit || 5);

  const [freeThrowType, setFreeThrowType] = useState<0 | 1 | 2 | 3>(isBonusActive ? 2 : 0);
  const [hasSelectedOption, setHasSelectedOption] = useState<boolean>(isBonusActive);

  // Free throws tracking
  const [selectedShooterId, setSelectedShooterId] = useState<string>(() => {
    if (isOpponentFoul) {
      const onCourt = game.players.filter(p => p.onCourt);
      return onCourt[0]?.id || game.players[0]?.id || '';
    }
    return '';
  });

  const [shotResults, setShotResults] = useState<Array<'made' | 'missed' | null>>([null, null, null]);

  const handleFTResult = (index: number, result: 'made' | 'missed') => {
    const updated = [...shotResults];
    updated[index] = result;
    setShotResults(updated);

    onRecordFreeThrow({
      isOpponent: !isOpponentFoul,
      playerId: isOpponentFoul ? selectedShooterId : undefined,
      made: result === 'made',
    });

    playSound(result === 'made' ? 'score' : 'click', game.settings.soundEnabled);
  };

  const currentFouls = player ? player.foulsCount : 0;
  const isFouledOut = currentFouls >= (game.settings.foulOutLimit || 5);
  const isWarningFoul = currentFouls === (game.settings.foulOutLimit || 5) - 1;

  const onCourtPlayers = game.players.filter(p => p.onCourt);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl overflow-hidden text-neutral-100 flex flex-col">
        
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-neutral-950/80 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-wide">
                  Falta Señalada • Reloj Parado
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/30">
                  TIEMPO DETENIDO
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                El tiempo de partido se ha detenido automáticamente conforme al reglamento FIBA
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              playSound('click', game.settings.soundEnabled);
              onClose();
            }}
            className="w-8 h-8 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Foul Details Card */}
        <div className="p-4 bg-neutral-850 border-b border-neutral-800/80 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-bold text-white">
                {isOpponentFoul
                  ? `Falta del Rival (${game.awayTeamName || 'Equipo Oponente'})`
                  : `Falta de #${player?.number} ${player?.name || 'Jugador'}`}
              </span>
            </div>

            {!isOpponentFoul && player && (
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  isFouledOut
                    ? 'bg-red-600 text-white animate-pulse'
                    : isWarningFoul
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-neutral-800 text-neutral-300'
                }`}
              >
                {currentFouls}ª Falta {isFouledOut ? '• ¡EXPULSADO!' : isWarningFoul ? '• ¡Alerta 4ª!' : ''}
              </span>
            )}
          </div>

          {/* Quarter team fouls info */}
          <div className="flex items-center justify-between text-xs text-neutral-400 pt-1">
            <span>
              Faltas de equipo en {game.currentQuarter}C:{' '}
              <strong className="text-white">
                {isOpponentFoul ? game.awayQuarterFouls || 1 : game.homeQuarterFouls || 1} / {game.settings.bonusFoulsLimit || 5}
              </strong>
            </span>
            {isBonusActive && (
              <span className="text-amber-400 font-bold flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-amber-400" /> ¡En Bonus! Tiros libres directos
              </span>
            )}
          </div>
        </div>

        {/* Question: Are there free throws? */}
        <div className="p-5 space-y-4 flex-1">
          <div className="text-center space-y-1">
            <h4 className="text-sm font-bold text-white tracking-wide">
              ¿Es falta con Tiros Libres?
            </h4>
            <p className="text-xs text-neutral-400">
              Selecciona el tipo de sanción para registrar los lanzamientos
            </p>
          </div>

          {/* Options Grid */}
          <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
            <button
              onClick={() => {
                setFreeThrowType(0);
                setHasSelectedOption(true);
                playSound('click', game.settings.soundEnabled);
              }}
              className={`p-3 rounded-xl border text-left transition flex flex-col justify-between gap-1 ${
                freeThrowType === 0 && hasSelectedOption
                  ? 'bg-blue-600/30 border-blue-500 text-white ring-1 ring-blue-500'
                  : 'bg-neutral-800/80 border-neutral-700 hover:border-neutral-600 text-neutral-300'
              }`}
            >
              <span className="font-bold text-xs sm:text-sm">Sin Tiros Libres</span>
              <span className="text-[11px] text-neutral-400">Saque de banda / fondo</span>
            </button>

            <button
              onClick={() => {
                setFreeThrowType(1);
                setHasSelectedOption(true);
                setShotResults([null, null, null]);
                playSound('click', game.settings.soundEnabled);
              }}
              className={`p-3 rounded-xl border text-left transition flex flex-col justify-between gap-1 ${
                freeThrowType === 1 && hasSelectedOption
                  ? 'bg-amber-600/30 border-amber-500 text-white ring-1 ring-amber-500'
                  : 'bg-neutral-800/80 border-neutral-700 hover:border-neutral-600 text-neutral-300'
              }`}
            >
              <span className="font-bold text-xs sm:text-sm">1 Tiro Libre</span>
              <span className="text-[11px] text-neutral-400">Canasta y tiro adicional (2+1 o Técnica)</span>
            </button>

            <button
              onClick={() => {
                setFreeThrowType(2);
                setHasSelectedOption(true);
                setShotResults([null, null, null]);
                playSound('click', game.settings.soundEnabled);
              }}
              className={`p-3 rounded-xl border text-left transition flex flex-col justify-between gap-1 ${
                freeThrowType === 2 && hasSelectedOption
                  ? 'bg-amber-600/30 border-amber-500 text-white ring-1 ring-amber-500'
                  : 'bg-neutral-800/80 border-neutral-700 hover:border-neutral-600 text-neutral-300'
              }`}
            >
              <span className="font-bold text-xs sm:text-sm">2 Tiros Libres</span>
              <span className="text-[11px] text-neutral-400">Falta en tiro de 2 pts o Bonus</span>
            </button>

            <button
              onClick={() => {
                setFreeThrowType(3);
                setHasSelectedOption(true);
                setShotResults([null, null, null]);
                playSound('click', game.settings.soundEnabled);
              }}
              className={`p-3 rounded-xl border text-left transition flex flex-col justify-between gap-1 ${
                freeThrowType === 3 && hasSelectedOption
                  ? 'bg-amber-600/30 border-amber-500 text-white ring-1 ring-amber-500'
                  : 'bg-neutral-800/80 border-neutral-700 hover:border-neutral-600 text-neutral-300'
              }`}
            >
              <span className="font-bold text-xs sm:text-sm">3 Tiros Libres</span>
              <span className="text-[11px] text-neutral-400">Falta en tiro triple (3 pts)</span>
            </button>
          </div>

          {/* Interactive Free Throws Logger if type > 0 */}
          {freeThrowType > 0 && (
            <div className="p-3.5 rounded-xl bg-neutral-950/70 border border-amber-500/30 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-amber-300">
                  {isOpponentFoul ? 'Lanza Tiro(s) Nuestro Jugador:' : `Lanza Tiro(s) el Rival (${game.awayTeamName}):`}
                </span>
                <span className="text-neutral-400">
                  {freeThrowType} lanzamiento{freeThrowType > 1 ? 's' : ''}
                </span>
              </div>

              {/* Shooter selection for home team */}
              {isOpponentFoul && (
                <div>
                  <label className="block text-[11px] text-neutral-400 mb-1">
                    Selecciona el tirador de tiros libres:
                  </label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {onCourtPlayers.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedShooterId(p.id)}
                        className={`p-1.5 rounded-lg text-xs font-bold border transition ${
                          selectedShooterId === p.id
                            ? 'bg-amber-500 text-black border-amber-400 shadow'
                            : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:border-neutral-500'
                        }`}
                      >
                        #{p.number}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Shot Buttons */}
              <div className="space-y-2 pt-1">
                {Array.from({ length: freeThrowType }).map((_, idx) => {
                  const res = shotResults[idx];
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-lg bg-neutral-800/80 border border-neutral-700"
                    >
                      <span className="text-xs font-bold text-neutral-300">
                        Tiro Libre {idx + 1}:
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleFTResult(idx, 'made')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition active:scale-95 ${
                            res === 'made'
                              ? 'bg-emerald-600 text-white shadow ring-2 ring-emerald-400'
                              : 'bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-700'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> +1 Anotado
                        </button>

                        <button
                          type="button"
                          onClick={() => handleFTResult(idx, 'missed')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition active:scale-95 ${
                            res === 'missed'
                              ? 'bg-red-600 text-white shadow ring-2 ring-red-400'
                              : 'bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-700'
                          }`}
                        >
                          <XCircle className="w-3.5 h-3.5" /> Fallado
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Actions with prominent Resume Clock Button */}
        <div className="p-4 bg-neutral-950 border-t border-neutral-800 space-y-2">
          <button
            onClick={() => {
              playSound('foul', game.settings.soundEnabled);
              onResumeClock();
              onClose();
            }}
            className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-900/40 transition active:scale-98 tracking-wide"
          >
            <Play className="w-5 h-5 fill-white" />
            REANUDAR RELOJ Y SEGUIR PARTIDO
          </button>

          <button
            onClick={() => {
              playSound('click', game.settings.soundEnabled);
              onClose();
            }}
            className="w-full py-2 px-3 rounded-lg text-neutral-400 hover:text-white text-xs font-medium text-center transition"
          >
            Cerrar panel (mantener tiempo parado hasta saque)
          </button>
        </div>
      </div>
    </div>
  );
};
