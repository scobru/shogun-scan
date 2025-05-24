import React from "react";
import { ReactNode, createContext, useContext, useEffect, useRef, useState } from "react";
import { ShogunCore , ShogunSDKConfig, MetaMaskPlugin , WebauthnPlugin, WalletPlugin } from "shogun-core";

const createBrowserClient = require("shogun-create").createBrowserClient;

// Context for ShogunGun integration
interface ShogunGunContextType {
  gun: any;
  shogun: ShogunCore | null;
  user: any;
  isAuth: boolean;
  login: (username: string, password: string) => Promise<any>;
  signup: (username: string, password: string, confirmPassword?: string) => Promise<any>;
  loginWithMetaMask: () => Promise<any>;
  signUpWithMetaMask: () => Promise<any>;
  loginWithWebAuthn: (username: string) => Promise<any>;
  signUpWithWebAuthn: (username: string) => Promise<any>;
  logout: () => void;
  getMainWallet: () => any;
  getPlugin: <T>(name: string) => T | undefined;
  hasPlugin: (name: string) => boolean;
  useSubscription: (key: string, callback: (value: any) => void) => void;
  useGunState: <T,>(key: string, initialValue: T) => [T, (val: T | ((prev: T) => T)) => void];
}

const ShogunGunContext = createContext<ShogunGunContextType>({
  gun: null,
  shogun: null,
  user: null,
  isAuth: false,
  login: async () => {},
  signup: async () => {},
  loginWithMetaMask: async () => {},
  signUpWithMetaMask: async () => {},
  loginWithWebAuthn: async () => {},
  signUpWithWebAuthn: async () => {},
  logout: () => {},
  getMainWallet: () => null,
  getPlugin: () => undefined,
  hasPlugin: () => false,
  useSubscription: () => {},
  useGunState: () => [null as any, () => {}],
});

