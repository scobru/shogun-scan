import { useNavigation } from '../../contexts/navigationContext';
import BackButton from '../buttons/back';
import MenuButton from '../buttons/menu';

let SettingsHeader = ({ activateMenu }) => {
  let { navigate } = useNavigation();

  return (
    <div class="flex justify-between items-center w-full h-auto p-3 space-x-2 bg-gray-100 dark:bg-gray-800">
      <div class="flex justify-start items-center space-x-3">
        <BackButton onClick={() => navigate('/')} />
        <div class="text-md md:text-lg font-bold text-gray-900 dark:text-white select-none">
          Settings
        </div>
      </div>

      <div class="block md:hidden">
        <MenuButton onClick={activateMenu} />
      </div>
    </div>
  );
};

export default SettingsHeader;
