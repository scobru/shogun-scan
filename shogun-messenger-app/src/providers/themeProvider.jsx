import { onMount, createEffect } from 'solid-js';
import useUserSettings from '../hooks/userSettings';

let ThemeProvider = ({ setIsLoading, setLoadingMessage, children }) => {
  let [settings, setSettings, loadSettings] = useUserSettings();

  // Effect per applicare il tema al document.documentElement
  createEffect(() => {
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  });

  onMount(() => {
    setIsLoading(true);

    setLoadingMessage('Loading Settings');

    loadSettings(() =>
      setTimeout(() => {
        setLoadingMessage('Loaded Settings');

        setTimeout(() => {
          setIsLoading(false);
        }, 1000);
      }, 1000)
    );
  });

  return <div>{children}</div>;
};

export default ThemeProvider;
