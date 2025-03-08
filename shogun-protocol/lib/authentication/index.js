import { checkAuth } from "./isAuthenticated";
import loginUser from "./login";
import registerUser from "./register";
import { 
  shogunSDK, 
  shogunLogin, 
  shogunRegister, 
  shogunLogout,
  loadWallets,
  createWallet,
  signMessage,
  stealth,
  gun,
  user,
  loginWithMetamask,
  registerWithMetamask,
  loginWithWebAuthn,
  registerWithWebAuthn,
} from "./shogun-integration";

import { isAuthenticated } from "./isAuthenticated";

let logout = () => {
  gun.user().leave();
  isAuthenticated.next(false);
};

export { 
  checkAuth, 
  isAuthenticated, 
  loginUser, 
  registerUser, 
  logout,
  // Shogun exports
  shogunSDK,
  shogunLogin,
  shogunRegister,
  shogunLogout,
  // Nuovi metodi di autenticazione
  loginWithMetamask,
  registerWithMetamask,
  loginWithWebAuthn,
  registerWithWebAuthn,
  // Altre esportazioni
  loadWallets,
  createWallet,
  signMessage,
  stealth,
  gun,
  user
};

