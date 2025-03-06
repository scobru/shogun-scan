"use client"

import { useGun } from "@/lib/gun-context"
import LoginWithShogunReact from "./shogun-login"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

export function AuthFormEnhanced() {
  const { 
    sdk, 
    login, 
    signup, 
    isAuthenticated, 
    setIsAuthenticated,
    loginWithWebAuthn,
    signupWithWebAuthn,
    isWebAuthnSupported 
  } = useGun()
  const router = useRouter()
  const [error, setError] = useState<string>("")

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/") // Reindirizza alla home page dopo il login
    }
  }, [isAuthenticated, router])

  const handleLoginSuccess = async (data: { 
    userPub: string
    username: string
    password?: string
    wallet?: any
    authMethod?: string
  }) => {
    try {
      console.log("Login effettuato con successo, dati SDK:", data)

      // Se è un login con WebAuthn o MetaMask, effettua comunque il login nel contesto Gun
      if (data.authMethod === 'webauthn' || data.authMethod?.includes('metamask')) {
        console.log("Login con WebAuthn o MetaMask")

        // Verifica che i dati dell'SDK siano presenti
        if (!data.username || !data.password || !data.userPub) {
          throw new Error("Credenziali SDK mancanti")
        }

        // Per MetaMask, usa SOLO le credenziali dell'SDK senza modifiche
        if (data.authMethod?.includes('metamask')) {
          // Verifica se ci sono credenziali salvate in localStorage
          const savedUser = localStorage.getItem("gunUser")
          if (savedUser) {
            const userData = JSON.parse(savedUser)
            if (userData.username && userData.password) {
              console.log("Tentativo login con credenziali salvate:", { username: userData.username })
              const success = await login(userData.username, userData.password)
              if (success) {
                setIsAuthenticated(true)
                return
              }
            }
          }

          // Se non ci sono credenziali salvate o il login è fallito, usa le credenziali dell'SDK
          console.log("Login MetaMask con credenziali SDK:", { username: data.username })
          const success = await login(data.username, data.password)
          if (!success) {
            throw new Error("Errore durante il login MetaMask nel contesto Gun")
          }

          // Salva i dati dell'utente solo dopo un login riuscito
          const userData = {
            pub: data.userPub,
            username: data.username,
            authMethod: data.authMethod,
            wallet: data.wallet,
            password: data.password
          }
          localStorage.setItem("gunUser", JSON.stringify(userData))
          setIsAuthenticated(true)
          return
        }

        // Per WebAuthn
        if (data.authMethod === 'webauthn') {
          const success = await loginWithWebAuthn(data.username)
          if (!success) {
            throw new Error("Errore durante il login WebAuthn nel contesto Gun")
          }

          // Salva i dati dell'utente
          const userData = {
            pub: data.userPub,
            username: data.username,
            authMethod: data.authMethod
          }
          localStorage.setItem("gunUser", JSON.stringify(userData))
          setIsAuthenticated(true)
          return
        }
      }

      // Login standard
      if (data.username && data.password) {
        console.log("Login standard")
        const success = await login(data.username, data.password)
        if (!success) {
          throw new Error("Errore durante il login nel contesto")
        }
      } else {
        throw new Error("Dati di login incompleti")
      }

      setIsAuthenticated(true)

    } catch (error: any) {
      console.error("Errore durante il login:", error)
      setError(error.message || "Si è verificato un errore durante il login")
    }
  }

  const handleSignupSuccess = async (data: {
    userPub: string
    username: string
    password?: string
    wallet?: any
    authMethod?: string
  }) => {
    try {
      console.log("Registrazione effettuata con successo, dati SDK:", data)
      
      // Se è una registrazione con WebAuthn o MetaMask
      if (data.authMethod === 'webauthn' || data.authMethod?.includes('metamask')) {
        // Verifica che i dati dell'SDK siano presenti
        if (!data.username || !data.password || !data.userPub) {
          throw new Error("Credenziali SDK mancanti")
        }

        // Per MetaMask, usa SOLO le credenziali dell'SDK senza modifiche
        if (data.authMethod?.includes('metamask')) {
          // Verifica se ci sono credenziali salvate in localStorage
          const savedUser = localStorage.getItem("gunUser")
          if (savedUser) {
            const userData = JSON.parse(savedUser)
            if (userData.username && userData.password) {
              console.log("Tentativo login con credenziali salvate:", { username: userData.username })
              const success = await login(userData.username, userData.password)
              if (success) {
                setIsAuthenticated(true)
                return
              }
            }
          }

          // Se non ci sono credenziali salvate o il login è fallito, usa le credenziali dell'SDK
          console.log("Registrazione MetaMask con credenziali SDK:", { username: data.username })
          const success = await signup(data.username, data.password)
          if (!success) {
            // Se la registrazione fallisce, prova il login con le stesse credenziali
            console.log("Registrazione fallita, tentativo login con credenziali SDK...")
            const loginSuccess = await login(data.username, data.password)
            if (!loginSuccess) {
              throw new Error("Errore durante la registrazione/login MetaMask nel contesto Gun")
            }
          }

          // Salva i dati dell'utente
          const userData = {
            pub: data.userPub,
            username: data.username,
            authMethod: data.authMethod,
            wallet: data.wallet,
            password: data.password
          }
          localStorage.setItem("gunUser", JSON.stringify(userData))
          setIsAuthenticated(true)
          return
        }

        // Per WebAuthn
        if (data.authMethod === 'webauthn') {
          const success = await signupWithWebAuthn(data.username)
          if (!success) {
            const loginSuccess = await loginWithWebAuthn(data.username)
            if (!loginSuccess) {
              throw new Error("Errore durante la registrazione/login WebAuthn nel contesto Gun")
            }
          }

          // Salva i dati dell'utente
          const userData = {
            pub: data.userPub,
            username: data.username,
            authMethod: data.authMethod
          }
          localStorage.setItem("gunUser", JSON.stringify(userData))
          setIsAuthenticated(true)
          return
        }
      }

      // Registrazione standard
      if (data.username && data.password) {
        // Prima creiamo l'utente
        const signupSuccess = await signup(data.username, data.password)
        if (!signupSuccess) {
          throw new Error("Errore durante la registrazione nel contesto Gun")
        }

        // Poi effettuiamo il login
        const loginSuccess = await login(data.username, data.password)
        if (!loginSuccess) {
          throw new Error("Errore durante il login dopo la registrazione")
        }
      } else {
        throw new Error("Dati di registrazione incompleti")
      }
    } catch (error: any) {
      console.error("Errore durante la registrazione:", error)
      setError(error.message || "Si è verificato un errore durante la registrazione")
    }
  }

  const handleError = (error: string) => {
    console.error("Errore:", error)
    setError(error)
  }

  const customMessages = {
    loginHeader: "Accedi a Task App",
    signupHeader: "Registrati su Task App",
    loginButton: "Accedi",
    signupButton: "Registrati",
    usernameLabel: "Username",
    passwordLabel: "Password",
    confirmPasswordLabel: "Conferma Password",
    switchToSignup: "Non hai un account? Registrati",
    switchToLogin: "Hai già un account? Accedi",
    webauthnLogin: "Accedi con WebAuthn",
    webauthnSignup: "Registrati con WebAuthn",
    mismatched: "Le password non corrispondono",
    empty: "Tutti i campi sono obbligatori",
    exists: "Utente già esistente"
  }

  // Se l'utente è già autenticato, non mostrare il form
  if (isAuthenticated) {
    return null
  }

  // Se l'SDK non è ancora pronto, mostra il loader
  if (!sdk) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
    </div>
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      {error && (
        <div className="mb-4 p-4 bg-destructive/10 text-destructive rounded-lg max-w-md w-full">
          {error}
        </div>
      )}
      <LoginWithShogunReact
        sdk={sdk}
        onLoginSuccess={handleLoginSuccess}
        onSignupSuccess={handleSignupSuccess}
        onError={handleError}
        customMessages={customMessages}
        darkMode={true}
        showMetamask={true}
        showWebauthn={isWebAuthnSupported()}
      />
    </div>
  )
} 