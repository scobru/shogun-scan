import { ShogunCore } from "../src";
import { ethers } from "ethers";

/**
 * Questo esempio mostra come utilizzare il sistema di canali di pagamento in Shogun.
 * Il sistema utilizza un contratto singleton per gestire tutti i canali di pagamento,
 * consentendo agli utenti di:
 * 1. Creare canali di pagamento con altre parti
 * 2. Inviare pagamenti off-chain (istantanei e senza commissioni gas)
 * 3. Sincronizzare lo stato del canale tramite GunDB
 * 4. Chiudere canali di pagamento quando necessario
 * 5. Risolvere dispute in caso di problemi
 */
async function runPaymentChannelExample() {
  try {
    console.log("Avvio esempio di canale di pagamento Shogun");
    
    // Inizializza ShogunCore con i parametri necessari
    const shogun = new ShogunCore({
      peers: ["https://gun-server.example.com/gun"],
      providerUrl: "https://goerli.infura.io/v3/your-infura-key",
      // Indirizzo del contratto singleton dei canali di pagamento
      paymentChannelContract: "0x1234567890123456789012345678901234567890"
    });
    
    console.log("ShogunCore inizializzato");
    
    // Registra un nuovo utente o accedi con le credenziali
    const username = "alice_" + Math.floor(Math.random() * 10000);
    const password = "password123";
    
    let result;
    try {
      // Prima prova a registrare un nuovo utente
      result = await shogun.signUp(username, password);
      console.log(`Nuovo utente registrato: ${username}`);
    } catch (error) {
      // Se l'utente esiste già, effettua il login
      console.log(`Utente esistente, effettuo il login`);
      result = await shogun.login(username, password);
    }
    
    if (!result.success) {
      console.log(`Errore durante l'autenticazione: ${result.error}`);
      return;
    }
    
    console.log(`Utente autenticato: ${username}`);
    
    // Controlla se l'utente ha un wallet
    const wallets = await shogun.loadWallets();
    
    let walletAddress;
    if (wallets.length === 0) {
      // Crea un nuovo wallet se non ne esiste uno
      console.log("Creazione di un nuovo wallet...");
      const wallet = await shogun.createWallet();
      walletAddress = wallet.address;
      console.log(`Nuovo wallet creato: ${walletAddress}`);
      
      // Per il test, potremmo voler caricare il wallet con ETH
      // (in produzione, gli utenti dovrebbero trasferire ETH al proprio wallet)
      console.log(`Per testare, trasferisci un po' di ETH a questo indirizzo: ${walletAddress}`);
    } else {
      walletAddress = wallets[0].address;
      console.log(`Wallet esistente trovato: ${walletAddress}`);
    }
    
    // In un'applicazione reale, a questo punto attendere che l'utente abbia fondi nel wallet
    console.log("Verifica che il wallet abbia fondi sufficienti prima di creare un canale");
    
    // Nel mondo reale, dovresti verificare che l'utente abbia abbastanza fondi prima di procedere
    // Poiché non abbiamo un metodo pubblico diretto per ottenere il saldo, in un'applicazione
    // reale dovremmo usare un provider direttamente o aggiungere un metodo pubblico alla classe ShogunCore
    
    // Per semplicità, assumiamo che ci siano fondi sufficienti nell'esempio
    console.log("In un'applicazione reale, verificheremmo il saldo prima di procedere.");
    
    // Crea un canale di pagamento con una controparte
    // Nota: in un'applicazione reale, l'indirizzo della controparte verrebbe fornito dall'utente o dal sistema
    const counterpartyAddress = "0xABCDEF1234567890ABCDEF1234567890ABCDEF12";
    const initialDeposit = "0.01"; // in ETH
    
    console.log(`Creazione di un canale di pagamento con ${counterpartyAddress}`);
    console.log(`Deposito iniziale: ${initialDeposit} ETH`);
    
    // Crea il canale utilizzando il contratto singleton
    const channelResult = await shogun.createPaymentChannel(
      counterpartyAddress,
      initialDeposit,
      walletAddress
    );
    
    if (!channelResult.success) {
      console.log(`Errore nella creazione del canale: ${channelResult.error}`);
      return;
    }
    
    console.log(`Canale creato con ID: ${channelResult.state?.channelId}`);
    console.log(`Stato del canale: ${channelResult.state?.status}`);
    console.log(`Saldo del canale: ${channelResult.state?.balance} ETH`);
    
    // Invia un pagamento off-chain
    const paymentAmount = "0.001"; // in ETH
    console.log(`Invio di un pagamento off-chain di ${paymentAmount} ETH`);
    
    const paymentResult = await shogun.sendOffchainPayment(
      channelResult.state?.channelId || "",
      paymentAmount
    );
    
    if (!paymentResult.success) {
      console.log(`Errore nell'invio del pagamento: ${paymentResult.error}`);
    } else {
      console.log(`Pagamento inviato con successo`);
      console.log(`Nuovo saldo del canale: ${paymentResult.state?.balance} ETH`);
      console.log(`Nonce aggiornato: ${paymentResult.state?.nonce}`);
    }
    
    // Ottieni i canali disponibili
    console.log("Elenco dei canali disponibili...");
    
    const channels = await shogun.getPaymentChannels();
    console.log(`Canali disponibili: ${channels.length}`);
    
    let totalLockedValue = "0";
    for (const channel of channels) {
      console.log(`Canale ${channel.channelId}: ${channel.status}, saldo ${channel.balance} ETH`);
      
      if (channel.status === 'open') {
        totalLockedValue = (
          parseFloat(totalLockedValue) + parseFloat(channel.balance)
        ).toString();
      }
    }
    
    console.log(`Valore totale bloccato nei canali: ${totalLockedValue} ETH`);
    
    // Per chiudere il canale (non eseguito in questo esempio)
    /*
    console.log(`Chiusura del canale ${channelResult.state?.channelId}...`);
    const closeResult = await shogun.closePaymentChannel(channelResult.state?.channelId || "");
    
    if (!closeResult.success) {
      console.log(`Errore nella chiusura del canale: ${closeResult.error}`);
    } else {
      console.log(`Canale chiuso con successo`);
      console.log(`Stato finale: ${closeResult.state?.status}`);
    }
    */
    
    console.log("Esempio di canale di pagamento completato");
  } catch (error) {
    console.error("Errore nell'esempio del canale di pagamento:", error);
  }
}

// Esegui l'esempio
runPaymentChannelExample(); 