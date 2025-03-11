import { useNavigation } from '../../contexts/navigationContext';
import { createSignal, onCleanup, onMount } from 'solid-js';
import Header from '../../components/header/header';
import BackButton from '../../components/buttons/back';
import { gun } from 'lonewolf-protocol';

let SystemsStatusSettingsPage = ({ backEnabled = false }) => {
  let { navigate } = useNavigation();
  let [ipfsOnline, setIpfsOnline] = createSignal(window.ipfs?.isOnline() || false);
  let [swarmConnectivity, setSwarmConnectivity] = createSignal(
    window.swarmConnectivity || false
  );
  let [gunOnline, setGunOnline] = createSignal(true); // Assumiamo Gun online se l'app è in esecuzione
  let [connectedRelays, setConnectedRelays] = createSignal([]);
  let [newRelayUrl, setNewRelayUrl] = createSignal('');
  let [isAddingRelay, setIsAddingRelay] = createSignal(false);
  let [addRelayError, setAddRelayError] = createSignal('');
  let [addRelaySuccess, setAddRelaySuccess] = createSignal('');

  // Intervallo per controllare lo stato di IPFS
  let ipfsOnlineChecker = setInterval(() => {
    if (window.ipfs && typeof window.ipfs.isOnline === 'function') {
      setIpfsOnline(window.ipfs.isOnline());
    }
  }, 2000);

  // Intervallo per controllare lo stato della connettività Swarm
  let swarmConnectivityChecker = setInterval(() => {
    setSwarmConnectivity(window.swarmConnectivity || false);
  }, 2000);

  // Funzione per ottenere i relay connessi
  const getConnectedRelays = () => {
    // Se abbiamo accesso ai peers di Gun, otteniamoli
    try {
      if (gun && gun._.opt && gun._.opt.peers) {
        const peerUrls = Object.keys(gun._.opt.peers);
        setConnectedRelays(peerUrls);
        return peerUrls;
      }
    } catch (error) {
      console.error("Errore nell'ottenere i relay connessi:", error);
    }
    return [];
  };

  // Funzione per aggiungere un nuovo relay
  const addRelay = () => {
    if (!newRelayUrl()) {
      setAddRelayError("Inserisci un URL valido");
      return;
    }

    setIsAddingRelay(true);
    setAddRelayError('');
    setAddRelaySuccess('');

    try {
      // Verifica che l'URL sia valido
      const url = new URL(newRelayUrl());
      
      // Aggiungi relay a Gun
      if (gun && gun.opt) {
        gun.opt({ peers: [newRelayUrl()] });
        
        // Aggiorna la lista dei relay connessi
        setTimeout(() => {
          getConnectedRelays();
          setIsAddingRelay(false);
          setAddRelaySuccess(`Relay "${newRelayUrl()}" aggiunto con successo`);
          setNewRelayUrl('');
        }, 1000);
      } else {
        setIsAddingRelay(false);
        setAddRelayError("Impossibile accedere all'istanza Gun");
      }
    } catch (error) {
      console.error("Errore nell'aggiungere il relay:", error);
      setIsAddingRelay(false);
      setAddRelayError(`Errore: ${error.message || "URL non valido"}`);
    }
  };

  onMount(() => {
    // Ottieni i relay connessi all'avvio del componente
    getConnectedRelays();
  });

  onCleanup(() => {
    clearInterval(ipfsOnlineChecker);
    clearInterval(swarmConnectivityChecker);
  });

  return (
    <div class="flex flex-col w-full h-full animate-fade-in dark:bg-signal-background-dark bg-white">
      <div class="flex items-center justify-between px-6 py-4 border-b dark:border-signal-border-dark border-signal-border-light">
        <div class="flex items-center space-x-4">
          {backEnabled && <BackButton class="dark:text-signal-text-muted-dark text-signal-text-muted-light hover:text-signal-blue" />}
          <h1 class="text-xl font-medium dark:text-signal-text-dark text-signal-text-light">Systems Status</h1>
        </div>
      </div>

      <div class="flex flex-col w-full h-full p-6 space-y-8 overflow-y-auto">
        {/* IPFS Status */}
        <div class="flex flex-col space-y-4 w-full">
          <div class="flex items-center justify-between dark:bg-signal-surface-dark bg-signal-surface-light p-4 rounded-lg border dark:border-signal-border-dark border-signal-border-light">
            <div class="uppercase font-medium dark:text-signal-text-dark text-signal-text-light">IPFS</div>
            <div class="flex items-center space-x-2">
              <div class="dark:text-signal-text-muted-dark text-signal-text-muted-light">
                {ipfsOnline() ? "Online" : "Offline"}
              </div>
              <div class="relative">
                <div
                  class={`flex-none w-3 h-3 rounded-full ${
                    ipfsOnline() ? 'bg-green-400' : 'bg-red-500'
                  } animate-ping`}
                ></div>
                <div
                  class={`absolute flex-none top-0 left-0 w-3 h-3 rounded-full ${
                    ipfsOnline() ? 'bg-green-400' : 'bg-red-500'
                  }`}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* GUN Status */}
        <div class="flex flex-col space-y-4 w-full">
          <div class="flex items-center justify-between dark:bg-signal-surface-dark bg-signal-surface-light p-4 rounded-lg border dark:border-signal-border-dark border-signal-border-light">
            <div class="uppercase font-medium dark:text-signal-text-dark text-signal-text-light">GUN Database</div>
            <div class="flex items-center space-x-2">
              <div class="dark:text-signal-text-muted-dark text-signal-text-muted-light">
                {gunOnline() ? "Online" : "Offline"}
              </div>
              <div class="relative">
                <div
                  class={`flex-none w-3 h-3 rounded-full ${
                    gunOnline() ? 'bg-green-400' : 'bg-red-500'
                  } animate-ping`}
                ></div>
                <div
                  class={`absolute flex-none top-0 left-0 w-3 h-3 rounded-full ${
                    gunOnline() ? 'bg-green-400' : 'bg-red-500'
                  }`}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Relay Connected */}
        <div class="flex flex-col space-y-4 w-full">
          <div class="uppercase font-medium dark:text-signal-text-dark text-signal-text-light">Relay Connessi</div>
          <div class="dark:bg-signal-surface-dark bg-signal-surface-light rounded-lg border dark:border-signal-border-dark border-signal-border-light">
            {connectedRelays().length > 0 ? (
              <ul class="divide-y dark:divide-signal-border-dark divide-signal-border-light">
                {connectedRelays().map((relay, index) => (
                  <li class="p-4 dark:text-signal-text-dark text-signal-text-light break-all">
                    {relay}
                  </li>
                ))}
              </ul>
            ) : (
              <div class="p-4 dark:text-signal-text-muted-dark text-signal-text-muted-light">
                Nessun relay connesso
              </div>
            )}
          </div>
        </div>

        {/* Add Relay */}
        <div class="flex flex-col space-y-4 w-full">
          <div class="uppercase font-medium dark:text-signal-text-dark text-signal-text-light">Aggiungi Relay</div>
          <div class="dark:bg-signal-surface-dark bg-signal-surface-light rounded-lg border dark:border-signal-border-dark border-signal-border-light p-4 space-y-4">
            <div class="flex flex-col space-y-2">
              <label class="dark:text-signal-text-muted-dark text-signal-text-muted-light text-sm">URL del Relay (es. https://relay.esempio.com)</label>
              <input
                type="text"
                value={newRelayUrl()}
                onInput={(e) => setNewRelayUrl(e.target.value)}
                placeholder="Inserisci l'URL del relay"
                class="w-full dark:bg-signal-background-dark bg-white dark:text-signal-text-dark text-signal-text-light p-2 rounded border dark:border-signal-border-dark border-signal-border-light focus:outline-none focus:ring-2 focus:ring-signal-blue"
              />
            </div>
            
            {addRelayError() && (
              <div class="text-red-500 text-sm">{addRelayError()}</div>
            )}
            
            {addRelaySuccess() && (
              <div class="text-green-500 text-sm">{addRelaySuccess()}</div>
            )}
            
            <button
              onClick={addRelay}
              disabled={isAddingRelay()}
              class={`w-full bg-signal-blue hover:bg-signal-blue-light text-white font-medium p-2 rounded-lg transition-colors duration-200 ${
                isAddingRelay() ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {isAddingRelay() ? 'Aggiunta in corso...' : 'Aggiungi Relay'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemsStatusSettingsPage;
