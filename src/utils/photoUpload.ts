import { supabase } from '../lib/supabase';

// Cloudinary config (upload non signé — pas de backend requis)
const CLOUDINARY_CLOUD_NAME = 'dorfcwv6a';
const CLOUDINARY_UPLOAD_PRESET = 'dmk_unsigned_preset';
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

export const uploadMemberPhoto = async (file: File, email: string): Promise<string> => {
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("La taille de l'image ne doit pas dépasser 5Mo.");
  }

  // 1. Upload direct vers Cloudinary (sans backend, sans CORS)
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    formData.append('folder', 'dmk/profiles');
    // Tag unique par email pour retrouver/remplacer facilement
    const safeTag = email.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    formData.append('tags', safeTag);

    const response = await fetch(CLOUDINARY_UPLOAD_URL, {
      method: 'POST',
      body: formData,
    });

    if (response.ok) {
      const data = await response.json();
      if (data.secure_url) {
        const photoUrl: string = data.secure_url;
        // Mettre à jour la DB Supabase avec l'URL Cloudinary
        await supabase
          .from('members')
          .update({ photo_url: photoUrl })
          .eq('email', email);
        console.log('Photo uploadée sur Cloudinary:', photoUrl);
        return photoUrl;
      }
    } else {
      const errData = await response.json().catch(() => ({}));
      console.warn('Cloudinary upload échoué:', errData);
    }
  } catch (cloudinaryErr) {
    console.warn('Cloudinary indisponible, basculement vers Supabase Storage...', cloudinaryErr);
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
      await supabase
        .from('members')
        .update({ photo_url: photoUrl })
        .eq('email', email);

      console.log('Photo uploadée sur Supabase Storage:', photoUrl);
      return photoUrl;
    }
  } catch (storageErr) {
    console.warn('Supabase Storage indisponible, basculement vers Base64...', storageErr);
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
        console.log('Photo sauvegardée en Base64 dans la DB');
        resolve(base64Url);
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Erreur de sauvegarde de la photo de profil."));
      }
    };
    reader.readAsDataURL(file);
  });
};
