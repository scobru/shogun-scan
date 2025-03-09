import { record, pipe, match } from './index';

// Definizione di uno schema per un utente
const User = record<{ name: string; age: number }>({
  name: String,
  age: Number,
});

// Creazione di un oggetto utente (verrà validato in base allo schema)
const user = User({ name: 'Alice', age: 30 });

// Funzione che incrementa l'età
const celebrateBirthday = (u: typeof user) => ({
  ...u,
  age: u.age + 1,
});

// Uso di pipe per comporre funzioni: applica celebrateBirthday a user
const newUser = pipe(user, celebrateBirthday);

// Uso di match per eseguire una logica in base all'età
match(newUser, {
  when: (u) => u.age >= 31,
  then: (u) => console.log(`${u.name} è diventata più saggia con l'età!`),
  otherwise: (u) => console.log(`${u.name} è giovane e vivace!`)
});
