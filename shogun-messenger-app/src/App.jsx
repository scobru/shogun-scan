import { authentication, certificates, user } from 'lonewolf-protocol';
import { Route, Router } from '@solidjs/router';
import { createSignal, onMount } from 'solid-js';
import LogoutButton from './components/buttons/logout';
import SettingsButton from './components/buttons/settings';
import Content from './components/content/content';
import AddFriendModal from './components/modals/addFriend';
import Navbar from './components/navbar/navbar';
import NavbarContent from './components/navbar/navbarContent';
import NavbarHeader from './components/navbar/navbarHeader';
import MiniProfile from './components/profile/miniProfile';
import Sidebar from './components/sidebar/sidebar';
import SidebarContent from './components/sidebar/sidebarContent';
import SidebarFooter from './components/sidebar/sidebarFooter';
import SidebarHeader from './components/sidebar/sidebarHeader';
import Tabs from './components/tabs/tabs';
import useModals from './hooks/models';
import AuthenticationPage from './pages/authentication/authentication';
import ChatPage from './pages/chat/chat';
import ProfilePage from './pages/profile/profile';
import AppearanceSettingsPage from './pages/settings/appearanceSettings';
import SettingsPage from './pages/settings/settings';
import SystemsStatusSettingsPage from './pages/settings/systemsStatusSettings';
import ChatsTabPage from './pages/tabs/chatsTab';
import FriendsTabPage from './pages/tabs/friendsTab';
import WelcomePage from './pages/welcome/welcome';
import LoadingProvider from './providers/loadingProvider';
import NotificationProvider from './providers/notificationProvider';
import ThemeProvider from './providers/themeProvider';
import { initializeIpfs } from './utils/ipfs';

function App() {
  let [isAuthenticated, setIsAuthenticated] = createSignal(false);

  let [loadingMessage, setLoadingMessage] = createSignal(undefined);
  let [isLoading, setIsLoading] = createSignal(true);

  let [modals, editModals] = useModals();

  onMount(() => {
    setIsLoading(true);
    setLoadingMessage('Loading the application.');

    (async () => {
      setIsLoading(true);
      setLoadingMessage('Initializing Ipfs.');

      await initializeIpfs(window, () => {
        authentication.isAuthenticated.subscribe((value) => {
          if (value) {
            certificates.generateFriendRequestsCertificate(
              ({ errMessage, success }) => {
                if (errMessage) return console.log(errMessage);
                else return console.log(success);
              }
            );

            setIsLoading(false);
          } else {
            setIsLoading(false);
          }

          setIsAuthenticated(value);
        });

        authentication.checkAuth();
      });
    })();
  });

  return (
    <LoadingProvider message={loadingMessage} busy={isLoading}>
      {isAuthenticated() && (
        <ThemeProvider
          setIsLoading={setIsLoading}
          setLoadingMessage={setLoadingMessage}
        >
          <div class="z-10 w-screen h-screen dark:bg-signal-background-dark bg-white dark:text-signal-text-dark text-signal-text-light select-none outline-none">
            <NotificationProvider />

            {modals.addFriend && (
              <AddFriendModal
                onClose={() => editModals({ addFriend: false })}
              />
            )}

            <div class="flex flex-col md:flex-row w-full h-full">
              <Sidebar class="w-64 dark:bg-signal-sidebar-dark bg-signal-sidebar-light border-r dark:border-signal-border-dark border-signal-border-light">
                <SidebarHeader title="Shogun" class="px-4 py-3 border-b dark:border-signal-border-dark border-signal-border-light" />
                <SidebarContent class="flex-1">
                  <Tabs
                    class="text-sm"
                    activeClass="text-signal-blue border-signal-blue font-medium"
                    inactiveClass="dark:text-signal-text-muted-dark text-signal-text-muted-light hover:dark:text-signal-text-dark hover:text-signal-text-light border-transparent"
                    tabs={[
                      {
                        label: 'Chats',
                        content: <ChatsTabPage />,
                      },
                      {
                        label: 'Friends',
                        content: <FriendsTabPage />,
                      },
                    ]}
                  />
                </SidebarContent>
                <SidebarFooter
                  class="px-4 py-3 border-t dark:border-signal-border-dark border-signal-border-light"
                  start={() => <MiniProfile />}
                  end={() => (
                    <div class="flex space-x-3">
                      <SettingsButton class="dark:text-signal-text-muted-dark text-signal-text-muted-light hover:text-signal-blue" />
                      <LogoutButton class="dark:text-signal-text-muted-dark text-signal-text-muted-light hover:text-signal-blue" />
                    </div>
                  )}
                />
              </Sidebar>

              <Navbar class="md:hidden dark:bg-signal-sidebar-dark bg-signal-sidebar-light border-b dark:border-signal-border-dark border-signal-border-light">
                <NavbarHeader title="Shogun" class="px-4 py-3" />
                <NavbarContent class="px-4 py-2">
                  <div class="flex justify-between items-center">
                    <MiniProfile />
                    <div class="flex space-x-3">
                      <SettingsButton class="dark:text-signal-text-muted-dark text-signal-text-muted-light hover:text-signal-blue" />
                      <LogoutButton class="dark:text-signal-text-muted-dark text-signal-text-muted-light hover:text-signal-blue" />
                    </div>
                  </div>
                </NavbarContent>
              </Navbar>

              <Content class="flex-1 dark:bg-signal-background-dark bg-white">
                <Router>
                  <Route path="/" component={WelcomePage} />
                  <Route path="/chat/:chatId/:pub" component={ChatPage} />
                  <Route path="/profile" component={() => <ProfilePage backEnabled={true} />} />
                  <Route path="/settings" component={SettingsPage}>
                    <Route path="/" component={ProfilePage} />
                    <Route path="/profile" component={ProfilePage} />
                    <Route path="/appearance" component={AppearanceSettingsPage} />
                    <Route path="/systems-status" component={SystemsStatusSettingsPage} />
                  </Route>
                </Router>
              </Content>
            </div>
          </div>
        </ThemeProvider>
      )}

      {!isAuthenticated() && <AuthenticationPage />}
    </LoadingProvider>
  );
}

export default App;