import React from 'react';
import { StatActionType } from '../types';

interface CourtActionConsoleProps {
  onInitiateAction: (actionType: StatActionType) => void;
  isLandscape?: boolean;
}

export const CourtActionConsole: React.FC<CourtActionConsoleProps> = ({
  onInitiateAction,
  isLandscape = false,
}) => {
  if (isLandscape) {
    return (
      <div className="w-full max-w-2xl mx-auto flex flex-col justify-center gap-1.5 sm:gap-2 my-auto select-none">
        {/* SECTION A: SCORING / SHOTS (ORDEN: 3 PUNTOS, 2 PUNTOS, 1 PUNTO) */}
        <div className="grid grid-cols-2 gap-1.5 sm:gap-2 w-full">
          {/* FILA 1: +3 TRIPLE METIDO & FALLO 3P */}
          <button
            id="action-3pm-btn"
            onClick={() => onInitiateAction('3PM')}
            className="bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white font-black rounded-xl py-2 px-3 flex items-center justify-between border border-amber-400 shadow-md active:scale-95 transition min-h-[44px] sm:min-h-[48px]"
          >
            <div className="flex flex-col text-left">
              <span className="text-sm sm:text-base font-black font-mono leading-none">+3 TRIPLE</span>
              <span className="text-[9px] sm:text-[10px] uppercase font-bold text-amber-100 mt-0.5">Triple Metido</span>
            </div>
            <span className="text-lg sm:text-xl font-mono font-black opacity-90 leading-none">+3</span>
          </button>

          <button
            id="action-3pa-btn"
            onClick={() => onInitiateAction('3PA')}
            className="bg-[#181a22] hover:bg-neutral-800 active:bg-neutral-900 text-neutral-200 font-bold rounded-xl py-2 px-3 flex items-center justify-between border border-neutral-700 shadow-sm active:scale-95 transition min-h-[44px] sm:min-h-[48px]"
          >
            <div className="flex flex-col text-left">
              <span className="text-sm sm:text-base font-black font-mono leading-none">FALLO 3P</span>
              <span className="text-[9px] sm:text-[10px] uppercase text-neutral-400 mt-0.5">Errado</span>
            </div>
            <span className="text-xs font-mono text-neutral-500 font-bold">3PA</span>
          </button>

          {/* FILA 2: +2 CANASTA METIDA & FALLO 2P */}
          <button
            id="action-2pm-btn"
            onClick={() => onInitiateAction('2PM')}
            className="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-black rounded-xl py-2 px-3 flex items-center justify-between border border-emerald-400 shadow-md active:scale-95 transition min-h-[44px] sm:min-h-[48px]"
          >
            <div className="flex flex-col text-left">
              <span className="text-sm sm:text-base font-black font-mono leading-none">+2 CANASTA</span>
              <span className="text-[9px] sm:text-[10px] uppercase font-bold text-emerald-100 mt-0.5">Tiro 2 Metido</span>
            </div>
            <span className="text-lg sm:text-xl font-mono font-black opacity-90 leading-none">+2</span>
          </button>

          <button
            id="action-2pa-btn"
            onClick={() => onInitiateAction('2PA')}
            className="bg-[#181a22] hover:bg-neutral-800 active:bg-neutral-900 text-neutral-200 font-bold rounded-xl py-2 px-3 flex items-center justify-between border border-neutral-700 shadow-sm active:scale-95 transition min-h-[44px] sm:min-h-[48px]"
          >
            <div className="flex flex-col text-left">
              <span className="text-sm sm:text-base font-black font-mono leading-none">FALLO 2P</span>
              <span className="text-[9px] sm:text-[10px] uppercase text-neutral-400 mt-0.5">Errado</span>
            </div>
            <span className="text-xs font-mono text-neutral-500 font-bold">2PA</span>
          </button>

          {/* FILA 3: +1 TIRO LIBRE METIDO & FALLO TL */}
          <button
            id="action-ftm-btn"
            onClick={() => onInitiateAction('FTM')}
            className="bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white font-black rounded-xl py-2 px-3 flex items-center justify-between border border-teal-400 shadow-md active:scale-95 transition min-h-[44px] sm:min-h-[48px]"
          >
            <div className="flex flex-col text-left">
              <span className="text-sm sm:text-base font-black font-mono leading-none">+1 T. LIBRE</span>
              <span className="text-[9px] sm:text-[10px] uppercase font-bold text-teal-100 mt-0.5">TL Anotado</span>
            </div>
            <span className="text-lg sm:text-xl font-mono font-black opacity-90 leading-none">+1</span>
          </button>

          <button
            id="action-fta-btn"
            onClick={() => onInitiateAction('FTA')}
            className="bg-[#181a22] hover:bg-neutral-800 active:bg-neutral-900 text-neutral-200 font-bold rounded-xl py-2 px-3 flex items-center justify-between border border-neutral-700 shadow-sm active:scale-95 transition min-h-[44px] sm:min-h-[48px]"
          >
            <div className="flex flex-col text-left">
              <span className="text-sm sm:text-base font-black font-mono leading-none">FALLO TL</span>
              <span className="text-[9px] sm:text-[10px] uppercase text-neutral-400 mt-0.5">Errado</span>
            </div>
            <span className="text-xs font-mono text-neutral-500 font-bold">1PA</span>
          </button>
        </div>

        {/* SECTION B: REBOUNDS & GAMEPLAY (6 COLUMNAS EN HORIZONTAL) */}
        <div className="grid grid-cols-6 gap-1 sm:gap-1.5 w-full pt-1">
          {/* REBOTE DEFENSIVO */}
          <button
            id="action-dreb-btn"
            onClick={() => onInitiateAction('DREB')}
            className="bg-blue-950/90 hover:bg-blue-900 active:bg-blue-950 text-blue-200 border border-blue-600/80 font-black rounded-xl py-2 px-1 flex flex-col items-center justify-center shadow-md active:scale-95 transition min-h-[48px] sm:min-h-[52px]"
            title="Rebote Defensivo"
          >
            <span className="text-xs sm:text-sm font-black font-mono leading-none text-blue-100">REB DEF</span>
            <span className="text-[8px] sm:text-[9px] uppercase text-blue-300 font-bold mt-1">Defensivo</span>
          </button>

          {/* REBOTE OFENSIVO */}
          <button
            id="action-oreb-btn"
            onClick={() => onInitiateAction('OREB')}
            className="bg-indigo-950/90 hover:bg-indigo-900 active:bg-indigo-950 text-indigo-200 border border-indigo-600/80 font-black rounded-xl py-2 px-1 flex flex-col items-center justify-center shadow-md active:scale-95 transition min-h-[48px] sm:min-h-[52px]"
            title="Rebote Ofensivo"
          >
            <span className="text-xs sm:text-sm font-black font-mono leading-none text-indigo-100">REB OF</span>
            <span className="text-[8px] sm:text-[9px] uppercase text-indigo-300 font-bold mt-1">Ofensivo</span>
          </button>

          {/* ASISTENCIA */}
          <button
            id="action-ast-btn"
            onClick={() => onInitiateAction('AST')}
            className="bg-sky-950/90 hover:bg-sky-900 active:bg-sky-950 text-sky-200 border border-sky-600/80 font-black rounded-xl py-2 px-1 flex flex-col items-center justify-center shadow-md active:scale-95 transition min-h-[48px] sm:min-h-[52px]"
            title="Asistencia"
          >
            <span className="text-xs sm:text-sm font-black font-mono leading-none text-sky-100">ASIST</span>
            <span className="text-[8px] sm:text-[9px] uppercase text-sky-300 font-bold mt-1">Pase Gol</span>
          </button>

          {/* ROBO */}
          <button
            id="action-stl-btn"
            onClick={() => onInitiateAction('STL')}
            className="bg-emerald-950/90 hover:bg-emerald-900 active:bg-emerald-950 text-emerald-200 border border-emerald-600/80 font-black rounded-xl py-2 px-1 flex flex-col items-center justify-center shadow-md active:scale-95 transition min-h-[48px] sm:min-h-[52px]"
            title="Robo de balón"
          >
            <span className="text-xs sm:text-sm font-black font-mono leading-none text-emerald-100">ROBO</span>
            <span className="text-[8px] sm:text-[9px] uppercase text-emerald-300 font-bold mt-1">Recupera</span>
          </button>

          {/* PÉRDIDA */}
          <button
            id="action-to-btn"
            onClick={() => onInitiateAction('TO')}
            className="bg-zinc-800/95 hover:bg-zinc-700 active:bg-zinc-800 text-zinc-100 border border-zinc-500 font-black rounded-xl py-2 px-1 flex flex-col items-center justify-center shadow-md active:scale-95 transition min-h-[48px] sm:min-h-[52px]"
            title="Pérdida de balón"
          >
            <span className="text-xs sm:text-sm font-black font-mono leading-none text-zinc-100">PÉRDIDA</span>
            <span className="text-[8px] sm:text-[9px] uppercase text-zinc-300 font-bold mt-1">Error</span>
          </button>

          {/* TAPÓN */}
          <button
            id="action-blk-btn"
            onClick={() => onInitiateAction('BLK')}
            className="bg-purple-950/90 hover:bg-purple-900 active:bg-purple-950 text-purple-200 border border-purple-600/80 font-black rounded-xl py-2 px-1 flex flex-col items-center justify-center shadow-md active:scale-95 transition min-h-[48px] sm:min-h-[52px]"
            title="Tapón"
          >
            <span className="text-xs sm:text-sm font-black font-mono leading-none text-purple-100">TAPÓN</span>
            <span className="text-[8px] sm:text-[9px] uppercase text-purple-300 font-bold mt-1">Bloqueo</span>
          </button>
        </div>

        {/* SECTION C: FIBA FOULS (5 COLUMNAS EN HORIZONTAL) */}
        <div className="grid grid-cols-5 gap-1 sm:gap-1.5 w-full pt-1">
          {/* FALTA PERSONAL (P) */}
          <button
            id="action-pf-btn"
            onClick={() => onInitiateAction('PF')}
            className="bg-rose-950/95 hover:bg-rose-900 active:bg-rose-950 text-rose-100 border border-rose-600/80 font-black rounded-xl py-2 px-1 flex flex-col items-center justify-center shadow-md active:scale-95 transition min-h-[46px] sm:min-h-[50px]"
            title="Falta Personal simple (P)"
          >
            <span className="text-xs font-black font-mono leading-none text-rose-100">FALTA (P)</span>
            <span className="text-[8px] sm:text-[9px] uppercase text-rose-300 font-bold mt-1">Personal</span>
          </button>

          {/* FALTA TIRO (PFT) */}
          <button
            id="action-pft-btn"
            onClick={() => onInitiateAction('PFT')}
            className="bg-rose-950/95 hover:bg-rose-900 active:bg-rose-950 text-rose-100 border border-rose-600/80 font-black rounded-xl py-2 px-1 flex flex-col items-center justify-center shadow-md active:scale-95 transition min-h-[46px] sm:min-h-[50px]"
            title="Falta con tiros concedidos (P1/2/3)"
          >
            <span className="text-xs font-black font-mono leading-none text-rose-100">TIRO (PFT)</span>
            <span className="text-[8px] sm:text-[9px] uppercase text-rose-300 font-bold mt-1">Con Tiros</span>
          </button>

          {/* FALTA EN ATAQUE (OF) */}
          <button
            id="action-of-btn"
            onClick={() => onInitiateAction('OF')}
            className="bg-orange-950/95 hover:bg-orange-900 active:bg-orange-950 text-orange-200 border border-orange-600/80 font-black rounded-xl py-2 px-1 flex flex-col items-center justify-center shadow-md active:scale-95 transition min-h-[46px] sm:min-h-[50px]"
            title="Falta en Ataque sin tiros (O)"
          >
            <span className="text-xs font-black font-mono leading-none text-orange-200">ATAQUE (O)</span>
            <span className="text-[8px] sm:text-[9px] uppercase text-orange-300 font-bold mt-1">En Ataque</span>
          </button>

          {/* FALTA TÉCNICA / ANTIDEP */}
          <button
            id="action-tf-btn"
            onClick={() => onInitiateAction('TF')}
            className="bg-purple-950/95 hover:bg-purple-900 active:bg-purple-950 text-purple-200 border border-purple-600/80 font-black rounded-xl py-2 px-1 flex flex-col items-center justify-center shadow-md active:scale-95 transition min-h-[46px] sm:min-h-[50px]"
            title="Falta Técnica o Antideportiva"
          >
            <span className="text-xs font-black font-mono leading-none text-purple-200">TÉC / ANT</span>
            <span className="text-[8px] sm:text-[9px] uppercase text-purple-300 font-bold mt-1">Especial</span>
          </button>

          {/* FALTA RECIBIDA (FD) */}
          <button
            id="action-fd-btn"
            onClick={() => onInitiateAction('FD')}
            className="bg-lime-950/95 hover:bg-lime-900 active:bg-lime-950 text-lime-100 border border-lime-600/80 font-black rounded-xl py-2 px-1 flex flex-col items-center justify-center shadow-md active:scale-95 transition min-h-[46px] sm:min-h-[50px]"
            title="Falta Personal Recibida o Provocada (+1 Valoración)"
          >
            <span className="text-xs font-black font-mono leading-none text-lime-200">RECIB (FD)</span>
            <span className="text-[8px] sm:text-[9px] uppercase text-lime-300 font-bold mt-1">Provocada</span>
          </button>
        </div>
      </div>
    );
  }

  // DEFAULT PORTRAIT / MOBILE CONSOLE
  return (
    <div className="w-full flex flex-col justify-evenly gap-1.5 sm:gap-2 py-0.5 select-none">
      {/* SECTION A: SCORING / SHOTS */}
      <div className="grid grid-cols-2 gap-1.5 sm:gap-2 w-full">
        {/* FILA 1: +3 TRIPLE METIDO & FALLO 3P */}
        <button
          id="action-3pm-btn"
          onClick={() => onInitiateAction('3PM')}
          className="bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white font-black rounded-xl py-1.5 sm:py-2.5 px-2.5 sm:px-3 flex items-center justify-between border border-amber-400 shadow-md active:scale-95 transition min-h-[38px] sm:min-h-[44px]"
        >
          <div className="flex flex-col text-left">
            <span className="text-xs sm:text-lg font-black font-mono leading-none">+3 TRIPLE</span>
            <span className="text-[8px] sm:text-[10px] uppercase font-bold text-amber-100 mt-0.5">Triple Metido</span>
          </div>
          <span className="text-base sm:text-xl font-mono font-black opacity-90 leading-none">+3</span>
        </button>

        <button
          id="action-3pa-btn"
          onClick={() => onInitiateAction('3PA')}
          className="bg-[#181a22] hover:bg-neutral-800 active:bg-neutral-900 text-neutral-200 font-bold rounded-xl py-1.5 sm:py-2.5 px-2.5 sm:px-3 flex items-center justify-between border border-neutral-700 shadow-sm active:scale-95 transition min-h-[38px] sm:min-h-[44px]"
        >
          <div className="flex flex-col text-left">
            <span className="text-xs sm:text-base font-black font-mono leading-none">FALLO 3P</span>
            <span className="text-[8px] sm:text-[10px] uppercase text-neutral-400 mt-0.5">Errado</span>
          </div>
          <span className="text-[10px] sm:text-xs font-mono text-neutral-500 font-bold">3PA</span>
        </button>

        {/* FILA 2: +2 CANASTA METIDA & FALLO 2P */}
        <button
          id="action-2pm-btn"
          onClick={() => onInitiateAction('2PM')}
          className="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-black rounded-xl py-1.5 sm:py-2.5 px-2.5 sm:px-3 flex items-center justify-between border border-emerald-400 shadow-md active:scale-95 transition min-h-[38px] sm:min-h-[44px]"
        >
          <div className="flex flex-col text-left">
            <span className="text-xs sm:text-lg font-black font-mono leading-none">+2 CANASTA</span>
            <span className="text-[8px] sm:text-[10px] uppercase font-bold text-emerald-100 mt-0.5">Tiro 2 Metido</span>
          </div>
          <span className="text-base sm:text-xl font-mono font-black opacity-90 leading-none">+2</span>
        </button>

        <button
          id="action-2pa-btn"
          onClick={() => onInitiateAction('2PA')}
          className="bg-[#181a22] hover:bg-neutral-800 active:bg-neutral-900 text-neutral-200 font-bold rounded-xl py-1.5 sm:py-2.5 px-2.5 sm:px-3 flex items-center justify-between border border-neutral-700 shadow-sm active:scale-95 transition min-h-[38px] sm:min-h-[44px]"
        >
          <div className="flex flex-col text-left">
            <span className="text-xs sm:text-base font-black font-mono leading-none">FALLO 2P</span>
            <span className="text-[8px] sm:text-[10px] uppercase text-neutral-400 mt-0.5">Errado</span>
          </div>
          <span className="text-[10px] sm:text-xs font-mono text-neutral-500 font-bold">2PA</span>
        </button>

        {/* FILA 3: +1 TIRO LIBRE METIDO & FALLO TL */}
        <button
          id="action-ftm-btn"
          onClick={() => onInitiateAction('FTM')}
          className="bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white font-black rounded-xl py-1.5 sm:py-2.5 px-2.5 sm:px-3 flex items-center justify-between border border-teal-400 shadow-md active:scale-95 transition min-h-[38px] sm:min-h-[44px]"
        >
          <div className="flex flex-col text-left">
            <span className="text-xs sm:text-lg font-black font-mono leading-none">+1 T. LIBRE</span>
            <span className="text-[8px] sm:text-[10px] uppercase font-bold text-teal-100 mt-0.5">TL Anotado</span>
          </div>
          <span className="text-base sm:text-xl font-mono font-black opacity-90 leading-none">+1</span>
        </button>

        <button
          id="action-fta-btn"
          onClick={() => onInitiateAction('FTA')}
          className="bg-[#181a22] hover:bg-neutral-800 active:bg-neutral-900 text-neutral-200 font-bold rounded-xl py-1.5 sm:py-2.5 px-2.5 sm:px-3 flex items-center justify-between border border-neutral-700 shadow-sm active:scale-95 transition min-h-[38px] sm:min-h-[44px]"
        >
          <div className="flex flex-col text-left">
            <span className="text-xs sm:text-base font-black font-mono leading-none">FALLO TL</span>
            <span className="text-[8px] sm:text-[10px] uppercase text-neutral-400 mt-0.5">Errado</span>
          </div>
          <span className="text-[10px] sm:text-xs font-mono text-neutral-500 font-bold">1PA</span>
        </button>
      </div>

      {/* SECTION B: REBOUNDS & GAMEPLAY */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 sm:gap-2 w-full pt-0.5 sm:pt-1">
        <button
          id="action-dreb-btn"
          onClick={() => onInitiateAction('DREB')}
          className="bg-blue-950/90 hover:bg-blue-900 active:bg-blue-950 text-blue-200 border border-blue-600/80 font-black rounded-xl py-1.5 sm:py-3.5 px-1.5 sm:px-2 flex flex-col items-center justify-center shadow-md active:scale-95 transition min-h-[38px] sm:min-h-[66px]"
          title="Rebote Defensivo"
        >
          <span className="text-xs sm:text-base font-black font-mono leading-none text-blue-100">REB DEF</span>
          <span className="text-[8px] sm:text-xs uppercase text-blue-300 font-bold mt-0.5">Defensivo</span>
        </button>

        <button
          id="action-oreb-btn"
          onClick={() => onInitiateAction('OREB')}
          className="bg-indigo-950/90 hover:bg-indigo-900 active:bg-indigo-950 text-indigo-200 border border-indigo-600/80 font-black rounded-xl py-1.5 sm:py-3.5 px-1.5 sm:px-2 flex flex-col items-center justify-center shadow-md active:scale-95 transition min-h-[38px] sm:min-h-[66px]"
          title="Rebote Ofensivo"
        >
          <span className="text-xs sm:text-base font-black font-mono leading-none text-indigo-100">REB OF</span>
          <span className="text-[8px] sm:text-xs uppercase text-indigo-300 font-bold mt-0.5">Ofensivo</span>
        </button>

        <button
          id="action-ast-btn"
          onClick={() => onInitiateAction('AST')}
          className="bg-sky-950/90 hover:bg-sky-900 active:bg-sky-950 text-sky-200 border border-sky-600/80 font-black rounded-xl py-1.5 sm:py-3.5 px-1.5 sm:px-2 flex flex-col items-center justify-center shadow-md active:scale-95 transition min-h-[38px] sm:min-h-[66px]"
          title="Asistencia"
        >
          <span className="text-xs sm:text-base font-black font-mono leading-none text-sky-100">ASIST</span>
          <span className="text-[8px] sm:text-xs uppercase text-sky-300 font-bold mt-0.5">Pase Gol</span>
        </button>

        <button
          id="action-stl-btn"
          onClick={() => onInitiateAction('STL')}
          className="bg-emerald-950/90 hover:bg-emerald-900 active:bg-emerald-950 text-emerald-200 border border-emerald-600/80 font-black rounded-xl py-1.5 sm:py-3.5 px-1.5 sm:px-2 flex flex-col items-center justify-center shadow-md active:scale-95 transition min-h-[38px] sm:min-h-[66px]"
          title="Robo de balón"
        >
          <span className="text-xs sm:text-base font-black font-mono leading-none text-emerald-100">ROBO</span>
          <span className="text-[8px] sm:text-xs uppercase text-emerald-300 font-bold mt-0.5">Recupera</span>
        </button>

        <button
          id="action-to-btn"
          onClick={() => onInitiateAction('TO')}
          className="bg-zinc-800/95 hover:bg-zinc-700 active:bg-zinc-800 text-zinc-100 border border-zinc-500 font-black rounded-xl py-1.5 sm:py-3.5 px-1.5 sm:px-2 flex flex-col items-center justify-center shadow-md active:scale-95 transition min-h-[38px] sm:min-h-[66px]"
          title="Pérdida de balón"
        >
          <span className="text-xs sm:text-base font-black font-mono leading-none text-zinc-100">PÉRDIDA</span>
          <span className="text-[8px] sm:text-xs uppercase text-zinc-300 font-bold mt-0.5">Error</span>
        </button>

        <button
          id="action-blk-btn"
          onClick={() => onInitiateAction('BLK')}
          className="bg-purple-950/90 hover:bg-purple-900 active:bg-purple-950 text-purple-200 border border-purple-600/80 font-black rounded-xl py-1.5 sm:py-3.5 px-1.5 sm:px-2 flex flex-col items-center justify-center shadow-md active:scale-95 transition min-h-[38px] sm:min-h-[66px]"
          title="Tapón"
        >
          <span className="text-xs sm:text-base font-black font-mono leading-none text-purple-100">TAPÓN</span>
          <span className="text-[8px] sm:text-[9px] uppercase text-purple-300 font-bold mt-0.5">Bloqueo</span>
        </button>
      </div>

      {/* SECTION C: FIBA FOULS */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 sm:gap-2 w-full pt-0.5 sm:pt-1">
        <button
          id="action-pf-btn"
          onClick={() => onInitiateAction('PF')}
          className="bg-rose-950/95 hover:bg-rose-900 active:bg-rose-950 text-rose-100 border border-rose-600/80 font-black rounded-xl py-1.5 sm:py-3.5 px-1.5 sm:px-2 flex flex-col items-center justify-center shadow-md active:scale-95 transition min-h-[38px] sm:min-h-[64px]"
          title="Falta Personal simple (P)"
        >
          <span className="text-xs sm:text-sm font-black font-mono leading-none text-rose-100">FALTA (P)</span>
          <span className="text-[8px] sm:text-xs uppercase text-rose-300 font-bold mt-0.5">Personal</span>
        </button>

        <button
          id="action-pft-btn"
          onClick={() => onInitiateAction('PFT')}
          className="bg-rose-950/95 hover:bg-rose-900 active:bg-rose-950 text-rose-100 border border-rose-600/80 font-black rounded-xl py-1.5 sm:py-3.5 px-1.5 sm:px-2 flex flex-col items-center justify-center shadow-md active:scale-95 transition min-h-[38px] sm:min-h-[64px]"
          title="Falta con tiros concedidos (P1/2/3)"
        >
          <span className="text-xs sm:text-sm font-black font-mono leading-none text-rose-100">TIRO (PFT)</span>
          <span className="text-[8px] sm:text-xs uppercase text-rose-300 font-bold mt-0.5">Con Tiros</span>
        </button>

        <button
          id="action-of-btn"
          onClick={() => onInitiateAction('OF')}
          className="bg-orange-950/95 hover:bg-orange-900 active:bg-orange-950 text-orange-200 border border-orange-600/80 font-black rounded-xl py-1.5 sm:py-3.5 px-1.5 sm:px-2 flex flex-col items-center justify-center shadow-md active:scale-95 transition min-h-[38px] sm:min-h-[64px]"
          title="Falta en Ataque sin tiros (O)"
        >
          <span className="text-xs sm:text-sm font-black font-mono leading-none text-orange-200">ATAQUE (O)</span>
          <span className="text-[8px] sm:text-xs uppercase text-orange-300 font-bold mt-0.5">En Ataque</span>
        </button>

        <button
          id="action-tf-btn"
          onClick={() => onInitiateAction('TF')}
          className="bg-purple-950/95 hover:bg-purple-900 active:bg-purple-950 text-purple-200 border border-purple-600/80 font-black rounded-xl py-1.5 sm:py-3.5 px-1.5 sm:px-2 flex flex-col items-center justify-center shadow-md active:scale-95 transition min-h-[38px] sm:min-h-[64px]"
          title="Falta Técnica o Antideportiva"
        >
          <span className="text-xs sm:text-sm font-black font-mono leading-none text-purple-200">TÉC / ANT</span>
          <span className="text-[8px] sm:text-xs uppercase text-purple-300 font-bold mt-0.5">Especial</span>
        </button>

        <button
          id="action-fd-btn"
          onClick={() => onInitiateAction('FD')}
          className="bg-lime-950/95 hover:bg-lime-900 active:bg-lime-950 text-lime-100 border border-lime-600/80 font-black rounded-xl py-1.5 sm:py-3.5 px-1.5 sm:px-2 flex flex-col items-center justify-center shadow-md active:scale-95 transition min-h-[38px] sm:min-h-[64px]"
          title="Falta Personal Recibida o Provocada (+1 Valoración)"
        >
          <span className="text-xs sm:text-sm font-black font-mono leading-none text-lime-200">RECIB (FD)</span>
          <span className="text-[8px] sm:text-xs uppercase text-lime-300 font-bold mt-0.5">Provocada</span>
        </button>
      </div>
    </div>
  );
};
