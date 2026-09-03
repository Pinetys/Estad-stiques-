import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Upload,
  Sparkles,
  X,
  Check,
  RefreshCw,
  Flame,
  Crown,
  Zap,
  Shield,
  Star,
  Award,
  CircleDot,
  Trash2,
} from 'lucide-react';

export interface PresetEmblem {
  id: string;
  name: string;
  icon: any;
  bgGradient: string;
  color: string;
}

export const PRESET_EMBLEMS: PresetEmblem[] = [
  { id: 'preset:ball', name: 'Balón Oficial', icon: CircleDot, bgGradient: 'from-orange-500 to-amber-600', color: 'text-white' },
  { id: 'preset:fire', name: 'Fuego', icon: Flame, bgGradient: 'from-red-600 to-amber-500', color: 'text-white' },
  { id: 'preset:crown', name: 'Corona Real', icon: Crown, bgGradient: 'from-amber-400 to-yellow-600', color: 'text-white' },
  { id: 'preset:lightning', name: 'Rayo Veloz', icon: Zap, bgGradient: 'from-yellow-400 to-amber-500', color: 'text-black' },
  { id: 'preset:shield', name: 'Escudo Pro', icon: Shield, bgGradient: 'from-blue-600 to-indigo-700', color: 'text-white' },
  { id: 'preset:star', name: 'Estrella All-Star', icon: Star, bgGradient: 'from-purple-600 to-pink-600', color: 'text-white' },
  { id: 'preset:award', name: 'Campeones', icon: Award, bgGradient: 'from-emerald-500 to-teal-700', color: 'text-white' },
];

