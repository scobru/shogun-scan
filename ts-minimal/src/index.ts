/**
 * ts-minimal - Una libreria minimal per scrivere TypeScript in modo conciso
 * Ispirata alla semplicità di Rust, questa libreria fornisce alcune utility per ridurre la verbosità
 * del codice TypeScript.
 *
 * Funzionalità principali:
 * - record: Crea e valida oggetti tipizzati in modo conciso.
 * - pipe: Composizione funzionale per trasformare dati in maniera fluida.
 * - match: Simula il pattern matching per controllare condizioni.
 *
 * @module ts-minimal
 */

/**
 * Funzione record.
 *
 * Crea una funzione "costruttore" che, dato uno schema (un oggetto che definisce il tipo atteso per ciascuna proprietà),
 * verifica e ritorna l'oggetto validato. In questo modo, invece di scrivere interfacce o classi verbose, è possibile
 * creare oggetti tipizzati in una riga.
 *
 * @example
 * // Definizione di uno schema per un utente
 * const User = record<{ name: string; age: number }>({
 *   name: String,
 *   age: Number,
 * });
 *
 * // Creazione di un oggetto utente; se un campo non rispetta il tipo definito verrà lanciato un errore
 * const user = User({ name: 'Alice', age: 30 });
 *
 * @param schema - Oggetto che definisce il tipo atteso per ciascuna proprietà.
 * @returns Una funzione che prende un oggetto (parziale) e lo valida contro lo schema.
 *
 * @throws Se una proprietà è mancante o non corrisponde al tipo definito.
 */
export function record<T>(schema: { [K in keyof T]: any }): (obj: Partial<T>) => T {
    return (obj: Partial<T>): T => {
      const result = {} as T;
      for (const key in schema) {
        const typeCheck = schema[key];
        const value = obj[key];
        if (value === undefined || value === null) {
          throw new Error(`Proprietà "${key}" mancante.`);
        }
        // Controllo del tipo per i tipi primitivi e Date
        if (typeCheck === String) {
          if (typeof value !== "string") {
            throw new Error(`La proprietà "${key}" deve essere di tipo stringa.`);
          }
        } else if (typeCheck === Number) {
          if (typeof value !== "number") {
            throw new Error(`La proprietà "${key}" deve essere di tipo numero.`);
          }
        } else if (typeCheck === Boolean) {
          if (typeof value !== "boolean") {
            throw new Error(`La proprietà "${key}" deve essere di tipo booleano.`);
          }
        } else if (typeCheck === Date) {
          if (!(value instanceof Date)) {
            throw new Error(`La proprietà "${key}" deve essere una data.`);
          }
        } else {
          // Per altri tipi, usiamo instanceof se possibile
          // Facciamo un cast a "Function" per soddisfare il type checker
          if (!(value instanceof (typeCheck as { new (...args: any[]): any }))) {
            throw new Error(`La proprietà "${key}" deve essere un'istanza di ${typeCheck.name}.`);
          }
        }
        // Effettuiamo un cast su result per assicurare la compatibilità dei tipi
        (result as any)[key] = value;
      }
      return result;
    };
  }
  
  /**
   * Funzione pipe.
   *
   * Componi funzioni in stile funzionale applicandole in sequenza a un valore iniziale.
   * È molto utile per trasformazioni di dati in maniera fluida e leggibile.
   *
   * @example
   * const addOne = (x: number) => x + 1;
   * const double = (x: number) => x * 2;
   * const result = pipe(3, addOne, double); // (3 + 1) * 2 = 8
   *
   * @param value - Il valore iniziale.
   * @param fns - Una serie di funzioni da applicare in sequenza.
   * @returns Il risultato finale dopo l'applicazione di tutte le funzioni.
   */
  export function pipe<T>(value: T, ...fns: Array<(arg: any) => any>): any {
    return fns.reduce((acc, fn) => fn(acc), value);
  }
  
  /**
   * Funzione match.
   *
   * Simula il pattern matching, eseguendo una callback in base al risultato di una condizione sul valore.
   * Permette di evitare lunghi blocchi condizionali, rendendo il codice più pulito e dichiarativo.
   *
   * @example
   * const user = { name: 'Alice', age: 32 };
   * match(user, {
   *   when: u => u.age >= 31,
   *   then: u => console.log(`${u.name} è diventata più saggia.`),
   *   otherwise: u => console.log(`${u.name} è giovane.`)
   * });
   *
   * @param value - Il valore da testare.
   * @param options - Un oggetto che contiene:
   *  - when: una funzione predicato che restituisce un booleano.
   *  - then: una funzione da eseguire se il predicato restituisce true.
   *  - otherwise: una funzione da eseguire se il predicato restituisce false.
   * @returns Il risultato della funzione eseguita (then o otherwise).
   */
  export function match<T>(value: T, options: {
    when: (value: T) => boolean;
    then: (value: T) => any;
    otherwise: (value: T) => any;
  }): any {
    if (options.when(value)) {
      return options.then(value);
    } else {
      return options.otherwise(value);
    }
  }
  