import { supabase } from '../lib/supabase';

export const uploadMemberPhoto = async (file: File, email: string): Promise<string> => {
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("La taille de l'image ne doit pas dépasser 5Mo.");
  }

  // 1. Essai via Backend API (Cloudinary)
  try {
    const API_URL = import.meta.env.VITE_API_URL || 
      (typeof window !== 'undefined' && window.location.hostname === 'localhost' 
        ? 'http://localhost:5000' 
        : 'https://dmksytemebackend.onrender.com');

    const formData = new FormData();
    formData.append('photo', file);
    formData.append('email', email);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(`${API_URL}/api/users/upload-photo`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.status === 'success' && data.photo_url) {
        return data.photo_url;
      }
    }
  } catch (backendErr) {
    console.warn("API backend indisponible, basculement vers le mode de secours (Supabase Storage / Base64)...", backendErr);
  }

  // 2. Fallback 1 : Supabase Storage (Bucket 'avatars')
  try {
    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
    const filePath = `profiles/${fileName}`;

    const { error: storageError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { cacheControl: '3600', upsert: true });

    if (!storageError) {
      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const photoUrl = publicUrlData.publicUrl;
      const { error: dbErr } = await supabase
        .from('members')
        .update({ photo_url: photoUrl })
        .eq('email', email);

      if (!dbErr) {
        return photoUrl;
      }
    }
  } catch (storageErr) {
    console.warn("Supabase Storage indisponible, basculement vers Base64...", storageErr);
  }

  // 3. Fallback 2 : Conversion Base64 direct dans la table members
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Impossible de lire l'image sélectionnée."));
    reader.onloadend = async () => {
      try {
        const base64Url = reader.result as string;
        const { error: dbErr } = await supabase
          .from('members')
          .update({ photo_url: base64Url })
          .eq('email', email);

        if (dbErr) throw dbErr;
        resolve(base64Url);
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Erreur de sauvegarde de la photo de profil."));
      }
    };
    reader.readAsDataURL(file);
  });
};
