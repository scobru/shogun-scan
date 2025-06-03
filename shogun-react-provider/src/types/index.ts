// Export the connector options
export * from './connector-options';

// Re-export any necessary types from shogun-core
// These are for convenience so consumers don't have to import directly from shogun-core
import { AuthResult, SignUpResult, WalletInfo } from 'shogun-core';
export { AuthResult, SignUpResult, WalletInfo };

// Export any type extensions/declarations
export * from './shogun-core.d'; 