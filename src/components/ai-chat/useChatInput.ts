import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';

export function useVoiceInput(setInput: (s: string) => void) {
  const [isListening, setIsListening] = useState(false);

  const toggleVoice = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast.error('Voice input not supported in this browser');
      return;
    }
    if (isListening) { setIsListening(false); return; }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'bn-BD';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results).map((r: any) => r[0].transcript).join('');
      setInput(transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  }, [isListening, setInput]);

  return { isListening, toggleVoice };
}

export function useImageUpload(userId: string | null) {
  const [uploadingImage, setUploadingImage] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Only images allowed'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Max 5MB image size'); return; }

    const { supabase } = await import('@/integrations/supabase/client');
    setUploadingImage(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `ai-chat/${userId || 'anon'}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('chat-images').upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('chat-images').getPublicUrl(path);
      setPendingImage(urlData.publicUrl);
      toast.success('Image ready to send!');
    } catch {
      toast.error('Failed to upload image');
    }
    setUploadingImage(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [userId]);

  return { uploadingImage, pendingImage, setPendingImage, fileInputRef, handleImageSelect };
}
