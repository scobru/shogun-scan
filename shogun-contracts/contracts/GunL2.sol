// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract GunL2 {
    mapping(address => uint256) public balanceGT; // Saldo GunToken (GT)
    mapping(address => uint256) public pendingWithdrawals; // Prelievi in attesa

    uint256 public constant COLLATERAL_RATIO = 100; // Mint 100% dell'ETH depositato (1:1)
    uint256 public totalETHDeposited;

    event Deposit(address indexed user, uint256 amount);
    event WithdrawRequest(address indexed user, uint256 amount);
    event WithdrawCompleted(address indexed user, uint256 amount);

    // Deposito ETH -> Mint di GT in rapporto 1:1
    function deposit() public payable {
        require(msg.value > 0, "Devi depositare ETH");

        uint256 mintAmount = msg.value; // Non c'è più bisogno di calcolare il COLLATERAL_RATIO
        balanceGT[msg.sender] += mintAmount;
        totalETHDeposited += msg.value;

        emit Deposit(msg.sender, msg.value);
    }

    // Richiesta di prelievo ETH (GT -> ETH)
    function requestWithdraw(uint256 _amount) public {
        require(balanceGT[msg.sender] >= _amount, "Saldo GT insufficiente");

        // Controlliamo che ETH disponibili siano almeno il 120% dei GT in circolazione
        require(address(this).balance >= (_amount * 120) / 100, "ETH insufficienti");

        pendingWithdrawals[msg.sender] += _amount;
        balanceGT[msg.sender] -= _amount;

        emit WithdrawRequest(msg.sender, _amount);
    }

    // Esecuzione del prelievo
    function processWithdraw() public {
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "Nessun ritiro in sospeso");

        pendingWithdrawals[msg.sender] = 0;
        payable(msg.sender).transfer(amount);

        emit WithdrawCompleted(msg.sender, amount);
    }

    // Controlla la liquidità nel contratto
    function contractBalance() public view returns (uint256) {
        return address(this).balance;
    }
}
