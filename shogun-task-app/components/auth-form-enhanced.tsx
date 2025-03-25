"use client";

import { useGun } from "@/lib/gun-context";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ShogunButton, ShogunButtonProvider } from "shogun-button-react";

export function AuthFormEnhanced() {
  const {
    sdk,
    isAuthenticated,
    setIsAuthenticated,
    user,
    setUser,
  } = useGun();
  
  const router = useRouter();
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/"); // Reindirizza alla home page dopo il login
    }
  }, [isAuthenticated, router]);

  // Gestori di eventi per i callback di ShogunButtonProvider
  const handleLoginSuccess = (data: any) => {
    console.log("Login success:", data);
    
    // Aggiorna il contesto GunProvider con i dati dell'autenticazione
    if (data.userPub) {
      // Crea l'oggetto userData
      const userData = {
        pub: data.userPub,
        username: data.username,
        authMethod: data.authMethod || 'standard',
        wallet: data.wallet || null
      };
      
      // Salva nel localStorage
      localStorage.setItem("gunUser", JSON.stringify({
        ...userData,
        username: data.username,
        password: data.password // Salviamo la password per i login futuri
      }));
      
      // Aggiorna lo stato del contesto
      setUser?.(userData);
      setIsAuthenticated(true);
      
      console.log("Utente autenticato salvato nel GunProvider e localStorage");
    }
  };

  const handleSignupSuccess = (data: any) => {
    console.log("Signup success:", data);
    
    // Stesso comportamento di handleLoginSuccess
    handleLoginSuccess(data);
  };

  const handleError = (error: string) => {
    console.error("Authentication error:", error);
    setError(error);
  };

  // Verifica se l'SDK è stato inizializzato
  if (!sdk) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Inizializzazione</CardTitle>
          <CardDescription>
            Inizializzazione dell'SDK in corso...
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Accedi alla tua area personale</CardTitle>
          <CardDescription>
            Usa le tue credenziali per accedere
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
              {error}
            </div>
          )}
          
          <ShogunButtonProvider 
            sdk={sdk} 
            options={{
              appName: "Task App",
              darkMode: true,
              showMetamask: true,
              showWebauthn: true
            }}
            onLoginSuccess={handleLoginSuccess}
            onSignupSuccess={handleSignupSuccess}
            onError={handleError}
          >
            <ShogunButton />
          </ShogunButtonProvider>
        </CardContent>
      </Card>
    </div>
  );
}
