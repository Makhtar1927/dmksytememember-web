import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import ReactCrop, { type Crop, type PixelCrop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { X, Check, ZoomIn, ZoomOut, RotateCw, RotateCcw, Rotate3d, Loader2 } from "lucide-react";

interface ImageCropModalProps {
  imageSrc: string;
  fileName: string;
  onConfirm: (croppedFile: File) => void;
  onCancel: () => void;
}

function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect: number): Crop {
  return centerCrop(
    makeAspectCrop({ unit: "%", width: 85 }, aspect, mediaWidth, mediaHeight),
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
  const pixelRatio = window.devicePixelRatio || 1;
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

  // Lock background scrolling while modal is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, 1));
  }, []);

  const handleReset = () => {
    setScale(1);
    setRotate(0);
    if (imgRef.current) {
      setCrop(centerAspectCrop(imgRef.current.width, imgRef.current.height, 1));
    }
  };

  const handleConfirm = async () => {
    if (!completedCrop || !previewCanvasRef.current || !imgRef.current) return;
    setIsProcessing(true);
    try {
      await canvasPreview(imgRef.current, previewCanvasRef.current, completedCrop, scale, rotate);
      previewCanvasRef.current.toBlob((blob) => {
        if (!blob) return;
        const ext = fileName.split(".").pop() || "jpg";
        const croppedFile = new File(
          [blob],
          `cropped_${fileName}`,
          { type: ext === "png" ? "image/png" : "image/jpeg" }
        );
        onConfirm(croppedFile);
      }, "image/jpeg", 0.95);
    } finally {
      setIsProcessing(false);
    }
  };

  // Render via createPortal to mount directly to document.body,
  // completely escaping any parent stacking contexts, overflow containers,
  // the mobile bottom navigation bar (z-50), and the floating card button (FAB z-50).
  return createPortal(
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4">
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-[28px] sm:rounded-[32px] shadow-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col overflow-hidden max-h-[92vh] sm:max-h-[90vh] animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 shrink-0 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
              Ajuster la photo
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
              Glissez et zoomez pour cadrer votre profil
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-all active:scale-95"
            aria-label="Fermer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Interactive Crop Viewport */}
        <div
          className="flex-1 overflow-auto p-2 sm:p-4 flex items-center justify-center bg-slate-950/5 dark:bg-slate-950/50 min-h-0 relative touch-none"
        >
          <ReactCrop
            crop={crop}
            onChange={(_, pct) => setCrop(pct)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={1}
            circularCrop
            keepSelection
            className="max-w-full"
          >
            <img
              ref={imgRef}
              alt="Aperçu du recadrage"
              src={imageSrc}
              style={{
                transform: `scale(${scale}) rotate(${rotate}deg)`,
                maxHeight: "34vh",
                maxWidth: "100%",
                objectFit: "contain",
                transition: "transform 0.1s ease-out",
              }}
              onLoad={onImageLoad}
            />
          </ReactCrop>
        </div>

        {/* Controls */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 space-y-2.5 sm:space-y-3 border-t border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50/50 dark:bg-slate-900/80">
          {/* Zoom Slider */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setScale((s) => Math.max(0.5, +(s - 0.1).toFixed(1)))}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-blue-50 hover:text-blue-600 active:scale-95 transition-all shrink-0"
              title="Dézoomer"
            >
              <ZoomOut size={14} className="sm:w-4 sm:h-4" />
            </button>
            <div className="flex-1 flex items-center gap-2">
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.05"
                value={scale}
                onChange={(e) => setScale(+e.target.value)}
                className="w-full h-1.5 sm:h-2 rounded-full appearance-none bg-slate-200 dark:bg-slate-700 accent-blue-600 cursor-pointer"
                aria-label="Zoom"
              />
            </div>
            <button
              type="button"
              onClick={() => setScale((s) => Math.min(3, +(s + 0.1).toFixed(1)))}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-blue-50 hover:text-blue-600 active:scale-95 transition-all shrink-0"
              title="Zoomer"
            >
              <ZoomIn size={14} className="sm:w-4 sm:h-4" />
            </button>
            <span className="text-[11px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 w-9 text-right shrink-0">
              {(scale * 100).toFixed(0)}%
            </span>
          </div>

          {/* Rotation & Tools Bar */}
          <div className="flex items-center justify-between gap-1.5 sm:gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => setRotate((r) => (r - 90 + 360) % 360)}
                className="px-2.5 py-1.5 rounded-lg sm:rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-blue-50 hover:text-blue-600 active:scale-95 transition-all flex items-center gap-1.5 text-xs font-bold"
                title="Pivoter à gauche de 90°"
              >
                <RotateCcw size={13} />
                <span className="hidden xs:inline text-[11px]">-90°</span>
              </button>
              <button
                type="button"
                onClick={() => setRotate((r) => (r + 90) % 360)}
                className="px-2.5 py-1.5 rounded-lg sm:rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-blue-50 hover:text-blue-600 active:scale-95 transition-all flex items-center gap-1.5 text-xs font-bold"
                title="Pivoter à droite de 90°"
              >
                <RotateCw size={13} />
                <span className="hidden xs:inline text-[11px]">+90°</span>
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="px-2.5 py-1.5 rounded-lg sm:rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 active:scale-95 transition-all text-xs font-bold flex items-center gap-1"
                title="Recentrer et réinitialiser"
              >
                <Rotate3d size={13} />
                <span className="text-[11px]">Recentrer</span>
              </button>
            </div>

            <div className="flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-200/60 dark:bg-slate-800 px-2 py-1 rounded-md">
              <span>{rotate}°</span>
            </div>
          </div>
        </div>

        {/* Hidden canvas for offscreen high-res render */}
        <canvas ref={previewCanvasRef} className="hidden" />

        {/* Actions - High contrast, touch-friendly, strictly in foreground */}
        <div className="px-4 sm:px-6 pt-3 pb-4 sm:pb-6 flex gap-2.5 sm:gap-3 shrink-0 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="flex-1 py-3 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs sm:text-sm hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!completedCrop || isProcessing}
            className="flex-1 py-3 rounded-xl sm:rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 shadow-lg shadow-blue-600/30 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Traitement...</span>
              </>
            ) : (
              <>
                <Check size={16} />
                <span>Confirmer la photo</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
