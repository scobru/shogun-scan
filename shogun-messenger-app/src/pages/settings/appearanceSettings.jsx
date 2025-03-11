import { useNavigation } from '../../contexts/navigationContext';
import { onMount, createSignal, createEffect } from 'solid-js';
import Header from '../../components/header/header';
import BackButton from '../../components/buttons/back';
import useUserSettings from '../../hooks/userSettings';

let AppearanceSettingsPage = ({ backEnabled = false }) => {
  let { navigate } = useNavigation();
  let [settings, setSettings] = useUserSettings();
  let [currentTheme, setCurrentTheme] = createSignal(settings.theme || 'light');

  // Aggiorna il tema locale quando cambia quello nelle impostazioni
  createEffect(() => {
    setCurrentTheme(settings.theme);
  });

  onMount(() => {
    window.scrollTo({
      left: 0,
      top: 0,
      behavior: 'smooth',
    });
  });

  const handleThemeChange = (theme) => {
    setSettings({ theme });
  };

  return (
    <div class="flex flex-col w-full h-full animate-fade-in dark:bg-signal-background-dark bg-white">
      <div class="flex items-center justify-between px-6 py-4 border-b dark:border-signal-border-dark border-signal-border-light">
        <div class="flex items-center space-x-4">
          {backEnabled && <BackButton class="dark:text-signal-text-muted-dark text-signal-text-muted-light hover:text-signal-blue" />}
          <h1 class="text-xl font-medium dark:text-signal-text-dark text-signal-text-light">Appearance</h1>
        </div>
      </div>

      <div class="flex flex-col w-full h-full p-6 space-y-8 overflow-y-auto">
        <div class="flex flex-col space-y-5">
          <h2 class="text-lg font-medium dark:text-signal-text-dark text-signal-text-light">THEME</h2>

          <div class="flex flex-col space-y-4 rounded-lg">
            {/* Tema chiaro */}
            <div class="flex justify-between items-center p-4 dark:bg-signal-surface-dark bg-signal-surface-light rounded-lg border dark:border-signal-border-dark border-signal-border-light">
              <div class="flex items-center">
                <div class="p-1 mr-4 text-signal-blue">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <div class="dark:text-signal-text-dark text-signal-text-light font-medium">Light Theme</div>
              </div>
              
              <button
                class={`px-4 py-2 rounded-md transition-colors duration-200 ${
                  currentTheme() === 'light'
                    ? 'bg-signal-blue text-white'
                    : 'dark:bg-signal-surface-dark bg-signal-surface-light dark:text-signal-text-muted-dark text-signal-text-muted-light border dark:border-signal-border-dark border-signal-border-light hover:text-signal-blue'
                }`}
                onClick={() => handleThemeChange('light')}
              >
                {currentTheme() === 'light' ? 'Active' : 'Use'}
              </button>
            </div>

            {/* Tema scuro */}
            <div class="flex justify-between items-center p-4 dark:bg-signal-surface-dark bg-signal-surface-light rounded-lg border dark:border-signal-border-dark border-signal-border-light">
              <div class="flex items-center">
                <div class="p-1 mr-4 text-signal-blue">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                </div>
                <div class="dark:text-signal-text-dark text-signal-text-light font-medium">Dark Theme</div>
              </div>
              
              <button
                class={`px-4 py-2 rounded-md transition-colors duration-200 ${
                  currentTheme() === 'dark'
                    ? 'bg-signal-blue text-white'
                    : 'dark:bg-signal-surface-dark bg-signal-surface-light dark:text-signal-text-muted-dark text-signal-text-muted-light border dark:border-signal-border-dark border-signal-border-light hover:text-signal-blue'
                }`}
                onClick={() => handleThemeChange('dark')}
              >
                {currentTheme() === 'dark' ? 'Active' : 'Use'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppearanceSettingsPage;
