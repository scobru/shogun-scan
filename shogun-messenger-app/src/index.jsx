import { Router, Route } from '@solidjs/router';
import { render } from 'solid-js/web';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './index.css';
import WelcomePage from './pages/welcome/welcome';
import ChatPage from './pages/chat/chat';
import ProfilePage from './pages/profile/profile';
import SettingsPage from './pages/settings/settings';
import AppearanceSettingsPage from './pages/settings/appearanceSettings';
import SystemsStatusSettingsPage from './pages/settings/systemsStatusSettings';
import { NavigationProvider } from './contexts/navigationContext';

if (typeof global === 'undefined') {
  window.global = window;
}

render(() => (
  <Router root={App}>
    <NavigationProvider>
      <Route path="/" component={WelcomePage} />
      <Route path="/chat/:chatId/:pub" component={ChatPage} />
      <Route path="/profile" component={ProfilePage} />
      <Route path="/settings" component={SettingsPage}>
        <Route path="/" component={ProfilePage} />
        <Route path="/profile" component={ProfilePage} />
        <Route path="/appearance" component={AppearanceSettingsPage} />
        <Route path="/systems-status" component={SystemsStatusSettingsPage} />
      </Route>
      <Route path="*" component={WelcomePage} />
    </NavigationProvider>
  </Router>
), document.getElementById('root'));

const updateSW = registerSW({
  onNeedRefresh() {},
  onOfflineReady() {},
});

if (typeof window !== 'undefined') {
  import('./sw');
}
