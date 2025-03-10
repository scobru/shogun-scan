import { TokenManager } from './TokenManager';

// ... nel render del componente ...
<div className="space-y-4">
  <div className="flex justify-between items-center">
    <h2 className="text-2xl font-bold">Il tuo wallet</h2>
    <div className="flex gap-2">
      <button onClick={() => setShowSendForm(true)} className="btn-primary">Invia</button>
      <button onClick={() => setShowReceiveModal(true)} className="btn-secondary">Ricevi</button>
    </div>
  </div>

  {selectedAddress && provider && (
    <TokenManager 
      address={selectedAddress} 
      provider={provider}
    />
  )}

  {/* ... resto del componente ... */}
</div> 