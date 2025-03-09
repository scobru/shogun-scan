import React from 'react';
import Button from './Button';
import { WalletInfo } from '../types';

interface SidebarProps {
  selectedRpc: string;
  onRpcChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  wallets: WalletInfo[];
  selectedAddress: string | null;
  onSelectAddress: (address: string) => Promise<void>;
  onCreateWallet: () => Promise<WalletInfo | null>;
  onLogout: () => void;
  activeSection: string;
  onSectionChange: (section: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  selectedRpc,
  onRpcChange,
  wallets,
  selectedAddress,
  onSelectAddress,
  onCreateWallet,
  onLogout,
  activeSection,
  onSectionChange
}) => {
  // Sezioni dell'app
  const sections = [
    { id: "wallet", name: "Wallet", icon: "💰" },
    { id: "stealth", name: "Stealth", icon: "🕶️" },
    { id: "mom", name: "Messaggi", icon: "💬" } // Nuova sezione MOM
  ];

  return (
    <div className="w-[250px] bg-gray-800 p-4 flex flex-col border-r border-gray-700">
      <div className="mb-6">
        <h2 className="text-white text-xl font-semibold">Shogun Wallet</h2>
      </div>
      
      {/* Menu di navigazione */}
      <div className="mb-6">
        <h3 className="text-gray-400 text-sm font-medium mb-2">Menu</h3>
        <nav className="space-y-1">
          {sections.map(section => (
            <div
              key={section.id}
              onClick={() => onSectionChange(section.id)}
              className={`p-2 rounded cursor-pointer transition-colors flex items-center space-x-2 ${
                activeSection === section.id
                  ? 'bg-primary text-white'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>{section.icon}</span>
              <span>{section.name}</span>
            </div>
          ))}
        </nav>
      </div>
      
      <div className="mb-4">
        <h3 className="text-gray-400 text-sm font-medium mb-2">I tuoi wallet</h3>
        <div className="space-y-2">
          {wallets.map((wallet, index) => (
            <div 
              key={index}
              onClick={() => onSelectAddress(wallet.address)}
              className={`p-2 rounded cursor-pointer transition-colors ${
                selectedAddress === wallet.address 
                  ? 'bg-primary text-white' 
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="text-sm font-medium">Wallet {index + 1}</div>
              <div className="text-xs font-mono truncate">
                {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
              </div>
            </div>
          ))}
        </div>
        
        <Button 
          onClick={onCreateWallet} 
          text="Nuovo Wallet" 
          variant="secondary"
          size="sm"
          className="mt-2 w-full"
        />
      </div>
      
      <div className="mt-auto">
        <div className="mb-4">
          <h3 className="text-gray-400 text-sm font-medium mb-2">Rete</h3>
          <select 
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-white cursor-pointer"
            value={selectedRpc}
            onChange={onRpcChange}
          >
            <option value="mainnet">Ethereum Mainnet</option>
            <option value="sepolia">Sepolia Testnet</option>
            <option value="goerli">Goerli Testnet</option>
          </select>
        </div>
        
        <Button 
          onClick={onLogout} 
          text="Logout" 
          variant="danger"
          size="sm"
          className="w-full"
        />
      </div>
    </div>
  );
};

export default Sidebar; 