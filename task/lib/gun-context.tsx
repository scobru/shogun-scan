"use client"

import { IGunInstance } from "gun"
import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { ShogunSDK } from "shogun-sdk"

type GunContextType = {
  gun: IGunInstance | null
  sdk: ShogunSDK | null
  user: any | null
  isAuthenticated: boolean
  setIsAuthenticated: (isAuthenticated: boolean) => void
  login: (username: string, password: string) => Promise<boolean>
  signup: (username: string, password: string) => Promise<boolean>
  logout: () => void
  loginWithWebAuthn: (username: string) => Promise<boolean>
  signupWithWebAuthn: (username: string) => Promise<boolean>
  isWebAuthnSupported: () => boolean
}

const GunContext = createContext<GunContextType>({
  gun: null,
  sdk: null,
  user: null,
  isAuthenticated: false,
  setIsAuthenticated: () => {},
  login: async () => false,
  signup: async () => false,
  logout: () => {},
  loginWithWebAuthn: async () => false,
  signupWithWebAuthn: async () => false,
  isWebAuthnSupported: () => false,
})

export function GunProvider({ children }: { children: ReactNode }) {
  const [gun, setGun] = useState<IGunInstance | null>(null)
  const [sdk, setSdk] = useState<ShogunSDK | null>(null)
  const [user, setUser] = useState<any | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    // Inizializza Gun con ShogunSDK
    const shogunSDK = new ShogunSDK({
      peers: ["http://localhost:8765/gun"],
    }) as ShogunSDK

    setSdk(shogunSDK)

    const gunInstance = shogunSDK.gundb.gun as IGunInstance
    setGun(gunInstance)

    // Controlla se l'utente è già autenticato
    const userFromStorage = localStorage.getItem("gunUser")
    if (userFromStorage) {
      try {
        const parsedUser = JSON.parse(userFromStorage)
        setUser(parsedUser)
        setIsAuthenticated(true)
      } catch (error) {
        console.error("Errore nel parsing dell'utente:", error)
        localStorage.removeItem("gunUser")
      }
    }

    return () => {
      // Pulizia
      if (gunInstance) {
        gunInstance.user().leave()
      }
    }
  }, [])

  const login = async (username: string, password: string): Promise<boolean> => {
    if (!sdk) return false

    try {
      const result = await sdk.handleLogin(username, password, {
        setUserpub: (pub: string) => {
          // Aggiorniamo il context con il pub dell'utente
          const userData = { pub };
          setUser(userData);
        },
        setSignedIn: (signedIn: boolean) => {
          setIsAuthenticated(signedIn);
        }
      });
      
      if (result.success) {
        // Salva l'utente anche se non c'è il wallet (caso MetaMask)
        if (result.wallet || result.userPub) {
          const userData = result.wallet || { pub: result.userPub };
          setUser(userData);
          setIsAuthenticated(true);
          // Salva l'utente nel localStorage
          localStorage.setItem("gunUser", JSON.stringify({
            ...userData,
            username,
            password // Salviamo la password per i login futuri
          }));
          return true;
        }
      }
      
      return false;
    } catch (error: any) {
      console.error("Errore durante il login:", error);
      // Se il documento non esiste, proviamo a crearlo
      if (error.message?.includes("Document not found")) {
        try {
          // Tentiamo di registrare l'utente
          const signupResult = await signup(username, password)
          if (signupResult) {
            return login(username, password)
          }
        } catch (signupError) {
          console.error("Errore durante il tentativo di registrazione:", signupError)
        }
      }
      return false
    }
  }

  const signup = async (username: string, password: string): Promise<boolean> => {
    if (!sdk) return false

    try {
      const result = await sdk.handleSignUp(username, password, password, {
        setErrorMessage: (msg: string) => console.error(msg),
        setUserpub: (pub: string) => {
          // Aggiorniamo il context con il pub dell'utente
          const userData = { pub };
          setUser(userData);
        },
        setSignedIn: (signedIn: boolean) => {
          setIsAuthenticated(signedIn);
        }
      });
      
      if (result.success) {
        // Salva l'utente anche se non c'è il wallet (caso MetaMask)
        if (result.wallet || result.userPub) {
          const userData = result.wallet || { pub: result.userPub };
          setUser(userData);
          setIsAuthenticated(true);
          // Salva l'utente nel localStorage
          localStorage.setItem("gunUser", JSON.stringify({
            ...userData,
            username,
            password // Salviamo la password per i login futuri
          }));
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error("Errore durante la registrazione:", error);
      return false;
    }
  }

  const logout = () => {
    if (!sdk) return

    sdk.logout()
    setUser(null)
    setIsAuthenticated(false)
    localStorage.removeItem("gunUser")
  }

  const loginWithWebAuthn = async (username: string): Promise<boolean> => {
    if (!sdk) return false

    try {
      const result = await sdk.loginWithWebAuthn(username);
      
      if (result.success) {
        const userData = {
          pub: result.userPub || result.credentialId,
          username,
          authMethod: 'webauthn'
        };
        setUser(userData);
        setIsAuthenticated(true);
        localStorage.setItem("gunUser", JSON.stringify(userData));
        return true;
      }
      
      return false;
    } catch (error) {
      console.error("Errore durante il login con WebAuthn:", error);
      return false;
    }
  }

  const signupWithWebAuthn = async (username: string): Promise<boolean> => {
    if (!sdk) return false

    try {
      const result = await sdk.registerWithWebAuthn(username);
      
      if (result.success) {
        const userData = {
          pub: result.userPub || result.credentialId,
          username,
          authMethod: 'webauthn'
        };
        setUser(userData);
        setIsAuthenticated(true);
        localStorage.setItem("gunUser", JSON.stringify(userData));
        return true;
      }
      
      return false;
    } catch (error) {
      console.error("Errore durante la registrazione con WebAuthn:", error);
      return false;
    }
  }

  const isWebAuthnSupported = (): boolean => {
    if (!sdk) return false
    return sdk.isWebAuthnSupported()
  }

  return (
    <GunContext.Provider value={{ 
      gun, 
      sdk, 
      user, 
      isAuthenticated, 
      setIsAuthenticated,
      login, 
      signup, 
      logout,
      loginWithWebAuthn,
      signupWithWebAuthn,
      isWebAuthnSupported
    }}>
      {children}
    </GunContext.Provider>
  )
}

export const useGun = () => useContext(GunContext)

