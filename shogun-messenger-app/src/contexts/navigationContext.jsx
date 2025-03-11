import { createContext, useContext } from "solid-js";
import { useNavigate as useRouterNavigate, useLocation as useRouterLocation } from "@solidjs/router";

// Creiamo un contesto di navigazione che include navigate e location
const NavigationContext = createContext();

export function NavigationProvider(props) {
  // In alcune situazioni, useNavigate potrebbe non essere disponibile
  let navigate;
  let location;
  
  try {
    navigate = useRouterNavigate();
    location = useRouterLocation();
  } catch (e) {
    console.warn("Navigation context initialization error:", e);
    // Fallback più soft che non causa refresh completo della pagina quando possibile
    navigate = (path, options) => {
      console.warn(`Navigation to ${path} not available outside router context`);
      // Solo se è assolutamente necessario, usiamo window.location
      if (typeof window !== 'undefined') {
        // Verifichiamo se siamo sulla stessa origin per evitare refresh non necessari
        const currentPath = window.location.pathname;
        if (currentPath === path) {
          // Se è lo stesso percorso, non facciamo nulla per evitare refresh
          return;
        }
        
        // Utilizziamo history API quando possibile per evitare refresh completo
        try {
          window.history.pushState({}, '', path);
          // Dispatchamo un evento di cambiamento di posizione per notificare il router
          window.dispatchEvent(new PopStateEvent('popstate', { state: options?.state || {} }));
          return;
        } catch (historyError) {
          console.warn("History API not available, falling back to location redirect");
          window.location.href = path;
        }
      }
    };
    location = { pathname: typeof window !== 'undefined' ? window.location.pathname : '/' };
  }
  
  return (
    <NavigationContext.Provider value={{ navigate, location }}>
      {props.children}
    </NavigationContext.Provider>
  );
}

// Hook personalizzato che può essere utilizzato ovunque
export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    // Fallback per ambienti di test o quando il context non è disponibile
    return {
      navigate: (path, options) => {
        console.warn(`Navigation to ${path} not available outside router context`);
        // Utilizziamo lo stesso approccio migliorato
        if (typeof window !== 'undefined') {
          const currentPath = window.location.pathname;
          if (currentPath === path) {
            return;
          }
          
          try {
            window.history.pushState({}, '', path);
            window.dispatchEvent(new PopStateEvent('popstate', { state: options?.state || {} }));
            return;
          } catch (historyError) {
            window.location.href = path;
          }
        }
      },
      location: { pathname: typeof window !== 'undefined' ? window.location.pathname : '/' }
    };
  }
  return context;
} 