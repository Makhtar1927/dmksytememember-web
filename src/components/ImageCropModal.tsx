import { useState, useRef, useCallback } from "react";
import ReactCrop, { type Crop, type PixelCrop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { X, Check, ZoomIn, ZoomOut, RotateCw, Loader2 } from "lucide-react";

interface ImageCropModalProps {
  imageSrc: string;
  fileName: string;
  onConfirm: (croppedFile: File) => void;
  onCancel: () => void;
}

function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect: number): Crop {
  return centerCrop(
    makeAspectCrop({ unit: "%", width: 80 }, aspect, mediaWidth, mediaHeight),
    mediaWidth,
    mediaHeight,
  );
}

async function canvasPreview(
  image: HTMLImageElement,
  canvas: HTMLCanvasElement,
  crop: PixelCrop,
  scale = 1,
  rotate = 0,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2d context");
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  const pixelRatio = window.devicePixelRatio;
  canvas.width = Math.floor(crop.width * scaleX * pixelRatio);
  canvas.height = Math.floor(crop.height * scaleY * pixelRatio);
  ctx.scale(pixelRatio, pixelRatio);
  ctx.imageSmoothingQuality = "high";
  const cropX = crop.x * scaleX;
  const cropY = crop.y * scaleY;
  const rotateRads = (rotate * Math.PI) / 180;
  const centerX = image.naturalWidth / 2;
  const centerY = image.naturalHeight / 2;
  ctx.save();
  ctx.translate(-cropX, -cropY);
  ctx.translate(centerX, centerY);
  ctx.rotate(rotateRads);
  ctx.scale(scale, scale);
  ctx.translate(-centerX, -centerY);
  ctx.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight, 0, 0, image.naturalWidth, image.naturalHeight);
  ctx.restore();
}

export default function ImageCropModal({ imageSrc, fileName, onConfirm, onCancel }: ImageCropModalProps) {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [scale, setScale] = useState(1);
  const [rotate, setRotate] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, 1));
  }, []);

  const handleConfirm = async () => {
    if (!completedCrop || !previewCanvasRef.current || !imgRef.current) return;
    setIsProcessing(true);
    try {
      await canvasPreview(imgRef.current, previewCanvasRef.current, completedCrop, scale, rotate);
      previewCanvasRef.current.toBlob((blob) => {
        if (!blob) return;
        const ext = fileName.split(".").pop() || "jpg";
        const croppedFile = new File([blob], `cropped_${fileName}`, { type: ext === "png" ? "image/png" : "image/jpeg" });
        onConfirm(croppedFile);
      }, "image/jpeg", 0.95);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl border border-slate-200/80 dark:border-slate-700 flex flex-col overflow-hidden" style={{maxHeight:"92vh"}}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Ajuster la photo</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">Cadrez votre photo de profil, puis confirmez</p>
          </div>
          <button onClick={onCancel} className="w-9 h-9 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-all">
            <X size={18} />
          </button>
        </div>

        {/* Crop area */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-950/5 dark:bg-slate-950/40 min-h-0">
          <ReactCrop crop={crop} onChange={(_, pct) => setCrop(pct)} onComplete={(c) => setCompletedCrop(c)} aspect={1} circularCrop keepSelection className="max-w-full">
            <img
              ref={imgRef}
              alt="Crop preview"
              src={imageSrc}
              style={{ transform: `scale(${scale}) rotate(${rotate}deg)`, maxHeight: "40vh", maxWidth: "100%", objectFit: "contain" }}
              onLoad={onImageLoad}
            />
          </ReactCrop>
        </div>

        {/* Controls */}
        <div className="px-6 py-4 space-y-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
          {/* Zoom */}
          <div className="flex items-center gap-3">
            <button onClick={() => setScale(s => Math.max(0.5, +(s - 0.1).toFixed(1)))} className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-blue-100 hover:text-blue-600 transition-all"><ZoomOut size={16} /></button>
            <input type="range" min="0.5" max="3" step="0.05" value={scale} onChange={e => setScale(+e.target.value)} className="flex-1 h-2 rounded-full appearance-none bg-slate-200 dark:bg-slate-700 accent-blue-600 cursor-pointer" />
            <button onClick={() => setScale(s => Math.min(3, +(s + 0.1).toFixed(1)))} className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-blue-100 hover:text-blue-600 transition-all"><ZoomIn size={16} /></button>
            <span className="text-xs font-bold text-slate-400 w-10 text-right">{(scale * 100).toFixed(0)}%</span>
          </div>
          {/* Rotation */}
          <div className="flex items-center gap-3">
            <button onClick={() => setRotate(r => (r - 90 + 360) % 360)} className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-blue-100 hover:text-blue-600 transition-all" title="Rotation gauche"><RotateCw size={16} style={{transform:"scaleX(-1)"}} /></button>
            <input type="range" min="0" max="360" step="1" value={rotate} onChange={e => setRotate(+e.target.value)} className="flex-1 h-2 rounded-full appearance-none bg-slate-200 dark:bg-slate-700 accent-blue-600 cursor-pointer" />
            <button onClick={() => setRotate(r => (r + 90) % 360)} className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-blue-100 hover:text-blue-600 transition-all" title="Rotation droite"><RotateCw size={16} /></button>
            <span className="text-xs font-bold text-slate-400 w-10 text-right">{rotate}deg</span>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center font-medium">Faites glisser pour recadrer - Format circulaire optimal pour la photo de profil</p>
        </div>

        {/* Hidden canvas */}
        <canvas ref={previewCanvasRef} className="hidden" />

        {/* Actions */}
        <div className="px-6 pb-6 pt-2 flex gap-3 shrink-0">
          <button onClick={onCancel} className="flex-1 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-[0.98] transition-all">Annuler</button>
          <button onClick={handleConfirm} disabled={!completedCrop || isProcessing} className="flex-1 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-600/30 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            {isProcessing ? <><Loader2 size={16} className="animate-spin" /> Traitement...</> : <><Check size={16} /> Confirmer la photo</>}
          </button>
        </div>
      </div>
    </div>
  );
}
