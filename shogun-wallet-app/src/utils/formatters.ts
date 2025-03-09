/**
 * Funzioni di formattazione per l'interfaccia utente
 */

/**
 * Formatta un indirizzo Ethereum abbreviandolo
 * @param address Indirizzo Ethereum completo
 * @param startChars Numero di caratteri iniziali da mostrare (default: 6)
 * @param endChars Numero di caratteri finali da mostrare (default: 4)
 * @returns Indirizzo abbreviato
 */
export const formatAddress = (
  address: string,
  startChars: number = 6,
  endChars: number = 4
): string => {
  if (!address) return '';
  
  // Rimuovi '0x' se presente
  const cleanAddress = address.startsWith('0x') ? address.substring(2) : address;
  
  // Se l'indirizzo è più corto della lunghezza desiderata, mostralo per intero
  if (cleanAddress.length <= startChars + endChars) {
    return address;
  }
  
  // Altrimenti abbrevvialo
  const start = address.substring(0, startChars + 2); // +2 per includere '0x'
  const end = address.substring(address.length - endChars);
  
  return `${start}...${end}`;
};

/**
 * Formatta una data in formato leggibile italiano
 * @param date Data da formattare
 * @returns Data formattata
 */
export const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

/**
 * Formatta un importo in Ether a un formato leggibile
 * @param amount Importo in wei
 * @param decimals Numero di decimali da mostrare (default: 4)
 * @returns Importo formattato
 */
export const formatEther = (amount: string, decimals: number = 4): string => {
  if (!amount) return '0';
  
  try {
    // Converti da wei a ether
    const ether = parseFloat(amount) / 1e18;
    
    // Formatta con il numero specificato di decimali
    return ether.toFixed(decimals);
  } catch (error) {
    console.error('Errore nella formattazione dell\'importo:', error);
    return '0';
  }
}; 