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
    // Fallback per casi in cui il router non è disponibile
    navigate = (path) => {
      console.warn(`Navigation to ${path} not available outside router context`);
      // Fallback che usa redirezione base con window.location
      if (typeof window !== 'undefined') {
        window.location.href = path;
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
      navigate: (path) => {
        console.warn(`Navigation to ${path} not available outside router context`);
        // Fallback che usa redirezione base con window.location
        if (typeof window !== 'undefined') {
          window.location.href = path;
        }
      },
      location: { pathname: typeof window !== 'undefined' ? window.location.pathname : '/' }
    };
  }
  return context;
} 