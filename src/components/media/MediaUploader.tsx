import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, 
  X, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Image,
  Video,
  Music,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';

// Allowed MIME types
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/aac', 'audio/webm'];

// Max file sizes
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_AUDIO_SIZE = 50 * 1024 * 1024; // 50MB

export type MediaType = 'image' | 'video' | 'audio';

interface MediaUploaderProps {
  onUploadComplete: (url: string, type: MediaType) => void;
  onUploadError?: (error: string) => void;
  bucket?: string;
  acceptedTypes?: MediaType[];
  maxRetries?: number;
  className?: string;
  children?: React.ReactNode;
}

interface UploadState {
  status: 'idle' | 'validating' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
  fileName?: string;
}

export const MediaUploader = ({
  onUploadComplete,
  onUploadError,
  bucket = 'media',
  acceptedTypes = ['image', 'video', 'audio'],
  maxRetries = 3,
  className,
  children,
}: MediaUploaderProps) => {
  const { toast } = useToast();
  const [uploadState, setUploadState] = useState<UploadState>({
    status: 'idle',
    progress: 0,
  });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const getAcceptString = () => {
    const accepts: string[] = [];
    if (acceptedTypes.includes('image')) accepts.push(...ALLOWED_IMAGE_TYPES);
    if (acceptedTypes.includes('video')) accepts.push(...ALLOWED_VIDEO_TYPES);
    if (acceptedTypes.includes('audio')) accepts.push(...ALLOWED_AUDIO_TYPES);
    return accepts.join(',');
  };

  const getMediaType = (mimeType: string): MediaType | null => {
    if (ALLOWED_IMAGE_TYPES.includes(mimeType)) return 'image';
    if (ALLOWED_VIDEO_TYPES.includes(mimeType)) return 'video';
    if (ALLOWED_AUDIO_TYPES.includes(mimeType)) return 'audio';
    return null;
  };

  const validateFile = (file: File): { valid: boolean; error?: string; type?: MediaType } => {
    const mediaType = getMediaType(file.type);
    
    if (!mediaType) {
      return { 
        valid: false, 
        error: `Unsupported file type. Allowed: JPG, PNG, WebP, MP4, WebM, MOV, MP3, WAV, AAC` 
      };
    }

    if (!acceptedTypes.includes(mediaType)) {
      return { 
        valid: false, 
        error: `${mediaType} files are not accepted here` 
      };
    }

    // Check file size
    const maxSize = mediaType === 'video' ? MAX_VIDEO_SIZE : 
                    mediaType === 'audio' ? MAX_AUDIO_SIZE : MAX_IMAGE_SIZE;
    
    if (file.size > maxSize) {
      const maxMB = Math.round(maxSize / (1024 * 1024));
      return { 
        valid: false, 
        error: `File too large. Maximum size for ${mediaType}s is ${maxMB}MB` 
      };
    }

    // Sanitize filename
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    if (sanitizedName !== file.name) {
      console.log('Filename sanitized:', file.name, '->', sanitizedName);
    }

    return { valid: true, type: mediaType };
  };

  const uploadWithRetry = async (
    file: File, 
    filePath: string, 
    attempt: number = 1
  ): Promise<string> => {
    try {
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      if (!urlData?.publicUrl) {
        throw new Error('Failed to get public URL');
      }

      // Add cache-busting parameter
      const publicUrl = `${urlData.publicUrl}?v=${Date.now()}`;
      
      return publicUrl;
    } catch (error) {
      if (attempt < maxRetries) {
        console.log(`Upload attempt ${attempt} failed, retrying...`);
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        return uploadWithRetry(file, filePath, attempt + 1);
      }
      throw error;
    }
  };

  const handleUpload = async (file: File) => {
    setUploadState({ status: 'validating', progress: 0, fileName: file.name });

    // Validate
    const validation = validateFile(file);
    if (!validation.valid || !validation.type) {
      setUploadState({ status: 'error', progress: 0, error: validation.error });
      onUploadError?.(validation.error || 'Validation failed');
      toast({
        title: 'Upload failed',
        description: validation.error,
        variant: 'destructive',
      });
      return;
    }

    // Create preview
    if (validation.type === 'image' || validation.type === 'video') {
      const preview = URL.createObjectURL(file);
      setPreviewUrl(preview);
    }

    setUploadState({ status: 'uploading', progress: 10, fileName: file.name });

    try {
      // Get user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Generate file path
      const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
      const sanitizedExt = ext.replace(/[^a-z0-9]/g, '');
      const filePath = `${user.id}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${sanitizedExt}`;

      setUploadState(prev => ({ ...prev, progress: 30 }));

      // Upload with retry
      const publicUrl = await uploadWithRetry(file, filePath);

      setUploadState({ status: 'success', progress: 100, fileName: file.name });
      
      onUploadComplete(publicUrl, validation.type);
      
      toast({
        title: 'Upload complete',
        description: 'Your media has been uploaded successfully',
      });

      // Reset after a short delay
      setTimeout(() => {
        setUploadState({ status: 'idle', progress: 0 });
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
          setPreviewUrl(null);
        }
      }, 2000);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      setUploadState({ status: 'error', progress: 0, error: errorMessage, fileName: file.name });
      onUploadError?.(errorMessage);
      toast({
        title: 'Upload failed',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUpload(file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRetry = () => {
    fileInputRef.current?.click();
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setUploadState({ status: 'idle', progress: 0 });
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  const renderStatusIcon = () => {
    switch (uploadState.status) {
      case 'validating':
      case 'uploading':
        return <Loader2 className="h-5 w-5 animate-spin" />;
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      default:
        return <Upload className="h-5 w-5" />;
    }
  };

  const getTypeIcon = () => {
    if (acceptedTypes.length === 1) {
      switch (acceptedTypes[0]) {
        case 'image': return <Image className="h-8 w-8" />;
        case 'video': return <Video className="h-8 w-8" />;
        case 'audio': return <Music className="h-8 w-8" />;
      }
    }
    return <Upload className="h-8 w-8" />;
  };

  // If children provided, render as trigger
  if (children) {
    return (
      <>
        <input
          ref={fileInputRef}
          type="file"
          accept={getAcceptString()}
          onChange={handleFileSelect}
          className="hidden"
        />
        <div onClick={() => fileInputRef.current?.click()}>
          {children}
        </div>
        
        {/* Upload overlay */}
        <AnimatePresence>
          {uploadState.status !== 'idle' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                className="bg-card rounded-2xl p-6 w-full max-w-sm shadow-lg border"
              >
                <div className="flex items-center gap-3 mb-4">
                  {renderStatusIcon()}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{uploadState.fileName}</p>
                    <p className="text-sm text-muted-foreground">
                      {uploadState.status === 'validating' && 'Validating...'}
                      {uploadState.status === 'uploading' && 'Uploading...'}
                      {uploadState.status === 'success' && 'Complete!'}
                      {uploadState.status === 'error' && uploadState.error}
                    </p>
                  </div>
                  {uploadState.status !== 'success' && (
                    <Button variant="ghost" size="icon" onClick={handleCancel}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                
                {(uploadState.status === 'uploading' || uploadState.status === 'validating') && (
                  <Progress value={uploadState.progress} className="h-2" />
                )}

                {uploadState.status === 'error' && (
                  <Button 
                    variant="outline" 
                    className="w-full mt-4" 
                    onClick={handleRetry}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Try Again
                  </Button>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }

  // Default drop zone UI
  return (
    <div className={cn("relative", className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept={getAcceptString()}
        onChange={handleFileSelect}
        className="hidden"
      />
      
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-xl p-8 cursor-pointer transition-colors",
          "flex flex-col items-center justify-center gap-4 text-center",
          "hover:border-primary hover:bg-primary/5",
          uploadState.status === 'error' && "border-destructive bg-destructive/5",
          uploadState.status === 'success' && "border-green-500 bg-green-500/5",
        )}
      >
        {previewUrl && uploadState.status !== 'idle' ? (
          <div className="w-full aspect-video rounded-lg overflow-hidden bg-muted">
            <img 
              src={previewUrl} 
              alt="Preview" 
              className="w-full h-full object-contain"
            />
          </div>
        ) : (
          <div className="text-muted-foreground">
            {getTypeIcon()}
          </div>
        )}

        <div className="space-y-1">
          <p className="font-medium">
            {uploadState.status === 'idle' && 'Click to upload'}
            {uploadState.status === 'validating' && 'Validating...'}
            {uploadState.status === 'uploading' && `Uploading... ${uploadState.progress}%`}
            {uploadState.status === 'success' && 'Upload complete!'}
            {uploadState.status === 'error' && 'Upload failed'}
          </p>
          <p className="text-sm text-muted-foreground">
            {uploadState.status === 'idle' && `Supported: ${acceptedTypes.join(', ')}`}
            {uploadState.status === 'error' && uploadState.error}
          </p>
        </div>

        {(uploadState.status === 'uploading' || uploadState.status === 'validating') && (
          <Progress value={uploadState.progress} className="w-full max-w-xs" />
        )}

        {uploadState.status === 'error' && (
          <Button variant="outline" size="sm" onClick={(e) => {
            e.stopPropagation();
            handleRetry();
          }}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        )}
      </motion.div>
    </div>
  );
};

// Hook for programmatic uploads
export const useMediaUpload = (bucket: string = 'media', maxRetries: number = 3) => {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(async (file: File): Promise<{ url: string; type: MediaType } | null> => {
    setIsUploading(true);
    setProgress(0);
    setError(null);

    const mediaType = getMediaTypeFromFile(file);
    if (!mediaType) {
      setError('Unsupported file type');
      setIsUploading(false);
      return null;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
      const filePath = `${user.id}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;

      setProgress(30);

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      setProgress(80);

      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      if (!urlData?.publicUrl) {
        throw new Error('Failed to get public URL');
      }

      setProgress(100);
      setIsUploading(false);

      return { 
        url: `${urlData.publicUrl}?v=${Date.now()}`,
        type: mediaType 
      };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMessage);
      setIsUploading(false);
      return null;
    }
  }, [bucket, maxRetries]);

  return { upload, isUploading, progress, error };
};

const getMediaTypeFromFile = (file: File): MediaType | null => {
  if (ALLOWED_IMAGE_TYPES.includes(file.type)) return 'image';
  if (ALLOWED_VIDEO_TYPES.includes(file.type)) return 'video';
  if (ALLOWED_AUDIO_TYPES.includes(file.type)) return 'audio';
  return null;
};
