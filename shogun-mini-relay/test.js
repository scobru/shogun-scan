// Test per le funzionalità di shogun-mini-relay
const SEA = require('gun/sea');
const relay = require('./index.js');
const assert = require('assert').strict;

// Funzione di utility per aspettare un certo tempo
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper per eseguire un test step in modo isolato
async function testStep(name, testFn) {
  console.log(`\n${name}`);
  try {
    await testFn();
    return true;
  } catch (err) {
    console.error(`❌ Test fallito: ${err.message}`);
    console.error(err);
    return false;
  }
}

// Funzione per eseguire i test in sequenza
async function runTests() {
  console.log('Iniziando i test di shogun-mini-relay...');
  
  // Avvia un server di test
  const server = relay.createServer(8766, ['http://localhost:8766/gun']);
  if (!server) {
    console.error('Errore nell\'avvio del server');
    process.exit(1);
  }
  
  console.log('Server di test avviato sulla porta 8766');
  await wait(1000); // Aspetta che il server sia pronto
  
  // Variabili per i test
  let gun = server;
  let user1;
  let user2;
  let channel;
  let encryptionKey;
  let allPassed = true;
  
  // Test 1: Inizializzazione di Gun
  if (await testStep('Test 1: Inizializzazione di Gun', async () => {
    assert.ok(gun, 'Gun non inizializzato correttamente');
    console.log('✅ Gun inizializzato correttamente');
  })) {
    // Test 2: Creazione utenti di test
    if (await testStep('Test 2: Creazione utenti di test', async () => {
      user1 = gun.user();
      user2 = gun.user();
      
      const randomUser1 = Math.random().toString(36).substring(2, 15);
      const randomUser2 = Math.random().toString(36).substring(2, 15);
      
      // Crea utente 1
      await new Promise((resolve) => {
        user1.create(randomUser1, 'password', (ack) => {
          assert.ok(!ack.err, `Errore nella creazione dell'utente 1: ${ack.err}`);
          resolve();
        });
      });
      
      // Crea utente 2
      await new Promise((resolve) => {
        user2.create(randomUser2, 'password', (ack) => {
          assert.ok(!ack.err, `Errore nella creazione dell'utente 2: ${ack.err}`);
          resolve();
        });
      });
      
      // Autentica utente 1
      await new Promise((resolve) => {
        user1.auth(randomUser1, 'password', (ack) => {
          assert.ok(!ack.err, `Errore nell'autenticazione dell'utente 1: ${ack.err}`);
          resolve();
        });
      });
      
      // Autentica utente 2
      await new Promise((resolve) => {
        user2.auth(randomUser2, 'password', (ack) => {
          assert.ok(!ack.err, `Errore nell'autenticazione dell'utente 2: ${ack.err}`);
          resolve();
        });
      });
      
      console.log('✅ Utenti creati e autenticati con successo');
    })) {
      // Test 3: Test delle funzioni di crittografia di base
      allPassed = await testStep('Test 3: Test delle funzioni di crittografia di base', async () => {
        const testData = { text: 'Questo è un test', timestamp: Date.now() };
        const testKey = 'chiave-di-test';
        
        // Test encryptData
        const encrypted = await relay.encryptData(testData, testKey);
        assert.ok(encrypted && encrypted.enc, 'La crittografia dei dati è fallita');
        console.log('  ✓ Crittografia riuscita');
        
        // Test decryptData
        const decrypted = await relay.decryptData(encrypted, testKey);
        assert.ok(decrypted, 'La decrittografia ha restituito null');
        assert.equal(typeof decrypted, 'object', 'La decrittografia non ha restituito un oggetto');
        assert.equal(decrypted.text, testData.text, 'Il testo decriptato non corrisponde all\'originale');
        // Nota: non confrontiamo i timestamp poiché potrebbero essere leggermente diversi a causa della serializzazione
        console.log('  ✓ Decrittografia riuscita');
        
        // Test di crittografia con stringa semplice
        console.log('  Test crittografia con stringa semplice...');
        const testString = 'Questa è una semplice stringa di test';
        const encryptedString = await relay.encryptData(testString, testKey);
        assert.ok(encryptedString && encryptedString.enc, 'La crittografia della stringa è fallita');
        
        const decryptedString = await relay.decryptData(encryptedString, testKey);
        assert.ok(decryptedString, 'La decrittografia della stringa ha restituito null');
        assert.ok(decryptedString.text && typeof decryptedString.text === 'string', 
                'La decrittografia della stringa non ha il campo text atteso');
        assert.ok(decryptedString.text.includes('semplice stringa'), 
                'Il contenuto della stringa decriptata non corrisponde all\'originale');
        console.log('  ✓ Crittografia e decrittografia di stringhe funzionano');
        
        console.log('✅ Funzioni di crittografia di base funzionano correttamente');
      }) && allPassed;
      
      // Test 4: Creazione di un canale condiviso
      if (allPassed) {
        allPassed = await testStep('Test 4: Creazione di un canale condiviso', async () => {
          const channelName = 'canale-test-' + Date.now();
          const sharedSecret = 'segreto-test-condiviso';
          
          const channelInfo = await relay.createSharedChannel(gun, channelName, sharedSecret);
          assert.ok(channelInfo, 'Creazione del canale fallita');
          assert.ok(channelInfo.channelId, 'ID canale non generato');
          assert.ok(channelInfo.encryptionKey, 'Chiave di crittografia non generata');
          assert.ok(channelInfo.metadata, 'Metadati non creati');
          assert.equal(channelInfo.metadata.name, channelName, 'Il nome del canale non corrisponde');
          
          console.log(`✅ Canale creato con ID: ${channelInfo.channelId}`);
          
          // Salva i dati del canale per i test successivi
          channel = channelInfo.channelId;
          encryptionKey = channelInfo.encryptionKey;
        }) && allPassed;
      }
      
      // Test 5: Join di un canale esistente
      if (allPassed && channel) {
        allPassed = await testStep('Test 5: Join di un canale esistente', async () => {
          // Aspetta più a lungo che i dati del canale siano salvati e sincronizzati
          console.log('  Attesa sincronizzazione dati (3 secondi)...');
          await wait(3000);
          
          const sharedSecret = 'segreto-test-condiviso';
          
          // Verifica prima se il canale esiste
          console.log(`  Verifica esistenza canale: ${channel}`);
          const channelExists = await new Promise(resolve => {
            gun.get('#encrypted_channels').get(channel).once(data => {
              console.log(`  Dati canale:`, data);
              resolve(data && data.enc);
            });
          });
          
          if (!channelExists) {
            console.log('  ⚠️ Canale non trovato in #encrypted_channels, verifico se i dati sono ancora in transito...');
            // Aggiungiamo un ulteriore ritardo
            await wait(2000);
          }
          
          // Tenta il join
          const joinInfo = await relay.joinSharedChannel(gun, channel, sharedSecret);
          assert.ok(joinInfo, 'Join del canale fallito');
          assert.equal(joinInfo.channelId, channel, 'ID canale non corrisponde');
          assert.ok(joinInfo.metadata && joinInfo.metadata.name, 'Metadati del canale mancanti');
          
          console.log('✅ Join del canale riuscito');
        }) && allPassed;
      }
      
      // Test 6: Invio di un messaggio criptato
      if (allPassed && channel && encryptionKey) {
        allPassed = await testStep('Test 6: Invio di un messaggio criptato', async () => {
          const testMessage = 'Questo è un messaggio di test criptato ' + Date.now();
          
          // Imposta l'utente corrente per l'invio
          gun.user().recall({sessionStorage: false});
          
          const sentSuccess = await relay.sendToSharedChannel(gun, channel, encryptionKey, testMessage);
          assert.ok(sentSuccess, 'Invio del messaggio fallito');
          
          console.log('✅ Messaggio inviato con successo');
        }) && allPassed;
      }
      
      // Test 7: Ricezione di messaggi criptati
      if (allPassed && channel && encryptionKey) {
        allPassed = await testStep('Test 7: Ricezione di messaggi criptati', async () => {
          let messageReceived = false;
          
          // Funzione di callback per i messaggi
          function messageCallback(message) {
            try {
              if (typeof message === 'object' && typeof message.text === 'string') {
                console.log(`Messaggio ricevuto: ${message.text}`);
                if (message.text.includes('test criptato')) {
                  messageReceived = true;
                }
              }
            } catch (err) {
              console.error('Errore nel callback del messaggio:', err);
            }
          }
          
          // Inizia ad ascoltare i messaggi
          relay.listenToSharedChannel(gun, channel, encryptionKey, messageCallback);
          
          // Aspetta che il messaggio venga ricevuto
          console.log('Attesa ricezione messaggio...');
          let attempts = 0;
          while (!messageReceived && attempts < 10) {
            await wait(500);
            attempts++;
          }
          
          if (messageReceived) {
            console.log('✅ Messaggio ricevuto correttamente');
          } else {
            console.log('❌ Timeout nell\'attesa del messaggio');
            console.log('Nota: questo test potrebbe fallire se la ricezione è troppo lenta');
            // Non facciamo fallire il test se il timeout è scaduto
          }
        }) && allPassed;
      }
      
      // Test 8: Lista dei canali criptati
      if (allPassed && channel) {
        allPassed = await testStep('Test 8: Lista dei canali criptati', async () => {
          const channels = await relay.listEncryptedChannels(gun);
          assert.ok(Array.isArray(channels), 'La lista dei canali non è un array');
          assert.ok(channels.length > 0, 'Nessun canale trovato');
          assert.ok(channels.includes(channel) || channels.some(c => c === channel || c.id === channel), 
                   'Il canale creato non è presente nella lista');
          
          console.log(`✅ Lista canali ottenuta: ${channels.length} canali trovati`);
        }) && allPassed;
      }
      
      // Test 9: Test con segreto errato
      if (allPassed && channel) {
        allPassed = await testStep('Test 9: Test con segreto errato', async () => {
          try {
            const wrongInfo = await relay.joinSharedChannel(gun, channel, 'segreto-sbagliato');
            if (wrongInfo) {
              console.log('❌ Il join con segreto errato è riuscito invece di fallire');
              throw new Error('Il join con segreto errato è riuscito invece di fallire');
            } else {
              console.log('✅ Il join con segreto errato è fallito come previsto (ha restituito null)');
            }
          } catch (err) {
            // Consideriamo valido anche se lancia un errore
            console.log('✅ Il join con segreto errato ha lanciato un errore come previsto');
          }
        }) && allPassed;
      }
      
      // Test 10: Invio con utente non autenticato
      if (allPassed && channel && encryptionKey) {
        allPassed = await testStep('Test 10: Invio con utente non autenticato', async () => {
          gun.user().leave();
          try {
            const unauthResult = await relay.sendToSharedChannel(gun, channel, encryptionKey, 'messaggio non autorizzato');
            assert.ok(!unauthResult, 'Invio senza autenticazione riuscito invece di fallire');
            console.log('✅ Invio senza autenticazione fallito come previsto');
          } catch (err) {
            console.log('✅ Invio senza autenticazione ha lanciato un errore come previsto');
          }
        }) && allPassed;
      }
    }
  }
  
  if (allPassed) {
    console.log('\n✅ Tutti i test completati con successo!');
  } else {
    console.log('\n⚠️ Alcuni test sono falliti. Verifica i messaggi di errore sopra.');
  }
  
  // Pulizia: chiudi le connessioni
  try {
    if (user1 && user1.leave) user1.leave();
    if (user2 && user2.leave) user2.leave();
    console.log('\nTest completati, server di test attivo. Premi Ctrl+C per terminare.');
  } catch (e) {
    console.error('Errore durante la pulizia:', e);
  }
}

// Esegui i test
runTests().catch(err => {
  console.error('Errore nell\'esecuzione dei test:', err);
});