export function ShogunGunProvider({
  children,
  peers = [],
  options = {},
}: {
  children: ReactNode;
  peers?: string[];
  options?: {
    appName?: string;
    appDescription?: string;
    appUrl?: string;
    appIcon?: string;
    showMetamask?: boolean;
    showWebauthn?: boolean;
    darkMode?: boolean;
    authToken?: string;
  };
}) {
  const [gun, setGun] = useState<any>(null);
  const [shogun, setShogun] = useState<ShogunCore | null>(null);
  const [user, setUser] = useState<any>(null);
  const [isAuth, setIsAuth] = useState(false);

  useEffect(() => {
    // Initialize Shogun
    try {
      const defaultPeers = ["http://localhost:8765/gun"];
      const activePeers = peers.length ? peers : defaultPeers;

      const gun = createBrowserClient(activePeers, {
        radiskPath: "shogun-radisk",
        useLocalStorage: false,
        useRadisk: false,
      });

      // Shogun configuration
      const config : ShogunSDKConfig = {
        gun: gun,
        
        authToken: options.authToken || "",

        // Enable MetaMask if requested
        metamask: {
          enabled: options.showMetamask ?? true,
        },

        // Enable WebAuthn if requested
        webauthn: {
          enabled: options.showWebauthn ?? true,
          rpName: options.appName || "Shogun App",
          rpId: typeof window !== "undefined" ? window.location.hostname : "",
        },

        // Enable wallet manager
        walletManager: {
          enabled: true,
        },

        // Logging configuration
        logging: {
          enabled: true,
          level: "info"
        },

        // Default timeouts
        timeouts: {
          login: 15000,
          signup: 30000,
        },
      };

      console.log("Initializing Shogun with peers:", activePeers);

      // Initialize ShogunCore
      const shogunInstance = new ShogunCore(config);
      setShogun(shogunInstance);

      // Get the Gun instance from Shogun
      const gunInstance = shogunInstance.gun;
      setGun(gunInstance);

      // Set the user
      setUser(gunInstance.user() || gunInstance.user().recall({ sessionStorage: true }));

      // Check if already authenticated
      if (shogunInstance.isLoggedIn()) {
        setIsAuth(true);
      }
    } catch (error) {
      console.error("Error initializing Shogun:", error);
    }

    return () => {
      // Cleanup if needed
    };
  }, [peers]);

  // Login with username/password
  const login = async (username: string, password: string) => {
    if (!shogun) return { success: false, error: "Shogun not initialized" };

    try {
      const result = await shogun.login(username, password);

      if (result.success) {
        setIsAuth(true);
        setUser(gun.user());
      }

      return result;
    } catch (error: any) {
      console.error("Login error:", error);
      return { success: false, error: error.message || "Unknown error during login" };
    }
  };

  // Signup with username/password
  const signup = async (username: string, password: string, confirmPassword?: string) => {
    if (!shogun) return { success: false, error: "Shogun not initialized" };

    try {
      if (confirmPassword && password !== confirmPassword) {
        return { success: false, error: "Passwords do not match" };
      }

      const result = await shogun.signUp(username, password);

      if (result.success) {
        setIsAuth(true);
        setUser(gun.user());
      }

      return result;
    } catch (error: any) {
      console.error("Signup error:", error);
      return { success: false, error: error.message || "Unknown error during signup" };
    }
  };

  // Login with MetaMask
  const loginWithMetaMask = async () => {
    if (!shogun) return { success: false, error: "Shogun not initialized" };

    try {
      // Check if MetaMask plugin is available
      if (!shogun.hasPlugin("metamask")) {
        return { success: false, error: "MetaMask plugin not available" };
      }

      const metamaskPlugin = shogun.getPlugin("metamask") as MetaMaskPlugin;
      if (!metamaskPlugin) {
        return { success: false, error: "Could not get MetaMask plugin" };
      }

      // Get the Ethereum provider
      const ethereum = (window as any).ethereum;
      if (!ethereum) {
        return { success: false, error: "MetaMask is not installed" };
      }

      // Request access to accounts
      const accounts = await ethereum.request({ method: "eth_requestAccounts" });
      if (!accounts || accounts.length === 0) {
        return { success: false, error: "No accounts found in MetaMask" };
      }

      const address = accounts[0];
      const result = await metamaskPlugin.login(address);

      if (result.success) {
        setIsAuth(true);
        setUser(gun.user());
      }

      return result;
    } catch (error: any) {
      console.error("MetaMask login error:", error);
      return { success: false, error: error.message || "Unknown error during MetaMask login" };
    }
  };

  // Signup with MetaMask
  const signUpWithMetaMask = async () => {
    if (!shogun) return { success: false, error: "Shogun not initialized" };

    try {
      // Check if MetaMask plugin is available
      if (!shogun.hasPlugin("metamask")) {
        return { success: false, error: "MetaMask plugin not available" };
      }

      const metamaskPlugin = shogun.getPlugin("metamask") as MetaMaskPlugin;
      if (!metamaskPlugin) {
        return { success: false, error: "Could not get MetaMask plugin" };
      }

      // Get the Ethereum provider
      const ethereum = (window as any).ethereum;
      if (!ethereum) {
        return { success: false, error: "MetaMask is not installed" };
      }

      // Request access to accounts
      const accounts = await ethereum.request({ method: "eth_requestAccounts" });
      if (!accounts || accounts.length === 0) {
        return { success: false, error: "No accounts found in MetaMask" };
      }

      const address = accounts[0];
      const result = await metamaskPlugin.signUp(address);

      if (result.success) {
        setIsAuth(true);
        setUser(gun.user());
      }

      return result;
    } catch (error: any) {
      console.error("MetaMask signup error:", error);
      return { success: false, error: error.message || "Unknown error during MetaMask signup" };
    }
  };

  // Login with WebAuthn
  const loginWithWebAuthn = async (username: string) => {
    if (!shogun) return { success: false, error: "Shogun not initialized" };

    try {
      // Check if WebAuthn plugin is available
      if (!shogun.hasPlugin("webauthn")) {
        return { success: false, error: "WebAuthn plugin not available" };
      }

      const webauthnPlugin = shogun.getPlugin("webauthn") as WebauthnPlugin;
      if (!webauthnPlugin) {
        return { success: false, error: "Could not get WebAuthn plugin" };
      }

      const result = await webauthnPlugin.login(username);

      if (result.success) {
        setIsAuth(true);
        setUser(gun.user());
      }

      return result;
    } catch (error: any) {
      console.error("WebAuthn login error:", error);
      return { success: false, error: error.message || "Unknown error during WebAuthn login" };
    }
  };

  // Signup with WebAuthn
  const signUpWithWebAuthn = async (username: string) => {
    if (!shogun) return { success: false, error: "Shogun not initialized" };

    try {
      // Check if WebAuthn plugin is available
      if (!shogun.hasPlugin("webauthn")) {
        return { success: false, error: "WebAuthn plugin not available" };
      }

      const webauthnPlugin = shogun.getPlugin("webauthn") as WebauthnPlugin;
      if (!webauthnPlugin) {
        return { success: false, error: "Could not get WebAuthn plugin" };
      }

      const result = await webauthnPlugin.signUp(username);

      if (result.success) {
        setIsAuth(true);
        setUser(gun.user());
      }

      return result;
    } catch (error: any) {
      console.error("WebAuthn signup error:", error);
      return { success: false, error: error.message || "Unknown error during WebAuthn signup" };
    }
  };

  // Logout function
  const logout = () => {
    if (!shogun) return;

    shogun.logout();
    setIsAuth(false);
    setUser(null);
  };

  // Get main wallet
  const getMainWallet = () => {
    if (!shogun) return null;

    const walletManager = shogun.getPlugin("wallet") as WalletPlugin;

    try {
      return walletManager && walletManager.getMainWallet();
    } catch (error) {
      console.error("Error getting main wallet:", error);
      return null;
    }
  };

  // Get a plugin
  const getPlugin = <T,>(name: string) => {
    if (!shogun) return undefined;
    return shogun.getPlugin<T>(name);
  };

  // Check if plugin is available
  const hasPlugin = (name: string) => {
    if (!shogun) return false;
    return shogun.hasPlugin(name);
  };

  const useSubscription = (key: string, callback: (value: any) => void) => {
    const cbRef = useRef(callback);
    useEffect(() => { cbRef.current = callback; }, [callback]);
    useEffect(() => {
      if (!gun) return;
      const node = gun.get(key);
      const handler = (data: any) => { if (data?.value !== undefined) cbRef.current(data.value); };
      node.once(handler);
      node.on(handler);
      return () => node.off && node.off();
    }, [gun, key]);
  };

  const useGunState = <T,>(key: string, initialValue: T): [T, (val: T | ((prev: T) => T)) => void] => {
    const [value, setValue] = useState<T>(initialValue);
    useEffect(() => {
      if (!gun) return;
      const node = gun.get(key);
      node.once((data: any) => { if (data?.value !== undefined) setValue(data.value); });
      node.on((data: any) => { if (data?.value !== undefined) setValue(data.value); });
      return () => node.off && node.off();
    }, [gun, key]);
    const setGunVal = (newVal: T | ((prev: T) => T)) => {
      const resolved = typeof newVal === 'function' ? (newVal as Function)(value) : newVal;
      setValue(resolved);
      gun.get(key).put({ value: resolved });
    };
    return [value, setGunVal];
  };

  return (
    <ShogunGunContext
      value={{
        gun,
        shogun,
        user,
        isAuth,
        login,
        signup,
        loginWithMetaMask,
        signUpWithMetaMask,
        loginWithWebAuthn,
        signUpWithWebAuthn,
        logout,
        getMainWallet,
        getPlugin,
        hasPlugin,
        useSubscription,
        useGunState,
      }}
    >
      {children}
    </ShogunGunContext>
  );
}

// Custom hook to use Gun via Shogun
export function useShogunGun() {
  return useContext(ShogunGunContext);
}
