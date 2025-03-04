import React from 'react';
import Button from './Button';

interface RpcOption {
  value: string;
  label: string;
  url: string;
}

interface SidebarProps {
  selectedRpc: string;
  handleRpcChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  logout: () => void;
  rpcOptions: RpcOption[];
  activeSection: string;
  onSectionChange: (section: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  selectedRpc,
  handleRpcChange,
  logout,
  rpcOptions,
  activeSection,
  onSectionChange
}) => {
  const sections = [
    { id: "wallet", label: "Wallet", icon: "💰" },
    { id: "stealth", label: "Stealth", icon: "🕵️" },
    { id: "profile", label: "Profilo", icon: "👤" }
  ];

  return (
    <div className="w-[200px] bg-card p-6 flex flex-col border-r border-border">
      <div className="mb-8">
        <h2 className="text-white text-xl font-semibold">Shogun</h2>
      </div>
      <div className="flex-1 mb-4">
        {sections.map(section => (
          <div 
            key={section.id}
            onClick={() => onSectionChange(section.id)}
            className={`flex items-center px-4 py-3 mb-2 rounded cursor-pointer transition-colors ${activeSection === section.id ? 'bg-primary text-white' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
          >
            <span>{section.icon} {section.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 w-full">
        <select 
          className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-white cursor-pointer appearance-none"
          value={selectedRpc}
          onChange={handleRpcChange}
        >
          {rpcOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <Button onClick={logout} text="Log Out" />
    </div>
  );
};

export default Sidebar; 