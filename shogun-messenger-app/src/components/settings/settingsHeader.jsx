import { useNavigation } from '../../contexts/navigationContext';
import BackButton from '../buttons/back';
import MenuButton from '../buttons/menu';

let SettingsHeader = ({ activateMenu }) => {
  let { navigate } = useNavigation();

  return (
    <div class="flex justify-between items-center w-full h-auto px-4 py-3.5 space-x-2 dark:bg-signal-surface-dark bg-signal-surface-light border-b dark:border-signal-border-dark border-signal-border-light shadow-sm">
      <div class="flex justify-start items-center space-x-3">
        <BackButton 
          onClick={() => navigate('/')} 
          class="dark:text-signal-text-muted-dark text-signal-text-muted-light hover:text-signal-blue transition-colors" 
        />
        <div class="text-md md:text-lg font-medium dark:text-signal-text-dark text-signal-text-light select-none">
          Settings
        </div>
      </div>

      <div class="block md:hidden">
        <MenuButton 
          onClick={activateMenu} 
          class="dark:text-signal-text-muted-dark text-signal-text-muted-light hover:text-signal-blue transition-colors"
        />
      </div>
    </div>
  );
};

export default SettingsHeader;
