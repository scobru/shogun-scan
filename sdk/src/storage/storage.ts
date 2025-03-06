// Implementazione della Storage basata su StorageMock
export class Storage {
    private store: Map<string, any>;

    constructor() {
        this.store = new Map<string, any>();
        
        // Se in ambiente browser, tenta di caricare i dati da localStorage
        if (typeof localStorage !== 'undefined') {
            try {
                const storedPair = localStorage.getItem('shogun_keypair');
                if (storedPair) {
                    this.store.set('keypair', JSON.parse(storedPair));
                }
            } catch (error) {
                console.error('Errore nel recuperare i dati da localStorage:', error);
            }
        }
    }

    async getPair(): Promise<any> {
        return this.getPairSync();
    }

    getPairSync(): any {
        return this.store.get('keypair') || null;
    }

    async setPair(pair: any): Promise<void> {
        this.store.set('keypair', pair);
        
        // Se in ambiente browser, salva anche nel localStorage
        if (typeof localStorage !== 'undefined') {
            try {
                localStorage.setItem('shogun_keypair', JSON.stringify(pair));
            } catch (error) {
                console.error('Errore nel salvare i dati nel localStorage:', error);
            }
        }
    }

    clearAll(): void {
        this.store.clear();
        
        // Se in ambiente browser, pulisci anche localStorage
        if (typeof localStorage !== 'undefined') {
            try {
                localStorage.removeItem('shogun_keypair');
            } catch (error) {
                console.error('Errore nel rimuovere i dati dal localStorage:', error);
            }
        }
    }
} 