export const TeamLogoDisplay: React.FC<{
  logo?: string;
  teamName: string;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}> = ({ logo, teamName, className = '', size = 'md' }) => {
  const sizeClasses = {
    xs: 'w-5 h-5 text-[10px]',
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-xl',
  };

  const iconSizes = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
    xl: 'w-8 h-8',
  };

  // If preset
  if (logo?.startsWith('preset:')) {
    const emblem = PRESET_EMBLEMS.find(e => e.id === logo);
    if (emblem) {
      const Icon = emblem.icon;
      return (
        <div
          className={`${sizeClasses[size]} rounded-full bg-gradient-to-br ${emblem.bgGradient} ${emblem.color} flex items-center justify-center font-bold shadow shrink-0 border border-white/20 ${className}`}
          title={`${teamName} logo`}
        >
          <Icon className={iconSizes[size]} />
        </div>
      );
    }
  }

  // If custom data URL / image URL
  if (logo && (logo.startsWith('data:image') || logo.startsWith('http') || logo.startsWith('blob:'))) {
    return (
      <img
        src={logo}
        alt={`${teamName} logo`}
        className={`${sizeClasses[size]} rounded-full object-cover shadow shrink-0 border border-gray-700 bg-[#14161B] ${className}`}
        referrerPolicy="no-referrer"
      />
    );
  }

  // Fallback initial
  const initial = teamName ? teamName.trim().charAt(0).toUpperCase() : 'T';
  return (
    <div
      className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-gray-700 to-gray-900 text-gray-200 font-extrabold flex items-center justify-center shadow shrink-0 border border-gray-600 ${className}`}
    >
      {initial}
    </div>
  );
};

interface TeamLogoPickerModalProps {
  teamName: string;
  currentLogo?: string;
  onSaveLogo: (logoDataUrl?: string) => void;
  onClose: () => void;
}

export const TeamLogoPickerModal: React.FC<TeamLogoPickerModalProps> = ({
  teamName,
  currentLogo,
  onSaveLogo,
  onClose,
}) => {
  const [selectedLogo, setSelectedLogo] = useState<string | undefined>(currentLogo);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Resize & optimize image before storing to keep local state small
  const optimizeImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const optimizedBase64 = canvas.toDataURL('image/jpeg', 0.85);
            resolve(optimizedBase64);
          } else {
            resolve(e.target?.result as string);
          }
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const optimized = await optimizeImage(file);
      setSelectedLogo(optimized);
      stopCamera();
    } catch (err) {
      console.error('Error optimizing image:', err);
    }
  };

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        // Fallback to camera input trigger
        cameraInputRef.current?.click();
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 640 },
          height: { ideal: 640 },
        },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch (err: any) {
      console.warn('getUserMedia error, falling back to input capture:', err);
      setCameraError('No se pudo acceder a la cámara web directamente. Usa el botón de captura nativa.');
      // Direct trigger
      cameraInputRef.current?.click();
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    const size = Math.min(video.videoWidth || 300, video.videoHeight || 300);
    canvas.width = 200;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const sx = ((video.videoWidth || 300) - size) / 2;
      const sy = ((video.videoHeight || 300) - size) / 2;
      ctx.drawImage(video, sx, sy, size, size, 0, 0, 200, 200);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setSelectedLogo(dataUrl);
      stopCamera();
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const handleSave = () => {
    stopCamera();
    onSaveLogo(selectedLogo);
    onClose();
  };

  const handleRemove = () => {
    setSelectedLogo(undefined);
    stopCamera();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 animate-in fade-in">
      <div className="bg-[#1A1D23] border border-gray-700 rounded-lg max-w-md w-full p-4 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-orange-500" />
            <h3 className="text-sm font-bold text-gray-100 uppercase tracking-wide">
              Logo de {teamName}
            </h3>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Preview */}
        <div className="bg-[#14161B] border border-gray-800 rounded-lg p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TeamLogoDisplay logo={selectedLogo} teamName={teamName} size="lg" />
            <div>
              <span className="text-[10px] uppercase font-mono font-bold text-gray-400 block">
                Vista Previa en Interfaz
              </span>
              <p className="text-xs font-bold text-gray-200">{teamName}</p>
              <span className="text-[10px] text-gray-400">
                {selectedLogo ? (selectedLogo.startsWith('preset:') ? 'Emblema Seleccionado' : 'Imagen Personalizada') : 'Inicial por Defecto'}
              </span>
            </div>
          </div>

          {selectedLogo && (
            <button
              onClick={handleRemove}
              className="p-1.5 rounded bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 text-[11px] font-bold flex items-center gap-1"
              title="Quitar logo"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Quitar</span>
            </button>
          )}
        </div>

        {/* Live Camera Viewfinder if active */}
        {isCameraActive && (
          <div className="bg-black rounded-lg border border-orange-500 overflow-hidden relative space-y-2 p-2">
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-48 sm:h-56 object-cover rounded bg-black"
            />
            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={stopCamera}
                className="py-1.5 px-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-xs font-bold"
              >
                Cancelar Cámara
              </button>
              <button
                type="button"
                onClick={capturePhoto}
                className="py-1.5 px-4 bg-orange-600 hover:bg-orange-500 text-white rounded text-xs font-bold flex items-center gap-1.5 shadow"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Capturar Foto</span>
              </button>
            </div>
          </div>
        )}

        {/* Upload & Camera Buttons */}
        <div className="grid grid-cols-2 gap-2">
          {/* File Upload from Device */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 bg-[#14161B] hover:bg-gray-800 active:bg-gray-900 border border-gray-700 text-gray-200 font-bold rounded text-xs flex flex-col items-center justify-center gap-1 transition"
          >
            <Upload className="w-4 h-4 text-sky-400" />
            <span>Subir Imagen</span>
            <span className="text-[9px] text-gray-400 font-normal">PNG, JPG, WebP</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />

          {/* Camera Capture */}
          <button
            type="button"
            onClick={startCamera}
            className="p-2.5 bg-[#14161B] hover:bg-gray-800 active:bg-gray-900 border border-gray-700 text-gray-200 font-bold rounded text-xs flex flex-col items-center justify-center gap-1 transition"
          >
            <Camera className="w-4 h-4 text-orange-400" />
            <span>Hacer Foto</span>
            <span className="text-[9px] text-gray-400 font-normal">Cámara móvil / Web</span>
          </button>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>

        {cameraError && (
          <p className="text-[11px] text-amber-400 bg-amber-950/40 p-2 rounded border border-amber-800">
            {cameraError}
          </p>
        )}

        {/* Preset Basketball Emblems */}
        <div className="space-y-1.5 pt-1 border-t border-gray-800">
          <label className="text-[10px] uppercase font-mono font-bold text-gray-400 block">
            O selecciona un Emblema Oficial de Baloncesto:
          </label>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
            {PRESET_EMBLEMS.map(emblem => {
              const Icon = emblem.icon;
              const isSelected = selectedLogo === emblem.id;
              return (
                <button
                  key={emblem.id}
                  type="button"
                  onClick={() => {
                    setSelectedLogo(emblem.id);
                    stopCamera();
                  }}
                  className={`p-2 rounded flex flex-col items-center justify-center gap-1 border transition ${
                    isSelected
                      ? 'bg-orange-600/30 border-orange-500 ring-2 ring-orange-500'
                      : 'bg-[#14161B] hover:bg-gray-800 border-gray-800'
                  }`}
                  title={emblem.name}
                >
                  <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${emblem.bgGradient} ${emblem.color} flex items-center justify-center shadow`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-[9px] text-gray-300 text-center font-medium leading-none truncate w-full">
                    {emblem.name.split(' ')[0]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="pt-2 flex items-center gap-2 border-t border-gray-800">
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="w-1/3 py-2 bg-[#14161B] hover:bg-gray-800 text-gray-300 font-bold rounded text-xs border border-gray-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="w-2/3 py-2 bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white font-extrabold rounded text-xs shadow flex items-center justify-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Aplicar Logo</span>
          </button>
        </div>
      </div>
    </div>
  );
};
