import { gun } from '@shogun/shogun-protocol';
import { onMount, createSignal, createEffect } from 'solid-js';
import { createStore } from 'solid-js/store';

let useUserSettings = () => {
  // Imposta il tema predefinito in base alle preferenze del sistema
  const prefersDarkMode = typeof window !== 'undefined' && 
    window.matchMedia && 
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  const defaultTheme = prefersDarkMode ? 'dark' : 'light';
  
  let [userSettings, setUserSettings] = createStore(
    {
      theme: defaultTheme
    },
    { name: 'user-settings' }
  );

  let [isInitialized, setIsInitialized] = createSignal(false);

  onMount(() => {
    // Carica le impostazioni dal database Gun
    gun
      .user()
      .get('settings')
      .on((data) => {
        if (data && data.theme) {
          setUserSettings('theme', data.theme);
          setIsInitialized(true);
        } else if (!isInitialized()) {
          // Se non ci sono impostazioni salvate, usa il valore predefinito
          setUserSettings('theme', defaultTheme);
          setIsInitialized(true);
        }
      });
  });

  let settings = () => userSettings;

  let setSettings = (newSettings) => {
    // Aggiorna lo store locale
    setUserSettings({ ...userSettings, ...newSettings });

    // Persisti le impostazioni in Gun
    // Nota: utilizziamo setTimeout per assicurarci che lo store sia aggiornato
    setTimeout(() => {
      gun.user().get('settings').put(userSettings);
    }, 0);
    
    // Log per debugging
    console.log('Aggiornate impostazioni:', { ...userSettings, ...newSettings });
  };

  let loadSettings = (callback) => {
    return gun
      .user()
      .get('settings')
      .once((data) => {
        if (data) {
          // Imposta il tema se presente nei dati
          if (data.theme) {
            setUserSettings('theme', data.theme);
          } else {
            setUserSettings('theme', defaultTheme);
          }
          
          if (callback) callback();
        } else {
          // Se non ci sono dati, imposta il tema predefinito
          setUserSettings('theme', defaultTheme);
          
          // Salva immediatamente il tema predefinito
          gun.user().get('settings').put({ theme: defaultTheme });
          
          if (callback) callback();
        }
      });
  };

  return [settings(), setSettings, loadSettings];
};

export default useUserSettings;
