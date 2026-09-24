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
      <div className="w-full max-w-3xl mx-auto flex flex-col justify-center gap-2 sm:gap-2.5 my-auto select-none">
        {/* SECTION A: SCORING / SHOTS (ORDEN: 3 PUNTOS, 2 PUNTOS, 1 PUNTO) - VIVID VIBRANT BUTTONS */}
        <div className="grid grid-cols-2 gap-2 sm:gap-2.5 w-full">
          {/* FILA 1: +3 TRIPLE METIDO & FALLO 3P */}
          <button
            id="action-3pm-btn"
            onClick={() => onInitiateAction('3PM')}
            className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 active:from-amber-600 active:to-orange-600 text-slate-950 font-black rounded-2xl py-3 px-4 flex items-center justify-between border-2 border-amber-300 shadow-xl shadow-orange-500/25 active:scale-95 transition min-h-[64px] sm:min-h-[72px] lg:min-h-[78px]"
          >
            <div className="flex flex-col text-left">
              <span className="text-base sm:text-lg lg:text-xl font-black font-mono leading-none tracking-tight">+3 TRIPLE</span>
              <span className="text-[10px] sm:text-xs uppercase font-extrabold text-slate-900 mt-1">Triple Metido</span>
            </div>
            <span className="text-2xl sm:text-3xl font-mono font-black leading-none bg-slate-950/20 px-2.5 py-1 rounded-xl">+3</span>
          </button>

          <button
            id="action-3pa-btn"
            onClick={() => onInitiateAction('3PA')}
            className="bg-[#1c3a72] hover:bg-[#254d96] active:bg-[#152e5d] text-white font-bold rounded-2xl py-3 px-4 flex items-center justify-between border-2 border-amber-400/50 shadow-md active:scale-95 transition min-h-[64px] sm:min-h-[72px] lg:min-h-[78px]"
          >
            <div className="flex flex-col text-left">
              <span className="text-base sm:text-lg lg:text-xl font-black font-mono leading-none text-amber-300">FALLO 3P</span>
              <span className="text-[10px] sm:text-xs uppercase text-slate-200 mt-1">Triple Errado</span>
            </div>
            <span className="text-xs sm:text-sm font-mono text-amber-300 font-bold bg-[#132852] border border-amber-400/40 px-2 py-1 rounded-lg">3PA</span>
          </button>

          {/* FILA 2: +2 CANASTA METIDA & FALLO 2P */}
          <button
            id="action-2pm-btn"
            onClick={() => onInitiateAction('2PM')}
            className="bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 active:from-emerald-600 active:to-teal-600 text-white font-black rounded-2xl py-3 px-4 flex items-center justify-between border-2 border-emerald-300 shadow-xl shadow-emerald-500/25 active:scale-95 transition min-h-[64px] sm:min-h-[72px] lg:min-h-[78px]"
          >
            <div className="flex flex-col text-left">
              <span className="text-base sm:text-lg lg:text-xl font-black font-mono leading-none tracking-tight">+2 CANASTA</span>
              <span className="text-[10px] sm:text-xs uppercase font-extrabold text-emerald-100 mt-1">Tiro de 2 Metido</span>
            </div>
            <span className="text-2xl sm:text-3xl font-mono font-black leading-none bg-emerald-950/40 px-2.5 py-1 rounded-xl">+2</span>
          </button>

          <button
            id="action-2pa-btn"
            onClick={() => onInitiateAction('2PA')}
            className="bg-[#1c3a72] hover:bg-[#254d96] active:bg-[#152e5d] text-white font-bold rounded-2xl py-3 px-4 flex items-center justify-between border-2 border-emerald-400/50 shadow-md active:scale-95 transition min-h-[64px] sm:min-h-[72px] lg:min-h-[78px]"
          >
            <div className="flex flex-col text-left">
              <span className="text-base sm:text-lg lg:text-xl font-black font-mono leading-none text-emerald-300">FALLO 2P</span>
              <span className="text-[10px] sm:text-xs uppercase text-slate-200 mt-1">Tiro 2 Errado</span>
            </div>
            <span className="text-xs sm:text-sm font-mono text-emerald-300 font-bold bg-[#132852] border border-emerald-400/40 px-2 py-1 rounded-lg">2PA</span>
          </button>

          {/* FILA 3: +1 TIRO LIBRE METIDO & FALLO TL */}
          <button
            id="action-ftm-btn"
            onClick={() => onInitiateAction('FTM')}
            className="bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 hover:from-cyan-400 hover:to-sky-400 active:from-cyan-600 active:to-sky-600 text-white font-black rounded-2xl py-3 px-4 flex items-center justify-between border-2 border-cyan-300 shadow-xl shadow-cyan-500/25 active:scale-95 transition min-h-[64px] sm:min-h-[72px] lg:min-h-[78px]"
          >
            <div className="flex flex-col text-left">
              <span className="text-base sm:text-lg lg:text-xl font-black font-mono leading-none tracking-tight">+1 T. LIBRE</span>
              <span className="text-[10px] sm:text-xs uppercase font-extrabold text-cyan-100 mt-1">TL Anotado</span>
            </div>
            <span className="text-2xl sm:text-3xl font-mono font-black leading-none bg-sky-950/40 px-2.5 py-1 rounded-xl">+1</span>
          </button>

          <button
            id="action-fta-btn"
            onClick={() => onInitiateAction('FTA')}
            className="bg-[#1c3a72] hover:bg-[#254d96] active:bg-[#152e5d] text-white font-bold rounded-2xl py-3 px-4 flex items-center justify-between border-2 border-cyan-400/50 shadow-md active:scale-95 transition min-h-[64px] sm:min-h-[72px] lg:min-h-[78px]"
          >
            <div className="flex flex-col text-left">
              <span className="text-base sm:text-lg lg:text-xl font-black font-mono leading-none text-cyan-300">FALLO TL</span>
              <span className="text-[10px] sm:text-xs uppercase text-slate-200 mt-1">TL Errado</span>
            </div>
            <span className="text-xs sm:text-sm font-mono text-cyan-300 font-bold bg-[#132852] border border-cyan-400/40 px-2 py-1 rounded-lg">1PA</span>
          </button>
        </div>

        {/* SECTION B: REBOUNDS & GAMEPLAY (5 COLUMNAS EN HORIZONTAL - VIBRANT SATURATED COLORS) */}
        <div className="grid grid-cols-5 gap-1.5 sm:gap-2 w-full pt-1">
          {/* REBOTE DEFENSIVO */}
          <button
            id="action-dreb-btn"
            onClick={() => onInitiateAction('DREB')}
            className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white border-2 border-blue-300 font-black rounded-xl sm:rounded-2xl py-2 px-1 flex flex-col items-center justify-center shadow-lg active:scale-95 transition h-[62px] sm:h-[68px] lg:h-[74px] min-h-[62px] sm:min-h-[68px] lg:min-h-[74px]"
            title="Rebote Defensivo"
          >
            <span className="text-[11px] sm:text-xs lg:text-sm font-black font-mono leading-tight text-white uppercase">REB DEF</span>
            <span className="text-[8.5px] sm:text-[9.5px] lg:text-[10px] uppercase text-blue-100 font-bold mt-1 leading-none">Defensivo</span>
          </button>

          {/* REBOTE OFENSIVO */}
          <button
            id="action-oreb-btn"
            onClick={() => onInitiateAction('OREB')}
            className="bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white border-2 border-indigo-300 font-black rounded-xl sm:rounded-2xl py-2 px-1 flex flex-col items-center justify-center shadow-lg active:scale-95 transition h-[62px] sm:h-[68px] lg:h-[74px] min-h-[62px] sm:min-h-[68px] lg:min-h-[74px]"
            title="Rebote Ofensivo"
          >
            <span className="text-[11px] sm:text-xs lg:text-sm font-black font-mono leading-tight text-white uppercase">REB OF</span>
            <span className="text-[8.5px] sm:text-[9.5px] lg:text-[10px] uppercase text-indigo-100 font-bold mt-1 leading-none">Ofensivo</span>
          </button>

          {/* ROBO */}
          <button
            id="action-stl-btn"
            onClick={() => onInitiateAction('STL')}
            className="bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white border-2 border-teal-300 font-black rounded-xl sm:rounded-2xl py-2 px-1 flex flex-col items-center justify-center shadow-lg active:scale-95 transition h-[62px] sm:h-[68px] lg:h-[74px] min-h-[62px] sm:min-h-[68px] lg:min-h-[74px]"
            title="Robo de balón"
          >
            <span className="text-[11px] sm:text-xs lg:text-sm font-black font-mono leading-tight text-white uppercase">ROBO</span>
            <span className="text-[8.5px] sm:text-[9.5px] lg:text-[10px] uppercase text-teal-100 font-bold mt-1 leading-none">Recupera</span>
          </button>

          {/* PÉRDIDA */}
          <button
            id="action-to-btn"
            onClick={() => onInitiateAction('TO')}
            className="bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-slate-950 border-2 border-amber-300 font-black rounded-xl sm:rounded-2xl py-2 px-1 flex flex-col items-center justify-center shadow-lg active:scale-95 transition h-[62px] sm:h-[68px] lg:h-[74px] min-h-[62px] sm:min-h-[68px] lg:min-h-[74px]"
            title="Pérdida de balón"
          >
            <span className="text-[11px] sm:text-xs lg:text-sm font-black font-mono leading-tight uppercase">PÉRDIDA</span>
            <span className="text-[8.5px] sm:text-[9.5px] lg:text-[10px] uppercase text-slate-900 font-bold mt-1 leading-none">Pérdida</span>
          </button>

          {/* TAPÓN */}
          <button
            id="action-blk-btn"
            onClick={() => onInitiateAction('BLK')}
            className="bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white border-2 border-purple-300 font-black rounded-xl sm:rounded-2xl py-2 px-1 flex flex-col items-center justify-center shadow-lg active:scale-95 transition h-[62px] sm:h-[68px] lg:h-[74px] min-h-[62px] sm:min-h-[68px] lg:min-h-[74px]"
            title="Tapón"
          >
            <span className="text-[11px] sm:text-xs lg:text-sm font-black font-mono leading-tight text-white uppercase">TAPÓN</span>
            <span className="text-[8.5px] sm:text-[9.5px] lg:text-[10px] uppercase text-purple-100 font-bold mt-1 leading-none">Gorro</span>
          </button>
        </div>

        {/* SECTION C: FIBA FOULS (5 COLUMNAS EN HORIZONTAL - VIVID REDS & ACCENTS) */}
        <div className="grid grid-cols-5 gap-1.5 sm:gap-2 w-full pt-1">
          {/* FALTA PERSONAL (P) */}
          <button
            id="action-pf-btn"
            onClick={() => onInitiateAction('PF')}
            className="bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white border-2 border-rose-300 font-black rounded-xl sm:rounded-2xl py-2 px-1 flex flex-col items-center justify-center shadow-lg active:scale-95 transition h-[62px] sm:h-[68px] lg:h-[74px] min-h-[62px] sm:min-h-[68px] lg:min-h-[74px]"
            title="Falta Personal simple (P)"
          >
            <span className="text-[11px] sm:text-xs lg:text-sm font-black font-mono leading-tight text-white uppercase">FALTA (P)</span>
            <span className="text-[8.5px] sm:text-[9.5px] lg:text-[10px] uppercase text-rose-100 font-bold mt-1 leading-none">Personal</span>
          </button>

          {/* FALTA TIRO (PFT) */}
          <button
            id="action-pft-btn"
            onClick={() => onInitiateAction('PFT')}
            className="bg-red-600 hover:bg-red-500 active:bg-red-700 text-white border-2 border-red-300 font-black rounded-xl sm:rounded-2xl py-2 px-1 flex flex-col items-center justify-center shadow-lg active:scale-95 transition h-[62px] sm:h-[68px] lg:h-[74px] min-h-[62px] sm:min-h-[68px] lg:min-h-[74px]"
            title="Falta con tiros concedidos (P1/2/3)"
          >
            <span className="text-[11px] sm:text-xs lg:text-sm font-black font-mono leading-tight text-white uppercase">TIRO (PFT)</span>
            <span className="text-[8.5px] sm:text-[9.5px] lg:text-[10px] uppercase text-red-100 font-bold mt-1 leading-none">Con Tiros</span>
          </button>

          {/* FALTA EN ATAQUE (OF) */}
          <button
            id="action-of-btn"
            onClick={() => onInitiateAction('OF')}
            className="bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white border-2 border-orange-300 font-black rounded-xl sm:rounded-2xl py-2 px-1 flex flex-col items-center justify-center shadow-lg active:scale-95 transition h-[62px] sm:h-[68px] lg:h-[74px] min-h-[62px] sm:min-h-[68px] lg:min-h-[74px]"
            title="Falta en Ataque sin tiros (O)"
          >
            <span className="text-[11px] sm:text-xs lg:text-sm font-black font-mono leading-tight text-white uppercase">ATAQUE (O)</span>
            <span className="text-[8.5px] sm:text-[9.5px] lg:text-[10px] uppercase text-orange-100 font-bold mt-1 leading-none">En Ataque</span>
          </button>

          {/* FALTA TÉCNICA / ANTIDEP */}
          <button
            id="action-tf-btn"
            onClick={() => onInitiateAction('TF')}
            className="bg-fuchsia-600 hover:bg-fuchsia-500 active:bg-fuchsia-700 text-white border-2 border-fuchsia-300 font-black rounded-xl sm:rounded-2xl py-2 px-1 flex flex-col items-center justify-center shadow-lg active:scale-95 transition h-[62px] sm:h-[68px] lg:h-[74px] min-h-[62px] sm:min-h-[68px] lg:min-h-[74px]"
            title="Falta Técnica o Antideportiva"
          >
            <span className="text-[11px] sm:text-xs lg:text-sm font-black font-mono leading-tight text-white uppercase">TÉC / ANT</span>
            <span className="text-[8.5px] sm:text-[9.5px] lg:text-[10px] uppercase text-fuchsia-100 font-bold mt-1 leading-none">Especial</span>
          </button>

          {/* FALTA RECIBIDA (FD) */}
          <button
            id="action-fd-btn"
            onClick={() => onInitiateAction('FD')}
            className="bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 border-2 border-emerald-200 font-black rounded-xl sm:rounded-2xl py-2 px-1 flex flex-col items-center justify-center shadow-lg active:scale-95 transition h-[62px] sm:h-[68px] lg:h-[74px] min-h-[62px] sm:min-h-[68px] lg:min-h-[74px]"
            title="Falta Personal Recibida o Provocada (+1 Valoración)"
          >
            <span className="text-[11px] sm:text-xs lg:text-sm font-black font-mono leading-tight uppercase">RECIB (FD)</span>
            <span className="text-[8.5px] sm:text-[9.5px] lg:text-[10px] uppercase text-slate-900 font-bold mt-1 leading-none">Provocada</span>
          </button>
        </div>
      </div>
    );
  }

  // DEFAULT PORTRAIT / MOBILE CONSOLE - EXTRA LARGE TOUCH TARGETS WITH VIBRANT COLORS
  return (
    <div className="w-full flex flex-col justify-between gap-1.5 xs:gap-2 sm:gap-2.5 py-1 select-none h-full max-h-full">
      {/* SECTION A: SCORING / SHOTS (ROW 1: ACIERTOS +3, +2, +1 | ROW 2: FALLOS) */}
      <div className="flex flex-col gap-1.5 xs:gap-2 w-full shrink-0">
        {/* FILA 1: CANASTAS CONVERTIDAS (+3, +2, +1) - EXTRA LARGE VIVID BUTTONS */}
        <div className="grid grid-cols-3 gap-1.5 xs:gap-2 sm:gap-2.5 w-full">
          <button
            id="action-3pm-btn"
            onClick={() => onInitiateAction('3PM')}
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 active:from-amber-600 active:to-orange-600 text-slate-950 font-black rounded-xl xs:rounded-2xl py-2.5 px-2 xs:px-3 flex items-center justify-between border-2 border-amber-300 shadow-md active:scale-95 transition min-h-[54px] xs:min-h-[60px] sm:min-h-[68px]"
          >
            <div className="flex flex-col text-left leading-tight">
              <span className="text-xs xs:text-sm sm:text-base font-black font-mono">+3 TRIPLE</span>
              <span className="text-[8px] xs:text-[9px] uppercase font-extrabold text-slate-900">Metido</span>
            </div>
            <span className="text-base xs:text-xl sm:text-2xl font-mono font-black bg-slate-950/20 px-2 py-0.5 rounded-lg">+3</span>
          </button>

          <button
            id="action-2pm-btn"
            onClick={() => onInitiateAction('2PM')}
            className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 active:from-emerald-600 active:to-teal-600 text-white font-black rounded-xl xs:rounded-2xl py-2.5 px-2 xs:px-3 flex items-center justify-between border-2 border-emerald-300 shadow-md active:scale-95 transition min-h-[54px] xs:min-h-[60px] sm:min-h-[68px]"
          >
            <div className="flex flex-col text-left leading-tight">
              <span className="text-xs xs:text-sm sm:text-base font-black font-mono">+2 CANASTA</span>
              <span className="text-[8px] xs:text-[9px] uppercase font-extrabold text-emerald-100">Tiro 2</span>
            </div>
            <span className="text-base xs:text-xl sm:text-2xl font-mono font-black bg-emerald-950/40 px-2 py-0.5 rounded-lg">+2</span>
          </button>

          <button
            id="action-ftm-btn"
            onClick={() => onInitiateAction('FTM')}
            className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 active:from-cyan-600 active:to-blue-600 text-white font-black rounded-xl xs:rounded-2xl py-2.5 px-2 xs:px-3 flex items-center justify-between border-2 border-cyan-300 shadow-md active:scale-95 transition min-h-[54px] xs:min-h-[60px] sm:min-h-[68px]"
          >
            <div className="flex flex-col text-left leading-tight">
              <span className="text-xs xs:text-sm sm:text-base font-black font-mono">+1 T. LIBRE</span>
              <span className="text-[8px] xs:text-[9px] uppercase font-extrabold text-cyan-100">TL Anotado</span>
            </div>
            <span className="text-base xs:text-xl sm:text-2xl font-mono font-black bg-sky-950/40 px-2 py-0.5 rounded-lg">+1</span>
          </button>
        </div>

        {/* FILA 2: TIROS ERRADOS (FALLO 3P, FALLO 2P, FALLO TL) */}
        <div className="grid grid-cols-3 gap-1.5 xs:gap-2 sm:gap-2.5 w-full">
          <button
            id="action-3pa-btn"
            onClick={() => onInitiateAction('3PA')}
            className="bg-[#1c3a72] hover:bg-[#254d96] active:bg-[#152e5d] text-white font-bold rounded-xl xs:rounded-2xl py-2 px-2 xs:px-3 flex items-center justify-between border-2 border-amber-400/50 shadow-sm active:scale-95 transition min-h-[42px] xs:min-h-[46px] sm:min-h-[50px]"
          >
            <div className="flex flex-col text-left leading-tight">
              <span className="text-[11px] xs:text-xs sm:text-sm font-black font-mono text-amber-300">FALLO 3P</span>
              <span className="text-[7.5px] xs:text-[8.5px] uppercase text-slate-200">Errado</span>
            </div>
            <span className="text-[9px] xs:text-[10px] sm:text-xs font-mono text-amber-300 font-bold bg-[#132852] border border-amber-400/40 px-1.5 py-0.5 rounded">3PA</span>
          </button>

          <button
            id="action-2pa-btn"
            onClick={() => onInitiateAction('2PA')}
            className="bg-[#1c3a72] hover:bg-[#254d96] active:bg-[#152e5d] text-white font-bold rounded-xl xs:rounded-2xl py-2 px-2 xs:px-3 flex items-center justify-between border-2 border-emerald-400/50 shadow-sm active:scale-95 transition min-h-[42px] xs:min-h-[46px] sm:min-h-[50px]"
          >
            <div className="flex flex-col text-left leading-tight">
              <span className="text-[11px] xs:text-xs sm:text-sm font-black font-mono text-emerald-300">FALLO 2P</span>
              <span className="text-[7.5px] xs:text-[8.5px] uppercase text-slate-200">Errado</span>
            </div>
            <span className="text-[9px] xs:text-[10px] sm:text-xs font-mono text-emerald-300 font-bold bg-[#132852] border border-emerald-400/40 px-1.5 py-0.5 rounded">2PA</span>
          </button>

          <button
            id="action-fta-btn"
            onClick={() => onInitiateAction('FTA')}
            className="bg-[#1c3a72] hover:bg-[#254d96] active:bg-[#152e5d] text-white font-bold rounded-xl xs:rounded-2xl py-2 px-2 xs:px-3 flex items-center justify-between border-2 border-cyan-400/50 shadow-sm active:scale-95 transition min-h-[42px] xs:min-h-[46px] sm:min-h-[50px]"
          >
            <div className="flex flex-col text-left leading-tight">
              <span className="text-[11px] xs:text-xs sm:text-sm font-black font-mono text-cyan-300">FALLO TL</span>
              <span className="text-[7.5px] xs:text-[8.5px] uppercase text-slate-200">Errado</span>
            </div>
            <span className="text-[9px] xs:text-[10px] sm:text-xs font-mono text-cyan-300 font-bold bg-[#132852] border border-cyan-400/40 px-1.5 py-0.5 rounded">1PA</span>
          </button>
        </div>
      </div>

      {/* SECTION B: REBOUNDS & GAMEPLAY - 5 COLUMNS EQUALIZED WITH VIVID COLORS */}
      <div className="grid grid-cols-5 gap-1 xs:gap-1.5 sm:gap-2 w-full shrink-0">
        <button
          id="action-dreb-btn"
          onClick={() => onInitiateAction('DREB')}
          className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white border-2 border-blue-300 font-black rounded-xl xs:rounded-2xl py-2 px-0.5 sm:px-1 flex flex-col items-center justify-center shadow-md active:scale-95 transition min-h-[52px] xs:min-h-[58px] sm:min-h-[64px]"
          title="Rebote Defensivo"
        >
          <span className="text-[10px] xs:text-[11.5px] sm:text-xs font-black font-mono leading-none text-white">REB DEF</span>
          <span className="text-[7px] xs:text-[8px] uppercase text-blue-100 font-bold mt-1">Defensa</span>
        </button>

        <button
          id="action-oreb-btn"
          onClick={() => onInitiateAction('OREB')}
          className="bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white border-2 border-indigo-300 font-black rounded-xl xs:rounded-2xl py-2 px-0.5 sm:px-1 flex flex-col items-center justify-center shadow-md active:scale-95 transition min-h-[52px] xs:min-h-[58px] sm:min-h-[64px]"
          title="Rebote Ofensivo"
        >
          <span className="text-[10px] xs:text-[11.5px] sm:text-xs font-black font-mono leading-none text-white">REB OF</span>
          <span className="text-[7px] xs:text-[8px] uppercase text-indigo-100 font-bold mt-1">Ataque</span>
        </button>

        <button
          id="action-stl-btn"
          onClick={() => onInitiateAction('STL')}
          className="bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white border-2 border-teal-300 font-black rounded-xl xs:rounded-2xl py-2 px-0.5 sm:px-1 flex flex-col items-center justify-center shadow-md active:scale-95 transition min-h-[52px] xs:min-h-[58px] sm:min-h-[64px]"
          title="Robo de balón"
        >
          <span className="text-[10px] xs:text-[11.5px] sm:text-xs font-black font-mono leading-none text-white">ROBO</span>
          <span className="text-[7px] xs:text-[8px] uppercase text-teal-100 font-bold mt-1">Recupera</span>
        </button>

        <button
          id="action-to-btn"
          onClick={() => onInitiateAction('TO')}
          className="bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-slate-950 border-2 border-amber-300 font-black rounded-xl xs:rounded-2xl py-2 px-0.5 sm:px-1 flex flex-col items-center justify-center shadow-md active:scale-95 transition min-h-[52px] xs:min-h-[58px] sm:min-h-[64px]"
          title="Pérdida de balón"
        >
          <span className="text-[10px] xs:text-[11.5px] sm:text-xs font-black font-mono leading-none">PÉRDIDA</span>
          <span className="text-[7px] xs:text-[8px] uppercase text-slate-900 font-bold mt-1">Error</span>
        </button>

        <button
          id="action-blk-btn"
          onClick={() => onInitiateAction('BLK')}
          className="bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white border-2 border-purple-300 font-black rounded-xl xs:rounded-2xl py-2 px-0.5 sm:px-1 flex flex-col items-center justify-center shadow-md active:scale-95 transition min-h-[52px] xs:min-h-[58px] sm:min-h-[64px]"
          title="Tapón"
        >
          <span className="text-[10px] xs:text-[11.5px] sm:text-xs font-black font-mono leading-none text-white">TAPÓN</span>
          <span className="text-[7px] xs:text-[8px] uppercase text-purple-100 font-bold mt-1">Gorro</span>
        </button>
      </div>

      {/* SECTION C: FIBA FOULS - VIVID CONTRASTING COLORS */}
      <div className="grid grid-cols-5 gap-1 xs:gap-1.5 sm:gap-2 w-full shrink-0">
        <button
          id="action-pf-btn"
          onClick={() => onInitiateAction('PF')}
          className="bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white border-2 border-rose-300 font-black rounded-xl xs:rounded-2xl py-2 px-0.5 sm:px-1 flex flex-col items-center justify-center shadow-md active:scale-95 transition min-h-[52px] xs:min-h-[58px] sm:min-h-[64px]"
          title="Falta Personal simple (P)"
        >
          <span className="text-[10px] xs:text-[11.5px] sm:text-xs font-black font-mono leading-none text-white">FALTA (P)</span>
          <span className="text-[7px] xs:text-[8px] uppercase text-rose-100 font-bold mt-1">Personal</span>
        </button>

        <button
          id="action-pft-btn"
          onClick={() => onInitiateAction('PFT')}
          className="bg-red-600 hover:bg-red-500 active:bg-red-700 text-white border-2 border-red-300 font-black rounded-xl xs:rounded-2xl py-2 px-0.5 sm:px-1 flex flex-col items-center justify-center shadow-md active:scale-95 transition min-h-[52px] xs:min-h-[58px] sm:min-h-[64px]"
          title="Falta con tiros concedidos (P1/2/3)"
        >
          <span className="text-[10px] xs:text-[11.5px] sm:text-xs font-black font-mono leading-none text-white">TIRO (PFT)</span>
          <span className="text-[7px] xs:text-[8px] uppercase text-red-100 font-bold mt-1">Con Tiros</span>
        </button>

        <button
          id="action-of-btn"
          onClick={() => onInitiateAction('OF')}
          className="bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white border-2 border-orange-300 font-black rounded-xl xs:rounded-2xl py-2 px-0.5 sm:px-1 flex flex-col items-center justify-center shadow-md active:scale-95 transition min-h-[52px] xs:min-h-[58px] sm:min-h-[64px]"
          title="Falta en Ataque sin tiros (O)"
        >
          <span className="text-[10px] xs:text-[11.5px] sm:text-xs font-black font-mono leading-none text-white">ATAQUE (O)</span>
          <span className="text-[7px] xs:text-[8px] uppercase text-orange-100 font-bold mt-1">En Ataque</span>
        </button>

        <button
          id="action-tf-btn"
          onClick={() => onInitiateAction('TF')}
          className="bg-fuchsia-600 hover:bg-fuchsia-500 active:bg-fuchsia-700 text-white border-2 border-fuchsia-300 font-black rounded-xl xs:rounded-2xl py-2 px-0.5 sm:px-1 flex flex-col items-center justify-center shadow-md active:scale-95 transition min-h-[52px] xs:min-h-[58px] sm:min-h-[64px]"
          title="Falta Técnica o Antideportiva"
        >
          <span className="text-[10px] xs:text-[11.5px] sm:text-xs font-black font-mono leading-none text-white">TÉC / ANT</span>
          <span className="text-[7px] xs:text-[8px] uppercase text-fuchsia-100 font-bold mt-1">Especial</span>
        </button>

        <button
          id="action-fd-btn"
          onClick={() => onInitiateAction('FD')}
          className="bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 border-2 border-emerald-200 font-black rounded-xl xs:rounded-2xl py-2 px-0.5 sm:px-1 flex flex-col items-center justify-center shadow-md active:scale-95 transition min-h-[52px] xs:min-h-[58px] sm:min-h-[64px]"
          title="Falta Personal Recibida o Provocada (+1 Valoración)"
        >
          <span className="text-[10px] xs:text-[11.5px] sm:text-xs font-black font-mono leading-none">RECIB (FD)</span>
          <span className="text-[7px] xs:text-[8px] uppercase text-slate-900 font-bold mt-1">Provocada</span>
        </button>
      </div>
    </div>
  );
};
