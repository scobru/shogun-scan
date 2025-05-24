"use client";

import React, { ReactNode } from "react";
import dynamic from "next/dynamic";

export const DynamicShogunGunProvider = dynamic(
  () => import("./ShogunGunProvider").then((mod) => mod.ShogunGunProvider),
  {
    ssr: false,
  }
);

interface ShogunProvidersProps {
  children: ReactNode;
}

export function ShogunProviders({ children }: ShogunProvidersProps) {
  // Puoi configurare qui i peers di Gun e le opzioni di Shogun
  const gunPeers = [
    "http://localhost:8765/gun",
    // Aggiungi qui altri peer se necessario
  ];

  const shogunOptions = {
    appName: "Shogun App",
    showMetamask: true,
    showWebauthn: true,
    darkMode: true,
  };

  return (
    <DynamicShogunGunProvider peers={gunPeers} options={shogunOptions}>
      {children}
    </DynamicShogunGunProvider>
  );
}
