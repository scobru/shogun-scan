import React, { useState, useEffect } from 'react';
import { AvatarService } from '../lib/avatar';
import { IPFSClient } from '../lib/ipfs';
import { useUser } from '../hooks/useUser';

interface ProfileProps {
  onUpdate?: () => void;
}

export const Profile: React.FC<ProfileProps> = ({ onUpdate }) => {
  const { user, updateUserProfile } = useUser();
  const [displayName, setDisplayName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const ipfs = new IPFSClient();

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
      loadAvatar();
    }
  }, [user]);

  const loadAvatar = async () => {
    if (user?.publicKey) {
      try {
        const avatarUrl = await AvatarService.getAvatar(user.publicKey);
        setAvatar(avatarUrl);
      } catch (error) {
        console.error('Errore nel caricamento avatar:', error);
      }
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError('');

      if (!user) {
        throw new Error('Utente non autenticato');
      }

      // Aggiorna il profilo
      await updateUserProfile({
        displayName,
        avatar
      });

      if (onUpdate) {
        onUpdate();
      }
    } catch (error: any) {
      setError(error.message || 'Errore durante il salvataggio');
      console.error('Errore nel salvataggio profilo:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;

      // Carica su IPFS
      const added = await ipfs.add(file);
      const url = ipfs.getGatewayURL(added);
      
      setAvatar(url);
    } catch (error: any) {
      setError(error.message || 'Errore nel caricamento avatar');
      console.error('Errore upload avatar:', error);
    }
  };

  if (!user) {
    return <div>Effettua il login per visualizzare il profilo</div>;
  }

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Profilo</h2>
      
      <div className="mb-4">
        <img 
          src={avatar} 
          alt="Avatar"
          className="w-32 h-32 rounded-full mx-auto mb-2"
        />
        <input
          type="file"
          accept="image/*"
          onChange={handleAvatarUpload}
          className="hidden"
          id="avatar-upload"
        />
        <label 
          htmlFor="avatar-upload"
          className="block text-center text-blue-500 hover:text-blue-700 cursor-pointer"
        >
          Cambia avatar
        </label>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">
          Nome visualizzato
        </label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="w-full p-2 border rounded"
          placeholder="Il tuo nome"
        />
      </div>

      {error && (
        <div className="text-red-500 mb-4">
          {error}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={loading}
        className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600 disabled:opacity-50"
      >
        {loading ? 'Salvataggio...' : 'Salva modifiche'}
      </button>
    </div>
  );
}; 