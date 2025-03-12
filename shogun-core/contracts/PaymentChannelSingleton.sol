// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title PaymentChannelSingleton
 * @dev Contratto singleton per la gestione di canali di pagamento bidirezionali
 * Questo contratto consente agli utenti di:
 * 1. Aprire canali di pagamento con deposito
 * 2. Chiudere canali con firme
 * 3. Risolvere dispute
 * 4. Monitorare lo stato dei canali
 */
contract PaymentChannelSingleton {
    // Definizione della struttura per un canale di pagamento
    struct Channel {
        address creator;         // Creatore del canale
        address counterparty;    // Controparte
        uint256 balance;         // Saldo corrente del canale
        uint256 nonce;           // Nonce per tracciare l'ultimo aggiornamento
        bool isOpen;             // Stato del canale (aperto/chiuso)
        uint256 disputeTimeout;  // Timeout per le dispute in secondi
        uint256 createdAt;       // Timestamp di creazione
        bool inDispute;          // Flag per indicare se il canale è in disputa
    }

    // Mappatura per memorizzare i canali usando l'ID del canale
    mapping(bytes32 => Channel) public channels;
    
    // Mappatura per tenere traccia dei canali di ogni utente
    mapping(address => bytes32[]) public userChannels;

    // Percentuale di commissione (in parti per mille, es. 5 = 0.5%)
    uint256 public feePercentage;
    
    // Indirizzo del proprietario del contratto
    address public owner;
    
    // Variabile per memorizzare le commissioni accumulate
    uint256 public accumulatedFees;

    // Eventi
    event ChannelOpened(bytes32 indexed channelId, address indexed creator, address indexed counterparty, uint256 balance, uint256 timestamp);
    event ChannelClosed(bytes32 indexed channelId, uint256 creatorAmount, uint256 counterpartyAmount, uint256 timestamp);
    event DisputeInitiated(bytes32 indexed channelId, address indexed disputeInitiator, uint256 timestamp);
    event DisputeResolved(bytes32 indexed channelId, uint256 creatorAmount, uint256 counterpartyAmount, uint256 timestamp);
    event FundsAdded(bytes32 indexed channelId, address indexed sender, uint256 amount, uint256 timestamp);
    event FeeCollected(uint256 amount, uint256 timestamp);

    // Modificatori
    modifier onlyOwner() {
        require(msg.sender == owner, "Solo il proprietario puo' eseguire questa operazione");
        _;
    }

    // Costruttore
    constructor(uint256 _feePercentage) {
        require(_feePercentage <= 50, "La commissione non puo' superare il 5%");
        feePercentage = _feePercentage;
        owner = msg.sender;
    }

    /**
     * @dev Funzione per aprire un nuovo canale di pagamento
     * @param counterparty Indirizzo della controparte
     * @param disputeTimeoutHours Timeout per le dispute in ore
     * @return channelId ID univoco del canale creato
     */
    function openChannel(address counterparty, uint256 disputeTimeoutHours) external payable returns (bytes32 channelId) {
        require(counterparty != address(0), "Indirizzo controparte non valido");
        require(counterparty != msg.sender, "Non puoi aprire un canale con te stesso");
        require(msg.value > 0, "E' richiesto un deposito per aprire il canale");
        require(disputeTimeoutHours > 0, "Il timeout per le dispute deve essere maggiore di zero");
        
        // Calcola l'ID del canale
        channelId = calculateChannelId(msg.sender, counterparty);
        
        // Verifica che il canale non esista già
        require(channels[channelId].creator == address(0), "Canale gia' esistente");
        
        // Calcola la commissione
        uint256 fee = (msg.value * feePercentage) / 1000;
        uint256 depositAfterFee = msg.value - fee;
        
        // Aggiorna le commissioni accumulate
        accumulatedFees += fee;
        
        // Crea il nuovo canale
        channels[channelId] = Channel({
            creator: msg.sender,
            counterparty: counterparty,
            balance: depositAfterFee,
            nonce: 0,
            isOpen: true,
            disputeTimeout: disputeTimeoutHours * 3600,
            createdAt: block.timestamp,
            inDispute: false
        });
        
        // Aggiungi l'ID del canale agli elenchi degli utenti
        userChannels[msg.sender].push(channelId);
        userChannels[counterparty].push(channelId);
        
        // Emetti evento
        emit ChannelOpened(channelId, msg.sender, counterparty, depositAfterFee, block.timestamp);
        emit FeeCollected(fee, block.timestamp);
        
        return channelId;
    }

    /**
     * @dev Funzione per aggiungere fondi a un canale esistente
     * @param channelId ID del canale
     */
    function addFunds(bytes32 channelId) external payable {
        Channel storage channel = channels[channelId];
        
        require(channel.creator != address(0), "Canale non esistente");
        require(channel.isOpen, "Il canale e' chiuso");
        require(msg.value > 0, "L'importo deve essere maggiore di zero");
        require(
            msg.sender == channel.creator || msg.sender == channel.counterparty,
            "Solo il creatore o la controparte possono aggiungere fondi"
        );
        
        // Calcola la commissione
        uint256 fee = (msg.value * feePercentage) / 1000;
        uint256 amountAfterFee = msg.value - fee;
        
        // Aggiorna le commissioni accumulate
        accumulatedFees += fee;
        
        // Aggiorna il saldo del canale
        channel.balance += amountAfterFee;
        
        // Emetti evento
        emit FundsAdded(channelId, msg.sender, amountAfterFee, block.timestamp);
        emit FeeCollected(fee, block.timestamp);
    }

    /**
     * @dev Funzione per chiudere un canale con una firma
     * @param channelId ID del canale
     * @param balance Saldo finale del canale
     * @param nonce Nonce dell'ultimo aggiornamento
     * @param signature Firma della controparte
     */
    function closeChannel(
        bytes32 channelId,
        uint256 balance,
        uint256 nonce,
        bytes memory signature
    ) external {
        Channel storage channel = channels[channelId];
        
        require(channel.creator != address(0), "Canale non esistente");
        require(channel.isOpen, "Il canale e' gia' chiuso");
        require(nonce > channel.nonce, "Nonce non valido");
        
        address signer;
        address recipient;
        
        // Determina chi è il firmatario e chi è il destinatario
        if (msg.sender == channel.creator) {
            signer = channel.counterparty;
            recipient = channel.creator;
        } else if (msg.sender == channel.counterparty) {
            signer = channel.creator;
            recipient = channel.counterparty;
        } else {
            revert("Non autorizzato a chiudere il canale");
        }
        
        // Verifica la firma
        bytes32 message = keccak256(abi.encodePacked(channelId, balance, nonce));
        bytes32 prefixedMessage = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", message));
        
        address recoveredSigner = recoverSigner(prefixedMessage, signature);
        require(recoveredSigner == signer, "Firma non valida");
        
        // Calcola gli importi da distribuire
        uint256 recipientAmount = balance;
        uint256 signerAmount = channel.balance - balance;
        
        // Chiudi il canale
        channel.isOpen = false;
        channel.nonce = nonce;
        
        // Trasferisci i fondi
        payable(recipient).transfer(recipientAmount);
        payable(signer).transfer(signerAmount);
        
        // Emetti evento
        emit ChannelClosed(channelId, channel.creator == recipient ? recipientAmount : signerAmount, 
                           channel.counterparty == recipient ? recipientAmount : signerAmount, 
                           block.timestamp);
    }

    /**
     * @dev Funzione per avviare una disputa su un canale
     * @param channelId ID del canale
     * @param balance Saldo proposto
     * @param nonce Nonce dell'ultimo aggiornamento
     * @param signature Firma della controparte
     */
    function initiateDispute(
        bytes32 channelId,
        uint256 balance,
        uint256 nonce,
        bytes memory signature
    ) external {
        Channel storage channel = channels[channelId];
        
        require(channel.creator != address(0), "Canale non esistente");
        require(channel.isOpen, "Il canale e' chiuso");
        require(!channel.inDispute, "Disputa gia' in corso");
        require(
            msg.sender == channel.creator || msg.sender == channel.counterparty,
            "Solo il creatore o la controparte possono avviare una disputa"
        );
        require(nonce > channel.nonce, "Nonce non valido");
        
        address signer;
        
        // Determina chi è il firmatario
        if (msg.sender == channel.creator) {
            signer = channel.counterparty;
        } else {
            signer = channel.creator;
        }
        
        // Verifica la firma
        bytes32 message = keccak256(abi.encodePacked(channelId, balance, nonce));
        bytes32 prefixedMessage = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", message));
        
        address recoveredSigner = recoverSigner(prefixedMessage, signature);
        require(recoveredSigner == signer, "Firma non valida");
        
        // Avvia la disputa
        channel.inDispute = true;
        channel.nonce = nonce;
        
        // Emetti evento
        emit DisputeInitiated(channelId, msg.sender, block.timestamp);
    }

    /**
     * @dev Funzione per risolvere una disputa
     * @param channelId ID del canale
     */
    function resolveDispute(bytes32 channelId) external {
        Channel storage channel = channels[channelId];
        
        require(channel.creator != address(0), "Canale non esistente");
        require(channel.isOpen, "Il canale e' chiuso");
        require(channel.inDispute, "Nessuna disputa in corso");
        require(
            msg.sender == channel.creator || msg.sender == channel.counterparty,
            "Solo il creatore o la controparte possono risolvere la disputa"
        );
        
        // Calcola gli importi da distribuire
        // In una implementazione completa, qui verrebbe utilizzato lo stato più recente firmato
        uint256 creatorAmount = channel.balance / 2;
        uint256 counterpartyAmount = channel.balance - creatorAmount;
        
        // Chiudi il canale
        channel.isOpen = false;
        channel.inDispute = false;
        
        // Trasferisci i fondi
        payable(channel.creator).transfer(creatorAmount);
        payable(channel.counterparty).transfer(counterpartyAmount);
        
        // Emetti evento
        emit DisputeResolved(channelId, creatorAmount, counterpartyAmount, block.timestamp);
    }

    /**
     * @dev Funzione per calcolare l'ID del canale
     * @param creator Indirizzo del creatore
     * @param counterparty Indirizzo della controparte
     * @return channelId ID del canale
     */
    function calculateChannelId(address creator, address counterparty) public pure returns (bytes32) {
        // Ordina gli indirizzi per garantire che lo stesso canale abbia lo stesso ID indipendentemente da chi lo crea
        address addr1 = creator < counterparty ? creator : counterparty;
        address addr2 = creator < counterparty ? counterparty : creator;
        
        return keccak256(abi.encodePacked(addr1, addr2));
    }

    /**
     * @dev Funzione per recuperare i canali di un utente
     * @param user Indirizzo dell'utente
     * @return channelIds Array di ID dei canali dell'utente
     */
    function getUserChannels(address user) external view returns (bytes32[] memory) {
        return userChannels[user];
    }

    /**
     * @dev Funzione per ottenere i dettagli di un canale
     * @param channelId ID del canale
     * @return creator Indirizzo del creatore
     * @return counterparty Indirizzo della controparte
     * @return balance Saldo del canale
     * @return nonce Nonce dell'ultimo aggiornamento
     * @return isOpen Stato del canale
     * @return disputeTimeout Timeout per le dispute
     * @return inDispute Se il canale è in disputa
     */
    function getChannel(bytes32 channelId) external view returns (
        address creator,
        address counterparty,
        uint256 balance,
        uint256 nonce,
        bool isOpen,
        uint256 disputeTimeout,
        bool inDispute
    ) {
        Channel storage channel = channels[channelId];
        return (
            channel.creator,
            channel.counterparty,
            channel.balance,
            channel.nonce,
            channel.isOpen,
            channel.disputeTimeout,
            channel.inDispute
        );
    }

    /**
     * @dev Funzione per prelevare le commissioni accumulate
     * @param amount Importo da prelevare
     */
    function withdrawFees(uint256 amount) external onlyOwner {
        require(amount <= accumulatedFees, "Importo richiesto superiore alle commissioni accumulate");
        
        accumulatedFees -= amount;
        payable(owner).transfer(amount);
    }

    /**
     * @dev Funzione per aggiornare la percentuale di commissione
     * @param newFeePercentage Nuova percentuale di commissione
     */
    function updateFeePercentage(uint256 newFeePercentage) external onlyOwner {
        require(newFeePercentage <= 50, "La commissione non puo' superare il 5%");
        feePercentage = newFeePercentage;
    }

    /**
     * @dev Funzione per recuperare firmatario da firma
     * @param message Messaggio firmato
     * @param signature Firma
     * @return address Indirizzo del firmatario
     */
    function recoverSigner(bytes32 message, bytes memory signature) internal pure returns (address) {
        require(signature.length == 65, "Lunghezza firma non valida");
        
        bytes32 r;
        bytes32 s;
        uint8 v;
        
        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }
        
        if (v < 27) {
            v += 27;
        }
        
        require(v == 27 || v == 28, "v non valido");
        
        return ecrecover(message, v, r, s);
    }
} 