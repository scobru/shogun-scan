// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title DropFactory
 * @notice Gestisce la creazione di drop basati su IPFS (fuori catena) e il pagamento on-chain per il download
 *         - I primi freeDropsPerUser drop di ciascun creator sono gratuiti
 *         - Massimo maxDropsPerUser drop creati per creator
 *         - Fee di download personalizzabile per ogni drop, inviato al creator
 */
contract DropFactory is Ownable {
    using Counters for Counters.Counter;

    uint256 public freeDropsPerUser = 2;    // Drop gratuiti per creator
    uint256 public maxDropsPerUser = 5;     // Numero massimo di drop per creator

    Counters.Counter private _dropIdCounter;

    constructor() Ownable(msg.sender) {}

    struct Drop {
        address creator;
        uint256 remaining;     // Scaricamenti rimanenti
    }

    // Mapping dropId => Drop metadata
    mapping(uint256 => Drop) public drops;
    // Mapping dropId => download fee in wei
    mapping(uint256 => uint256) public dropDownloadFee;
    // Mapping creator => numero di drop creati
    mapping(address => uint256) public dropsCreated;

    event DropCreated(
        uint256 indexed dropId,
        address indexed creator,
        uint256 allowedDownloads,
        uint256 downloadFee
    );
    event DropPurchased(
        address indexed buyer,
        uint256 indexed dropId,
        uint256 amount
    );

    /**
     * @notice Crea un nuovo drop con downloadFee e numero di download
     * @param allowedDownloads Numero di volte che il drop può essere scaricato
     * @param downloadFeeInWei Fee richiesta per ogni download (in wei)
     * @dev Il CID del file andrà gestito off-chain (es. GunDB) e associato a dropId
     */
    function createDrop(uint256 allowedDownloads, uint256 downloadFeeInWei) external {
        uint256 created = dropsCreated[msg.sender];
        require(created < maxDropsPerUser, "Max drops per user reached");
        // I primi freeDropsPerUser drop sono gratuiti
        // Le fee custom vengono applicate solo oltre il limite gratuito, se desiderato

        dropsCreated[msg.sender] = created + 1;
        _dropIdCounter.increment();
        uint256 id = _dropIdCounter.current();

        drops[id] = Drop({
            creator: msg.sender,
            remaining: allowedDownloads
        });
        dropDownloadFee[id] = downloadFeeInWei;

        emit DropCreated(id, msg.sender, allowedDownloads, downloadFeeInWei);
    }

    /**
     * @notice Acquista e scarica un drop
     * @param dropId Identificativo del drop
     */
    function purchaseDrop(uint256 dropId) external payable {
        Drop storage dp = drops[dropId];
        require(dp.creator != address(0), "Drop non esistente");
        require(dp.remaining > 0, "Nessun download rimanente");

        uint256 fee = dropDownloadFee[dropId];
        // se è fra i primi freeDropsPerUser creati dal creator, non richiede fee
        if (dropsCreated[dp.creator] <= freeDropsPerUser) {
            fee = 0;
        }
        require(msg.value >= fee, "Fee di download insufficiente");

        dp.remaining -= 1;
        if (fee > 0) {
            payable(dp.creator).transfer(fee);
        }
        // Rimborsa eccedenza
        if (msg.value > fee) {
            payable(msg.sender).transfer(msg.value - fee);
        }

        emit DropPurchased(msg.sender, dropId, fee);
    }

    // Admin functions
    function setFreeDropsPerUser(uint256 n) external onlyOwner {
        freeDropsPerUser = n;
    }
    function setMaxDropsPerUser(uint256 n) external onlyOwner {
        maxDropsPerUser = n;
    }
    function updateDropDownloadFee(uint256 dropId, uint256 newFeeWei) external {
        require(drops[dropId].creator == msg.sender, "Solo creator");
        dropDownloadFee[dropId] = newFeeWei;
    }
}
