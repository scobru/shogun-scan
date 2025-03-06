"use client"

import { useGun } from "@/lib/gun-context"
import LoginWithShogunReact from "./shogun-login"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, KeyRound, Fingerprint, Wallet } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function AuthFormEnhanced() {
  const { 
    sdk, 
    login, 
    signup, 
    isAuthenticated, 
    setIsAuthenticated,
    loginWithWebAuthn,
    signupWithWebAuthn,
    isWebAuthnSupported,
    loginWithMetaMask,
    signUpWithMetaMask
  } = useGun()
  
  const router = useRouter()
  const [error, setError] = useState<string>("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("login")

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/") // Reindirizza alla home page dopo il login
    }
  }, [isAuthenticated, router])

  const handleStandardLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    
    if (!username || !password) {
      setError("Inserisci nome utente e password")
      return
    }
    
    try {
      setIsLoading(true)
      const success = await login(username, password)
      
      if (!success) {
        setError("Credenziali non valide")
      }
    } catch (error: any) {
      console.error("Errore durante il login:", error)
      setError(error.message || "Si è verificato un errore durante il login")
    } finally {
      setIsLoading(false)
    }
  }

  const handleStandardSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    
    if (!username || !password) {
      setError("Inserisci nome utente e password")
      return
    }
    
    if (password !== confirmPassword) {
      setError("Le password non corrispondono")
      return
    }
    
    try {
      setIsLoading(true)
      const success = await signup(username, password)
      
      if (!success) {
        setError("Errore durante la registrazione")
      }
    } catch (error: any) {
      console.error("Errore durante la registrazione:", error)
      setError(error.message || "Si è verificato un errore durante la registrazione")
    } finally {
      setIsLoading(false)
    }
  }

  const handleWebAuthnLogin = async () => {
    if (!username) {
      setError("Inserisci il nome utente per il login WebAuthn")
      return
    }
    
    try {
      setIsLoading(true)
      setError("")
      const success = await loginWithWebAuthn(username)
      
      if (!success) {
        setError("Errore durante il login con WebAuthn")
      }
    } catch (error: any) {
      console.error("Errore durante il login WebAuthn:", error)
      setError(error.message || "Si è verificato un errore durante il login WebAuthn")
    } finally {
      setIsLoading(false)
    }
  }

  const handleWebAuthnSignup = async () => {
    if (!username) {
      setError("Inserisci il nome utente per la registrazione WebAuthn")
      return
    }
    
    try {
      setIsLoading(true)
      setError("")
      const success = await signupWithWebAuthn(username)
      
      if (!success) {
        setError("Errore durante la registrazione con WebAuthn")
      }
    } catch (error: any) {
      console.error("Errore durante la registrazione WebAuthn:", error)
      setError(error.message || "Si è verificato un errore durante la registrazione WebAuthn")
    } finally {
      setIsLoading(false)
    }
  }

  const handleMetaMaskLogin = async () => {
    try {
      setIsLoading(true)
      setError("")
      
      // Prima connetti MetaMask per ottenere l'indirizzo
      if (!window.ethereum) {
        setError("MetaMask non è installato")
        return
      }
      
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      if (!accounts || accounts.length === 0) {
        setError("Nessun account MetaMask disponibile")
        return
      }
      
      const address = accounts[0]
      const success = await loginWithMetaMask(address)
      
      if (!success) {
        setError("Errore durante il login con MetaMask")
      }
    } catch (error: any) {
      console.error("Errore durante il login MetaMask:", error)
      setError(error.message || "Si è verificato un errore durante il login MetaMask")
    } finally {
      setIsLoading(false)
    }
  }

  const handleMetaMaskSignup = async () => {
    try {
      setIsLoading(true)
      setError("")
      
      // Prima connetti MetaMask per ottenere l'indirizzo
      if (!window.ethereum) {
        setError("MetaMask non è installato")
        return
      }
      
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      if (!accounts || accounts.length === 0) {
        setError("Nessun account MetaMask disponibile")
        return
      }
      
      const address = accounts[0]
      const success = await signUpWithMetaMask(address)
      
      if (!success) {
        setError("Errore durante la registrazione con MetaMask")
      }
    } catch (error: any) {
      console.error("Errore durante la registrazione MetaMask:", error)
      setError(error.message || "Si è verificato un errore durante la registrazione MetaMask")
    } finally {
      setIsLoading(false)
    }
  }

  // Verifica se l'SDK è stato inizializzato
  if (!sdk) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Inizializzazione</CardTitle>
          <CardDescription>Inizializzazione dell'SDK in corso...</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>{activeTab === "login" ? "Accedi" : "Registrati"}</CardTitle>
        <CardDescription>
          {activeTab === "login" 
            ? "Accedi al tuo account con uno dei metodi disponibili" 
            : "Crea un nuovo account con uno dei metodi disponibili"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Accedi</TabsTrigger>
            <TabsTrigger value="signup">Registrati</TabsTrigger>
          </TabsList>
          
          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Errore</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <TabsContent value="login" className="space-y-4 mt-4">
            <form onSubmit={handleStandardLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Nome utente</Label>
                <Input 
                  id="username" 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)} 
                  placeholder="Inserisci il tuo nome utente" 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input 
                  id="password" 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  placeholder="Inserisci la tua password" 
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                <KeyRound className="mr-2 h-4 w-4" />
                Accedi
              </Button>
            </form>
            
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Oppure
                </span>
              </div>
            </div>
            
            <div className="space-y-2">
              {isWebAuthnSupported() && (
                <Button 
                  variant="outline" 
                  className="w-full" 
                  onClick={handleWebAuthnLogin}
                  disabled={isLoading}
                >
                  <Fingerprint className="mr-2 h-4 w-4" />
                  Accedi con WebAuthn
                </Button>
              )}
              
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={handleMetaMaskLogin}
                disabled={isLoading}
              >
                <Wallet className="mr-2 h-4 w-4" />
                Accedi con MetaMask
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="signup" className="space-y-4 mt-4">
            <form onSubmit={handleStandardSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-username">Nome utente</Label>
                <Input 
                  id="signup-username" 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)} 
                  placeholder="Scegli un nome utente" 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <Input 
                  id="signup-password" 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  placeholder="Scegli una password" 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Conferma Password</Label>
                <Input 
                  id="confirm-password" 
                  type="password" 
                  value={confirmPassword} 
                  onChange={(e) => setConfirmPassword(e.target.value)} 
                  placeholder="Conferma la tua password" 
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                <KeyRound className="mr-2 h-4 w-4" />
                Registrati
              </Button>
            </form>
            
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Oppure
                </span>
              </div>
            </div>
            
            <div className="space-y-2">
              {isWebAuthnSupported() && (
                <Button 
                  variant="outline" 
                  className="w-full" 
                  onClick={handleWebAuthnSignup}
                  disabled={isLoading}
                >
                  <Fingerprint className="mr-2 h-4 w-4" />
                  Registrati con WebAuthn
                </Button>
              )}
              
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={handleMetaMaskSignup}
                disabled={isLoading}
              >
                <Wallet className="mr-2 h-4 w-4" />
                Registrati con MetaMask
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
} 