import { createEffect, createSignal, onMount, onCleanup } from 'solid-js';

let LoadingProvider = (props) => {
  let [dots, setDots] = createSignal('.');
  let [internalBusy, setInternalBusy] = createSignal(true);
  let intervalId = null;
  let timeoutId = null;
  
  // Aggiorniamo il segnale interno quando cambia props.busy
  createEffect(() => {
    console.log("LoadingProvider: props.busy cambiato a", props.busy);
    setInternalBusy(props.busy);
  });
  
  // Gestione dell'animazione dei puntini
  onMount(() => {
    console.log("LoadingProvider: montato, stato iniziale busy =", internalBusy());
    
    // Animazione dei puntini
    intervalId = setInterval(() => {
      setDots((prev) => {
        if (prev === '...') return '.';
        return prev + '.';
      });
    }, 500);
    
    // Timeout di sicurezza - forza il completamento dopo 5 secondi
    timeoutId = setTimeout(() => {
      console.log("LoadingProvider: timeout di sicurezza, forzo il completamento");
      setInternalBusy(false);
    }, 5000);
  });
  
  // Pulizia quando il componente viene smontato
  onCleanup(() => {
    console.log("LoadingProvider: pulizia risorse");
    if (intervalId) clearInterval(intervalId);
    if (timeoutId) clearTimeout(timeoutId);
  });

  return (
    <div class="w-screen h-screen">
      {/* Mostra i figli solo se non siamo in stato di caricamento */}
      {!internalBusy() && props.children}

      {/* Mostra lo spinner di caricamento se siamo in stato di caricamento */}
      {internalBusy() && (
        <div class="flex flex-col justify-center items-center w-full h-full text-white bg-gray-900 space-y-3">
          <div
            style="border-top-color:transparent"
            class="w-6 h-6 border-4 border-green-400 border-dotted rounded-full animate-spin"
          ></div>
          <div>{props.message || 'Loading'}{dots()}</div>
        </div>
      )}
    </div>
  );
};

export default LoadingProvider;