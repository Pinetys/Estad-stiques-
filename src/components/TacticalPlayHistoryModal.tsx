import React, { useState, useMemo } from 'react';
import { TacticalPlay, PlayCategory } from '../types/tactical';
import {
  X,
  Search,
  BookOpen,
  Trash2,
  Copy,
  FolderOpen,
  Plus,
  Calendar,
  Layers,
  ArrowRight,
  Download,
  Upload,
  RefreshCw,
  Check,
  AlertTriangle,
} from 'lucide-react';

interface TacticalPlayHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  plays: TacticalPlay[];
  onSelectPlay: (play: TacticalPlay) => void;
  onDeletePlay: (playId: string) => void;
  onDuplicatePlay: (play: TacticalPlay) => void;
  onResetDefaultPlays: () => void;
  onImportPlays?: (imported: TacticalPlay[]) => void;
  currentPlayId?: string;
}

const CATEGORY_LABELS: Record<PlayCategory, { label: string; color: string }> = {
  ataque: { label: 'Ataque', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  defensa: { label: 'Defensa', color: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
  fondo: { label: 'Saque Fondo', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  banda: { label: 'Saque Banda', color: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
  transicion: { label: 'Transición', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' },
  especial: { label: 'Especial / ATO', color: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
};

export const TacticalPlayHistoryModal: React.FC<TacticalPlayHistoryModalProps> = ({
  isOpen,
  onClose,
  plays,
  onSelectPlay,
  onDeletePlay,
  onDuplicatePlay,
  onResetDefaultPlays,
  onImportPlays,
  currentPlayId,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Filter plays
  const filteredPlays = useMemo(() => {
    return plays
      .filter(p => {
        const matchesCat = selectedCategory === 'all' || p.category === selectedCategory;
        const matchesQuery =
          !searchQuery.trim() ||
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
          p.frames.some(f => f.title.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchesCat && matchesQuery;
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [plays, selectedCategory, searchQuery]);

  if (!isOpen) return null;

  // Export playbook as JSON file
  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(plays, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `playbook_tactico_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    setFeedbackMsg('Playbook exportado en JSON correctamente');
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  // Import playbook from JSON
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].frames) {
          if (onImportPlays) {
            onImportPlays(parsed);
            setFeedbackMsg(`Se importaron ${parsed.length} jugadas con éxito`);
            setTimeout(() => setFeedbackMsg(null), 3000);
          }
        } else {
          alert('El archivo no contiene un formato válido de jugadas tácticas.');
        }
      } catch (err) {
        alert('Error al leer el archivo JSON.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tactical-history-title"
    >
      <div className="bg-[#0b142e] border border-blue-800/80 rounded-2xl shadow-2xl flex flex-col w-full max-w-4xl h-[92vh] max-h-[820px] overflow-hidden">
        {/* Header */}
        <div className="h-14 bg-gradient-to-r from-[#0d1b3e] via-[#122352] to-[#0d1b3e] border-b border-blue-900/80 px-4 flex items-center justify-between gap-3 shrink-0 select-none">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2
                id="tactical-history-title"
                className="text-sm sm:text-base font-black text-white uppercase tracking-wider truncate flex items-center gap-2"
              >
                <span>Historial de Jugadas Tácticas</span>
                <span className="text-xs font-mono font-bold text-amber-400 bg-amber-950/60 border border-amber-800/60 px-2 py-0.5 rounded-full">
                  {plays.length} {plays.length === 1 ? 'jugada' : 'jugadas'}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 truncate">
                Biblioteca de jugadas con diagramas multi-gráfico y fases
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Backup Export/Import */}
            <button
              type="button"
              onClick={handleExportJSON}
              className="p-1.5 sm:px-2.5 sm:py-1 rounded-lg bg-blue-950 hover:bg-blue-900 text-slate-200 border border-blue-800/70 text-xs font-semibold flex items-center gap-1.5 transition"
              title="Exportar todas las jugadas en archivo JSON"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Exportar</span>
            </button>

            <label
              className="p-1.5 sm:px-2.5 sm:py-1 rounded-lg bg-blue-950 hover:bg-blue-900 text-slate-200 border border-blue-800/70 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition"
              title="Importar archivo JSON con jugadas"
            >
              <Upload className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Importar</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImportJSON}
                className="hidden"
              />
            </label>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
              title="Cerrar (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feedback message banner if any */}
        {feedbackMsg && (
          <div className="bg-emerald-950/80 border-b border-emerald-700 px-4 py-1.5 text-xs text-emerald-200 flex items-center justify-between animate-in fade-in">
            <span className="flex items-center gap-1.5 font-bold">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              {feedbackMsg}
            </span>
            <button
              type="button"
              onClick={() => setFeedbackMsg(null)}
              className="text-emerald-400 hover:text-white text-xs font-mono"
            >
              ✕
            </button>
          </div>
        )}

        {/* Search & Category Filter Bar */}
        <div className="p-3 bg-[#081024] border-b border-blue-950 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 shrink-0">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar jugada por nombre, gráfico o notas..."
              className="w-full pl-9 pr-8 py-1.5 rounded-xl bg-[#0e1a3c] border border-blue-900/80 text-white text-xs placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                selectedCategory === 'all'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'bg-blue-950/80 text-slate-300 hover:bg-blue-900'
              }`}
            >
              Todas ({plays.length})
            </button>

            {(Object.keys(CATEGORY_LABELS) as PlayCategory[]).map(catKey => {
              const count = plays.filter(p => p.category === catKey).length;
              if (count === 0 && selectedCategory !== catKey) return null;
              return (
                <button
                  key={catKey}
                  type="button"
                  onClick={() => setSelectedCategory(catKey)}
                  className={`px-2 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition flex items-center gap-1 ${
                    selectedCategory === catKey
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'bg-blue-950/60 text-slate-300 hover:bg-blue-900'
                  }`}
                >
                  <span>{CATEGORY_LABELS[catKey].label}</span>
                  <span className="text-[10px] opacity-75 font-mono">({count})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Play List Container */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-3">
          {filteredPlays.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <div className="w-14 h-14 rounded-2xl bg-blue-950/60 border border-blue-900 flex items-center justify-center text-slate-500 mb-3">
                <BookOpen className="w-7 h-7" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-white mb-1">
                {searchQuery ? 'No se encontraron jugadas' : 'No hay jugadas guardadas'}
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mb-4">
                {searchQuery
                  ? `No hay jugadas que coincidan con "${searchQuery}". Prueba a limpiar el filtro de búsqueda.`
                  : 'Guarda jugadas desde la pizarra táctica asignándoles un nombre y añadiendo los gráficos necesarios.'}
              </p>

              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-blue-900 hover:bg-blue-800 text-white text-xs font-semibold"
                >
                  Restablecer filtros
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onResetDefaultPlays}
                  className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition"
                >
                  <RefreshCw className="w-4 h-4" />
                  Cargar jugadas de ejemplo (Cuernos, Fondo ATO, etc.)
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredPlays.map(play => {
                const isCurrentActive = currentPlayId === play.id;
                const catInfo = CATEGORY_LABELS[play.category] || CATEGORY_LABELS.ataque;
                const frameCount = play.frames?.length || 1;
                const dateFormatted = new Date(play.updatedAt).toLocaleDateString('es-ES', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                const isConfirmingDelete = deleteConfirmId === play.id;

                return (
                  <div
                    key={play.id}
                    className={`bg-[#0d1838] border rounded-xl p-3.5 flex flex-col justify-between transition-all duration-150 hover:border-blue-700 shadow-md relative group ${
                      isCurrentActive
                        ? 'border-amber-500/80 ring-1 ring-amber-500/40 bg-gradient-to-br from-[#101e47] to-[#0c1633]'
                        : 'border-blue-900/60'
                    }`}
                  >
                    <div>
                      {/* Top row: Name & Badges */}
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border ${catInfo.color}">
                              {catInfo.label}
                            </span>
                            {isCurrentActive && (
                              <span className="text-[10px] font-mono font-bold bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded">
                                EN PIZARRA
                              </span>
                            )}
                          </div>
                          <h4 className="text-sm sm:text-base font-black text-white truncate mt-1 leading-snug">
                            {play.name}
                          </h4>
                        </div>
                      </div>

                      {/* Description if present */}
                      {play.description && (
                        <p className="text-xs text-slate-300 line-clamp-2 mb-2 leading-relaxed">
                          {play.description}
                        </p>
                      )}

                      {/* Frames summary pills */}
                      <div className="bg-[#081024] p-2 rounded-lg border border-blue-950 mb-3 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-mono text-slate-300">
                          <span className="flex items-center gap-1.5 text-amber-400 font-bold">
                            <Layers className="w-3.5 h-3.5" />
                            {frameCount} {frameCount === 1 ? 'Gráfico' : 'Gráficos / Fases'}
                          </span>
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-500" />
                            {dateFormatted}
                          </span>
                        </div>

                        {/* Frame sequence tags */}
                        <div className="flex flex-wrap gap-1">
                          {play.frames.map((frame, idx) => (
                            <span
                              key={frame.id || idx}
                              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-950 border border-blue-900/80 text-cyan-300 truncate max-w-[170px]"
                              title={frame.notes || frame.title}
                            >
                              {idx + 1}. {frame.title || `Gráfico ${idx + 1}`}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Buttons */}
                    <div className="pt-2 border-t border-blue-950 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onDuplicatePlay(play)}
                          className="p-1.5 rounded-lg bg-blue-950/90 hover:bg-blue-900 text-slate-300 hover:text-white border border-blue-800/60 transition"
                          title="Duplicar jugada"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>

                        {isConfirmingDelete ? (
                          <div className="flex items-center gap-1 animate-in fade-in">
                            <button
                              type="button"
                              onClick={() => {
                                onDeletePlay(play.id);
                                setDeleteConfirmId(null);
                              }}
                              className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold"
                            >
                              Confirmar
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(null)}
                              className="px-1.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px]"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(play.id)}
                            className="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-300 hover:text-rose-100 border border-rose-900/60 transition"
                            title="Eliminar jugada del historial"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          onSelectPlay(play);
                          onClose();
                        }}
                        className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition shadow-sm active:scale-95 ${
                          isCurrentActive
                            ? 'bg-amber-600 hover:bg-amber-500 text-white'
                            : 'bg-blue-600 hover:bg-blue-500 text-white'
                        }`}
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        <span>{isCurrentActive ? 'Continuar en Pizarra' : 'Cargar en Pizarra'}</span>
                        <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="h-12 bg-[#081024] border-t border-blue-950 px-4 flex items-center justify-between gap-2 shrink-0 text-xs text-slate-400 select-none">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onResetDefaultPlays}
              className="text-slate-400 hover:text-cyan-300 transition flex items-center gap-1 text-[11px]"
              title="Restablecer jugadas iniciales de baloncesto"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Restaurar jugadas de muestra</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
