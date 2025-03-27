// Type definitions for shogun-core
// This file extends the types provided by shogun-core

import { ShogunCore } from 'shogun-core';

declare module 'shogun-core' {
  interface IShogunCore {
    // Aggiungiamo un metodo pubblico per impostare il provider RPC
    setRpcUrl?: (rpcUrl: string) => boolean;
    // Aggiungiamo un metodo pubblico per ottenere l'URL del provider RPC
    getRpcUrl?: () => string | null;
  }

  // Estendiamo anche ShogunCore
  interface ShogunCore {
    // Aggiungiamo un metodo pubblico per impostare il provider RPC
    setRpcUrl?: (rpcUrl: string) => boolean;
    // Aggiungiamo un metodo pubblico per ottenere l'URL del provider RPC
    getRpcUrl?: () => string | null;
  }
} 