<a href="https://rainbowkit.com">
  <img alt="rainbowkit" src="https://user-images.githubusercontent.com/372831/168174718-685980e0-391e-4621-94a1-29bf83979fa5.png" />
</a>

# Rainbow Button

The simplest way to add support for Rainbow Wallet to dApps built on [wagmi](https://wagmi.sh/).

This package is designed to be installed independent of [RainbowKit](https://www.rainbowkit.com).

## Usage

### Install

Install the `@rainbow-me/rainbow-button` package and its peer dependencies, [wagmi](https://wagmi.sh/), [viem](https://viem.sh/), and [@tanstack/react-query](https://tanstack.com/query/v5).

```bash
npm install @rainbow-me/rainbow-button wagmi viem@2.x @tanstack/react-query
```

### Import

Import Rainbow Button and wagmi.

```tsx
import '@rainbow-me/rainbow-button/styles.css';
import {
  RainbowConnector,
  RainbowButtonProvider,
} from '@rainbow-me/rainbow-button';
...
import { createConfig, WagmiConfig } from 'wagmi';
```

### Adopt the connector

The `RainbowConnector` supports connecting with Rainbow just like Wagmi's native `MetaMaskConnector` from `wagmi/connectors/metaMask`.

Create an instance of the `RainbowConnector` and provide it in your wagmi config `connectors` list. Supply your `chains` list and your WalletConnect v2 `projectId`. You can obtain a `projectId` from [WalletConnect Cloud](https://cloud.reown.com/sign-in). This is absolutely free and only takes a few minutes.

```tsx
const config = createConfig({
  connectors: [new RainbowConnector({ chains, projectId })],
  publicClient
});
```

### Wrap providers

Wrap your application with `RainbowButtonProvider`, [`WagmiProvider`](https://wagmi.sh/react/api/WagmiProvider#wagmiprovider), and [`QueryClientProvider`](https://tanstack.com/query/v4/docs/framework/react/reference/QueryClientProvider).

```tsx
const App = () => {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowButtonProvider>
          {/* Your App */}
        </RainbowButtonProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};
```

### Add the Rainbow button

Then, in your app, import and render the `RainbowButton` component.

```tsx
import { RainbowButton } from '@rainbow-me/rainbow-button';

export const YourApp = () => {
  return <RainbowButton/>;
};
```

## Documentation

You can reference the [Adoption Guide](https://www.rainbowkit.com/guides/rainbow-button) for more information.

### Custom Rainbow button

The `RainbowButton.Custom` component is available for custom button implementations and styling.

```tsx
<RainbowButton.Custom>
  {({ ready, connect }) => {
    return (
      <button
        type="button"
        disabled={!ready}
        onClick={connect}
      >
        Connect Rainbow
      </button>
    );
  }}
</RainbowButton.Custom>
```

## Try it out

You can use the CodeSandbox links below try out the Rainbow Button:
- [with Next.js](https://codesandbox.io/p/sandbox/github/rainbow-me/rainbowkit/tree/main/examples/with-next-rainbow-button)

## Contributing

Please follow our [contributing guidelines](/.github/CONTRIBUTING.md).

## License

Licensed under the MIT License, Copyright © 2022-present [Rainbow](https://rainbow.me).

See [LICENSE](/LICENSE) for more information.

# Shogun Button

Un componente React per integrare facilmente l'autenticazione Shogun nelle tue applicazioni.

## Installazione

```bash
npm install @shogun/shogun-button
# o
yarn add @shogun/shogun-button
# o
pnpm add @shogun/shogun-button
```

## Utilizzo di base

```jsx
import React from 'react';
import { ShogunButton, ShogunButtonProvider, shogunConnector } from '@shogun/shogun-button';
import '@shogun/shogun-button/styles.css';

function App() {
  // Inizializza il connettore Shogun
  const { sdk, options } = shogunConnector({
    appName: 'La mia App',
    appDescription: 'Una fantastica app con autenticazione Shogun',
    appUrl: 'https://mia-app.it',
    appIcon: 'https://mia-app.it/logo.png',
  });

  return (
    <ShogunButtonProvider 
      sdk={sdk}
      options={options}
      onLoginSuccess={(data) => {
        console.log('Login avvenuto con successo!', data);
      }}
      onSignupSuccess={(data) => {
        console.log('Registrazione avvenuta con successo!', data);
      }}
      onError={(error) => {
        console.error('Si è verificato un errore:', error);
      }}
    >
      <div>
        <h1>Benvenuto nella mia app</h1>
        <ShogunButton />
      </div>
    </ShogunButtonProvider>
  );
}

export default App;
```

## Componente personalizzato

Puoi personalizzare l'aspetto del pulsante utilizzando `ShogunButton.Custom`:

```jsx
<ShogunButton.Custom>
  <div className="mio-pulsante-personalizzato">
    Accedi con Shogun
  </div>
</ShogunButton.Custom>
```

## Hook useShogun

Puoi accedere direttamente allo stato e alle funzionalità di autenticazione Shogun utilizzando l'hook `useShogun`:

```jsx
import { useShogun } from '@shogun/shogun-button';

function UserProfile() {
  const { 
    isLoggedIn, 
    username, 
    userPub, 
    wallet,
    login,
    signUp,
    loginWithMetaMask,
    signUpWithMetaMask,
    loginWithWebAuthn,
    signUpWithWebAuthn,
    logout
  } = useShogun();

  if (!isLoggedIn) {
    return <div>Non hai effettuato l'accesso</div>;
  }

  return (
    <div>
      <h2>Profilo Utente</h2>
      <p>Username: {username}</p>
      <p>UserPub: {userPub}</p>
      <p>Indirizzo Wallet: {wallet?.address}</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

## API

### ShogunButtonProvider

Il provider che fornisce il contesto Shogun alla tua applicazione.

#### Props

| Prop | Tipo | Descrizione |
|------|------|-------------|
| sdk | ShogunSDK | L'istanza SDK Shogun, creata con `shogunConnector` |
| options | Object | Opzioni di configurazione |
| onLoginSuccess | Function | Callback chiamato quando il login ha successo |
| onSignupSuccess | Function | Callback chiamato quando la registrazione ha successo |
| onError | Function | Callback chiamato quando si verifica un errore |

### shogunConnector

Funzione che crea un connettore Shogun.

#### Parametri

| Parametro | Tipo | Descrizione |
|-----------|------|-------------|
| appName | string | Il nome della tua applicazione |
| appDescription | string (opzionale) | Descrizione della tua applicazione |
| appUrl | string (opzionale) | URL della tua applicazione |
| appIcon | string (opzionale) | URL dell'icona della tua applicazione |
| showMetamask | boolean (opzionale) | Mostra l'opzione di login con MetaMask |
| showWebauthn | boolean (opzionale) | Mostra l'opzione di login con WebAuthn |
| darkMode | boolean (opzionale) | Attiva il tema scuro |

### ShogunButton

Un pulsante per attivare l'autenticazione Shogun.

### useShogun

Hook per accedere al contesto Shogun.

#### Restituisce

| Proprietà | Tipo | Descrizione |
|-----------|------|-------------|
| sdk | ShogunSDK | L'istanza SDK Shogun |
| options | Object | Opzioni di configurazione |
| isLoggedIn | boolean | Indica se l'utente ha effettuato l'accesso |
| userPub | string | La chiave pubblica dell'utente |
| username | string | Il nome utente |
| wallet | HDNodeWallet | Il wallet dell'utente |
| login | Function | Funzione per effettuare il login |
| signUp | Function | Funzione per effettuare la registrazione |
| loginWithMetaMask | Function | Funzione per effettuare il login con MetaMask |
| signUpWithMetaMask | Function | Funzione per effettuare la registrazione con MetaMask |
| loginWithWebAuthn | Function | Funzione per effettuare il login con WebAuthn |
| signUpWithWebAuthn | Function | Funzione per effettuare la registrazione con WebAuthn |
| logout | Function | Funzione per effettuare il logout |

## Licenza

MIT
