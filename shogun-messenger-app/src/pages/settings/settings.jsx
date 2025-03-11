import { useNavigate } from '@solidjs/router';
import { createSignal } from 'solid-js';
import SettingsHeader from '../../components/settings/settingsHeader';

let SettingsPage = (props) => {
  let navigate = useNavigate();

  let [menuActive, setMenuActive] = createSignal(true);

  return (
    <div class="absolute left-0 top-0 flex flex-col w-screen h-screen animate-fade-in dark:bg-signal-background-dark bg-white overflow-y-auto">
      <SettingsHeader activateMenu={() => setMenuActive(!menuActive())} />

      <div class="flex w-full h-full dark:bg-signal-background-dark bg-white overflow-hidden">
        <div
          class={`flex flex-col flex-none transition-wp duration-500 ease ${
            menuActive() ? 'w-5/6 max-w-lg p-3 space-y-3' : 'w-0 space-y-3'
          } md:w-1/3 md:p-3 lg:space-y-3 h-full dark:bg-signal-sidebar-dark bg-signal-sidebar-light overflow-y-auto overflow-x-hidden`}
        >
          <div class="flex flex-col md:hidden space-y-2.5">
            <div
              class="flex justify-start items-center p-3.5 dark:bg-signal-surface-dark bg-signal-surface-light hover:bg-opacity-80 rounded-md overflow-x-hidden cursor-pointer border-l-4 border-transparent hover:border-signal-blue transition-all"
              onClick={() => {
                navigate('/settings/profile');
                setMenuActive(false);
              }}
            >
              <div class="mr-3 text-signal-blue">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
                </svg>
              </div>
              <div class="dark:text-signal-text-dark text-signal-text-light font-medium">Profile</div>
            </div>

            <div
              class="flex justify-start items-center p-3.5 dark:bg-signal-surface-dark bg-signal-surface-light hover:bg-opacity-80 rounded-md overflow-x-hidden cursor-pointer border-l-4 border-transparent hover:border-signal-blue transition-all"
              onClick={() => {
                navigate('/settings/appearance');
                setMenuActive(false);
              }}
            >
              <div class="mr-3 text-signal-blue">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zm1 14a1 1 0 100-2 1 1 0 000 2zm5-1.757l4.9-4.9a2 2 0 000-2.828L13.485 5.1a2 2 0 00-2.828 0L10 5.757v8.486zM16 18H9.071l6-6H16a2 2 0 012 2v2a2 2 0 01-2 2z" clip-rule="evenodd" />
                </svg>
              </div>
              <div class="dark:text-signal-text-dark text-signal-text-light font-medium">Appearance</div>
            </div>

            <div
              class="flex justify-start items-center p-3.5 dark:bg-signal-surface-dark bg-signal-surface-light hover:bg-opacity-80 rounded-md overflow-x-hidden cursor-pointer border-l-4 border-transparent hover:border-signal-blue transition-all"
              onClick={() => {
                navigate('/settings/systems-status');
                setMenuActive(false);
              }}
            >
              <div class="mr-3 text-signal-blue">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.22l.123.489.804.804A1 1 0 0113 18H7a1 1 0 01-.707-1.707l.804-.804L7.22 15H5a2 2 0 01-2-2V5zm5.771 7H5V5h10v7H8.771z" clip-rule="evenodd" />
                </svg>
              </div>
              <div class="dark:text-signal-text-dark text-signal-text-light font-medium">Systems Status</div>
            </div>
          </div>

          <div class="hidden md:flex md:flex-col md:space-y-2.5">
            <div
              class="flex justify-start items-center p-3.5 dark:bg-signal-surface-dark bg-signal-surface-light hover:bg-opacity-80 rounded-md overflow-x-hidden cursor-pointer border-l-4 border-transparent hover:border-signal-blue transition-all"
              onClick={() => {
                navigate('/settings/profile');
              }}
            >
              <div class="mr-3 text-signal-blue">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
                </svg>
              </div>
              <div class="dark:text-signal-text-dark text-signal-text-light font-medium">Profile</div>
            </div>

            <div
              class="flex justify-start items-center p-3.5 dark:bg-signal-surface-dark bg-signal-surface-light hover:bg-opacity-80 rounded-md overflow-x-hidden cursor-pointer border-l-4 border-transparent hover:border-signal-blue transition-all"
              onClick={() => {
                navigate('/settings/appearance');
              }}
            >
              <div class="mr-3 text-signal-blue">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zm1 14a1 1 0 100-2 1 1 0 000 2zm5-1.757l4.9-4.9a2 2 0 000-2.828L13.485 5.1a2 2 0 00-2.828 0L10 5.757v8.486zM16 18H9.071l6-6H16a2 2 0 012 2v2a2 2 0 01-2 2z" clip-rule="evenodd" />
                </svg>
              </div>
              <div class="dark:text-signal-text-dark text-signal-text-light font-medium">Appearance</div>
            </div>

            <div
              class="flex justify-start items-center p-3.5 dark:bg-signal-surface-dark bg-signal-surface-light hover:bg-opacity-80 rounded-md overflow-x-hidden cursor-pointer border-l-4 border-transparent hover:border-signal-blue transition-all"
              onClick={() => {
                navigate('/settings/systems-status');
              }}
            >
              <div class="mr-3 text-signal-blue">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.22l.123.489.804.804A1 1 0 0113 18H7a1 1 0 01-.707-1.707l.804-.804L7.22 15H5a2 2 0 01-2-2V5zm5.771 7H5V5h10v7H8.771z" clip-rule="evenodd" />
                </svg>
              </div>
              <div class="dark:text-signal-text-dark text-signal-text-light font-medium">Systems Status</div>
            </div>
          </div>
        </div>
        <div
          class={`flex-grow h-full overflow-y-auto ${
            menuActive() ? 'rounded-tl-lg' : 'rounded-t-lg'
          } lg:rounded-tr-none lg:rounded-tl-lg overflow-x-hidden dark:bg-signal-background-dark bg-white`}
        >
          {props.children}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
