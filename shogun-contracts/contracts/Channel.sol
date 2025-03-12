// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title PaymentChannelSingleton
 * @dev Implementa un singolo contratto che gestisce tutti i canali di pagamento per gli utenti
 */
contract Channel {
    // Struttura che rappresenta un canale di pagamento
    struct Channel {
        address creator;          // Creatore del canale
        address counterparty;     // Controparte
        uint256 balance;          // Saldo bloccato nel canale
        uint256 nonce;            // Numero di sequenza per evitare replay attack
        bool isOpen;              // Stato del canale (aperto/chiuso)
        uint256 disputeTimeout;   // Timestamp di timeout per dispute
        bool inDispute;           // Indica se il canale è in stato di disputa
    }

    // Mapping da ID canale a struttura Channel
    mapping(bytes32 => Channel) public channels;
    
    // Mapping per tenere traccia dei canali per utente
    mapping(address => bytes32[]) public userChannels;
    
    // Eventi
    event ChannelOpened(bytes32 indexed channelId, address indexed creator, address indexed counterparty, uint256 deposit);
    event ChannelClosed(bytes32 indexed channelId, uint256 balance, uint256 nonce);
    event ChannelDisputeStarted(bytes32 indexed channelId, uint256 timeoutTimestamp);
    event ChannelDisputeResolved(bytes32 indexed channelId);
    event FundsWithdrawn(bytes32 indexed channelId, address indexed recipient, uint256 amount);

    // Timeout dispute in secondi (24 ore)
    uint256 public constant DISPUTE_TIMEOUT = 86400;
    
    // Indirizzo del proprietario/deployer del contratto
    address public owner;
    
    // Commissione sulla creazione di un canale (in %)
    uint256 public feePercent;
    uint256 public constant FEE_DENOMINATOR = 10000; // Per rappresentare 0.01% = 1
    
    // Fondi raccolti dalle commissioni
    uint256 public collectedFees;

    /**
     * Costruttore
     * @param _feePercent Percentuale di commissione (100 = 1%)
     */
    constructor(uint256 _feePercent) {
        owner = msg.sender;
        require(_feePercent <= 1000, "Fee cannot exceed 10%");
        feePercent = _feePercent;
    }

    /**
     * Modifica la percentuale di commissione
     * @param _feePercent Nuova percentuale di commissione
     */
    function setFeePercent(uint256 _feePercent) external {
        require(msg.sender == owner, "Only owner can change fee");
        require(_feePercent <= 1000, "Fee cannot exceed 10%");
        feePercent = _feePercent;
    }

    /**
     * Preleva le commissioni raccolte
     */
    function withdrawFees() external {
        require(msg.sender == owner, "Only owner can withdraw fees");
        uint256 amount = collectedFees;
        collectedFees = 0;
        (bool success, ) = owner.call{value: amount}("");
        require(success, "Failed to withdraw fees");
    }

    /**
     * Calcola l'ID del canale in base ai partecipanti
     * @param creator Indirizzo del creatore
     * @param counterparty Indirizzo della controparte
     * @return Identificatore univoco del canale
     */
    function calculateChannelId(address creator, address counterparty) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(creator, counterparty));
    }

    /**
     * Apre un nuovo canale di pagamento
     * @param counterparty Indirizzo della controparte
     */
    function openChannel(address counterparty) external payable {
        require(msg.value > 0, "Deposit amount must be greater than 0");
        require(counterparty != address(0), "Counterparty cannot be zero address");
        require(counterparty != msg.sender, "Counterparty cannot be the sender");

        // Calcola l'ID univoco del canale
        bytes32 channelId = calculateChannelId(msg.sender, counterparty);
        
        // Verifica che il canale non esista già
        require(!channels[channelId].isOpen, "Channel already exists");

        // Calcola e deduce la commissione
        uint256 fee = (msg.value * feePercent) / FEE_DENOMINATOR;
        uint256 depositAmount = msg.value - fee;
        collectedFees += fee;

        // Crea e memorizza il canale
        channels[channelId] = Channel({
            creator: msg.sender,
            counterparty: counterparty,
            balance: depositAmount,
            nonce: 0,
            isOpen: true,
            disputeTimeout: 0,
            inDispute: false
        });

        // Aggiungi il canale alla lista dei canali degli utenti
        userChannels[msg.sender].push(channelId);
        userChannels[counterparty].push(channelId);

        // Emetti evento
        emit ChannelOpened(channelId, msg.sender, counterparty, depositAmount);
    }

    /**
     * Ottiene i canali di un utente
     * @param user Indirizzo dell'utente
     * @return Lista degli ID dei canali dell'utente
     */
    function getUserChannels(address user) external view returns (bytes32[] memory) {
        return userChannels[user];
    }

    /**
     * Chiude un canale con l'ultimo stato firmato dalla controparte
     * @param channelId ID del canale
     * @param balance Saldo finale
     * @param nonce Numero di sequenza
     * @param signature Firma della controparte
     */
    function closeChannel(
        bytes32 channelId,
        uint256 balance,
        uint256 nonce,
        bytes memory signature
    ) external {
        Channel storage channel = channels[channelId];
        
        // Verifica che il canale esista ed sia aperto
        require(channel.isOpen, "Channel not open");
        
        // Verifica che chi chiama sia il creatore o la controparte
        require(
            msg.sender == channel.creator || msg.sender == channel.counterparty,
            "Only channel participants can close it"
        );

        // Verifica che il nonce sia maggiore dell'ultimo nonce registrato
        require(nonce > channel.nonce, "Nonce must be greater than current nonce");
        
        // Verifica che il saldo sia valido
        require(balance <= channel.balance, "Balance cannot exceed channel deposit");

        // Determina chi ha firmato lo stato
        address signer = msg.sender == channel.creator ? channel.counterparty : channel.creator;
        
        // Verifica la firma
        bytes32 messageHash = keccak256(abi.encodePacked(channelId, balance, nonce));
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        
        require(recoverSigner(ethSignedMessageHash, signature) == signer, "Invalid signature");

        // Chiudi il canale
        settleChannel(channelId, balance);
    }

    /**
     * Avvia una disputa sul canale
     * @param channelId ID del canale
     * @param balance Saldo proposto
     * @param nonce Numero di sequenza
     * @param signature Firma sull'ultimo stato
     */
    function disputeChannel(
        bytes32 channelId,
        uint256 balance,
        uint256 nonce,
        bytes memory signature
    ) external {
        Channel storage channel = channels[channelId];
        
        // Verifica che il canale esista ed sia aperto
        require(channel.isOpen, "Channel not open");
        
        // Verifica che chi chiama sia il creatore o la controparte
        require(
            msg.sender == channel.creator || msg.sender == channel.counterparty,
            "Only channel participants can dispute it"
        );

        // Verifica che il nonce sia maggiore dell'ultimo nonce registrato
        require(nonce > channel.nonce, "Nonce must be greater than current nonce");
        
        // Verifica che il saldo sia valido
        require(balance <= channel.balance, "Balance cannot exceed channel deposit");

        // Determina chi ha firmato lo stato
        address signer = msg.sender == channel.creator ? channel.counterparty : channel.creator;
        
        // Verifica la firma
        bytes32 messageHash = keccak256(abi.encodePacked(channelId, balance, nonce));
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        
        require(recoverSigner(ethSignedMessageHash, signature) == signer, "Invalid signature");

        // Aggiorna lo stato del canale
        channel.balance = balance;
        channel.nonce = nonce;
        channel.inDispute = true;
        channel.disputeTimeout = block.timestamp + DISPUTE_TIMEOUT;

        // Emetti evento
        emit ChannelDisputeStarted(channelId, channel.disputeTimeout);
    }

    /**
     * Risolve una disputa dopo il periodo di timeout
     * @param channelId ID del canale
     */
    function settleDispute(bytes32 channelId) external {
        Channel storage channel = channels[channelId];
        
        // Verifica che il canale sia in disputa
        require(channel.inDispute, "Channel not in dispute");
        
        // Verifica che il periodo di disputa sia terminato
        require(block.timestamp >= channel.disputeTimeout, "Dispute period not over");

        // Risolvi la disputa secondo l'ultimo stato confermato
        settleChannel(channelId, channel.balance);
        
        // Emetti evento
        emit ChannelDisputeResolved(channelId);
    }

    /**
     * Chiude il canale e distribuisce i fondi
     * @param channelId ID del canale
     * @param finalBalance Saldo finale per il creatore
     */
    function settleChannel(bytes32 channelId, uint256 finalBalance) private {
        Channel storage channel = channels[channelId];
        
        // Memorizza i valori prima di chiudere il canale
        address creator = channel.creator;
        address counterparty = channel.counterparty;
        uint256 totalBalance = channel.balance;
        
        // Calcola gli importi da trasferire
        uint256 creatorAmount = finalBalance;
        uint256 counterpartyAmount = totalBalance - finalBalance;
        
        // Chiudi il canale
        channel.isOpen = false;
        channel.inDispute = false;
        
        // Emetti evento
        emit ChannelClosed(channelId, finalBalance, channel.nonce);
        
        // Trasferisci i fondi
        if (creatorAmount > 0) {
            (bool success, ) = creator.call{value: creatorAmount}("");
            require(success, "Failed to send ETH to creator");
            emit FundsWithdrawn(channelId, creator, creatorAmount);
        }
        
        if (counterpartyAmount > 0) {
            (bool success, ) = counterparty.call{value: counterpartyAmount}("");
            require(success, "Failed to send ETH to counterparty");
            emit FundsWithdrawn(channelId, counterparty, counterpartyAmount);
        }
    }

    /**
     * Aggiunge fondi a un canale esistente
     * @param channelId ID del canale
     */
    function addFunds(bytes32 channelId) external payable {
        Channel storage channel = channels[channelId];
        
        // Verifica che il canale esista ed sia aperto
        require(channel.isOpen, "Channel not open");
        
        // Verifica che chi chiama sia il creatore
        require(msg.sender == channel.creator, "Only creator can add funds");
        
        // Verifica che l'importo sia positivo
        require(msg.value > 0, "Amount must be greater than 0");
        
        // Calcola e deduce la commissione
        uint256 fee = (msg.value * feePercent) / FEE_DENOMINATOR;
        uint256 addAmount = msg.value - fee;
        collectedFees += fee;
        
        // Aggiorna il saldo
        channel.balance += addAmount;
    }

    /**
     * Recupera il firmatario di un messaggio
     * @param _ethSignedMessageHash Hash del messaggio firmato
     * @param _signature Firma
     * @return Indirizzo del firmatario
     */
    function recoverSigner(bytes32 _ethSignedMessageHash, bytes memory _signature) 
        private 
        pure 
        returns (address) 
    {
        require(_signature.length == 65, "Invalid signature length");
        
        bytes32 r;
        bytes32 s;
        uint8 v;
        
        // Estrai r, s, v dalla firma
        assembly {
            r := mload(add(_signature, 32))
            s := mload(add(_signature, 64))
            v := byte(0, mload(add(_signature, 96)))
        }
        
        // Se v è 0 o 1, aggiungi 27 (compatibilità con firma Ethereum)
        if (v < 27) {
            v += 27;
        }
        
        // Verifica che v sia valido
        require(v == 27 || v == 28, "Invalid signature 'v' value");
        
        // Recupera l'indirizzo usando ecrecover
        return ecrecover(_ethSignedMessageHash, v, r, s);
    }

    /**
     * Ottiene informazioni su un canale
     * @param channelId ID del canale
     * @return creator Creatore del canale
     * @return counterparty Controparte
     * @return balance Saldo del canale
     * @return nonce Numero di sequenza
     * @return isOpen Stato del canale
     * @return disputeTimeout Timeout per la disputa
     * @return inDispute Stato di disputa
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
} 