import React, { createContext, useContext, useMemo } from 'react'
import Gun from 'gun'



const GunContext = createContext(null)


export const GunProvider = ({ children, peers = [], authToken = '' }) => {
  const gun = useMemo(() => {
    const options = peers.length ? { peers } : {}
    window.gun = new Gun(options)

    // Store auth token globally for access from db.js
    window.authToken = authToken

    window.gun.on("put", function (msg) {
      var to = this.to;
      // Only add token if it exists and this is a write operation
      if (msg.put && authToken) {  
        msg.headers = {
          token: authToken,
        };
        // Also add auth property for compatibility
        msg.auth = { token: authToken };
        msg.token = authToken; 
      }
      to.next(msg); // pass to next middleware
    });
    
    return window.gun
  }, [peers, authToken]) // Add authToken to dependencies
  
  
  return (
    <GunContext.Provider value={gun}>
      {children}
    </GunContext.Provider>
  )
}


export const useGun = () => {
  return useContext(GunContext)
}