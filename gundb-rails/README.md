# GunDB Rails

Framework per la generazione di modelli in stile Rails/ActiveRecord per GunDB.

## Caratteristiche

- 🚀 Generazione di modelli con attributi tipizzati
- 🔄 Relazioni tra modelli in stile ActiveRecord (hasMany, belongsTo, hasOne)
- 📝 CRUD API completa per ogni modello
- 🌐 Integrazione avanzata con NextJS (App Router e Pages Router)
- 🔍 Query automatiche e filtri
- 📦 Gestione automatica delle relazioni

## Installazione

```bash
npm install -g gundb-rails
# oppure
yarn global add gundb-rails
```

## Uso base

### Generazione di un modello

```bash
gundb-rails generate User name:string age:number email:string
```

Questo comando genera un modello `User` con gli attributi specificati in `models/User.ts`.

### Utilizzo del modello

```typescript
import Gun from 'gun';
import { User } from './models/User';

// Inizializza GunDB
const gun = Gun();

// Imposta l'istanza Gun per il modello
User.setGunInstance(gun);

async function main() {
  // Crea un nuovo utente
  const user = new User({
    name: 'Mario',
    age: 30,
    email: 'mario@example.com'
  });
  
  // Salva l'utente
  await user.save();
  console.log('Utente salvato:', user);
  
  // Trova tutti gli utenti
  const users = await User.findAll();
  console.log('Tutti gli utenti:', users);
  
  // Trova un utente per ID
  const foundUser = await User.findById(user.attrs._soul);
  console.log('Utente trovato:', foundUser);
  
  // Elimina l'utente
  await user.delete();
  console.log('Utente eliminato');
}

main();
```

## Relazioni tra modelli (in stile ActiveRecord)

### Comando relations

Per esplorare le relazioni e vedere esempi di utilizzo:

```bash
gundb-rails relations
```

Questo comando mostra esempi pratici di come definire e utilizzare le relazioni tra modelli.

### Generazione di modelli con relazioni

```bash
# Genera un modello Post con relazione a User
gundb-rails generate Post title:string content:string \
  --relation belongsTo:User:author \
  --use-base-model

# Genera un modello User con relazione a Post
gundb-rails generate User name:string email:string \
  --relation hasMany:Post:posts \
  --use-base-model
```

L'opzione `--use-base-model` indica di utilizzare la nuova classe base `Model` che supporta le relazioni in stile ActiveRecord.

### Tipi di relazioni supportate

- **hasMany**: relazione uno-a-molti (es. un utente ha molti post)
- **belongsTo**: relazione di appartenenza (es. un post appartiene a un utente)
- **hasOne**: relazione uno-a-uno (es. un utente ha un profilo)

### Sintassi delle relazioni

Le relazioni in GunDB Rails seguono una sintassi simile ad ActiveRecord:

```typescript
// Definizione delle relazioni (in fase di creazione del modello)
User.hasMany('Post', { as: 'posts' });
Post.belongsTo('User', { as: 'author' });

// Utilizzo delle relazioni (a runtime)
await user.posts.add(post);         // Aggiunge un post a un utente
const posts = await user.posts.all(); // Ottiene tutti i post di un utente
await post.author.set(user);        // Imposta l'autore di un post
const author = await post.author.get(); // Ottiene l'autore di un post
```

### Esempio di utilizzo completo

```typescript
import Gun from 'gun';
import { User } from './models/User';
import { Post } from './models/Post';

// Inizializza GunDB
const gun = Gun();

// Imposta l'istanza Gun per i modelli
User.setGunInstance(gun);
Post.setGunInstance(gun);

async function main() {
  // Crea un nuovo utente
  const user = new User({
    name: 'Mario',
    email: 'mario@example.com'
  });
  await user.save();
  
  // Crea un nuovo post
  const post = new Post({
    title: 'Il mio primo post',
    content: 'Questo è il contenuto del post'
  });
  await post.save();
  
  // RELAZIONI HASMANY
  
  // Aggiungi il post all'utente (relazione hasMany)
  await user.posts.add(post);
  
  // Ottieni tutti i post dell'utente
  const userPosts = await user.posts.all();
  console.log('Post dell\'utente:', userPosts);
  
  // Verifica se l'utente ha post
  const hasPosts = await user.posts.exists();
  console.log('L\'utente ha post:', hasPosts);
  
  // Crea un nuovo post e aggiungilo direttamente all'utente
  const newPost = await user.posts.create({
    title: 'Un altro post',
    content: 'Contenuto del nuovo post'
  });
  
  // Trova i post dell'utente con un titolo specifico
  const filteredPosts = await user.posts.where({ title: 'Un altro post' });
  console.log('Post filtrati:', filteredPosts);
  
  // Rimuovi un post dall'utente
  await user.posts.remove(post);
  
  // RELAZIONI BELONGSTO
  
  // Imposta l'autore del post (relazione belongsTo)
  await post.author.set(user);
  
  // Ottieni l'autore del post
  const postAuthor = await post.author.get();
  console.log('Autore del post:', postAuthor);
}

main();
```

## Integrazione con NextJS

GunDB Rails supporta sia Next.js App Router (13+) che il tradizionale Pages Router.

Per generare un'integrazione con NextJS:

```bash
gundb-rails generate User name:string --nextjs
```

Questo comando genera:
- Il modello `User`
- Un hook personalizzato `useUser` in `hooks/shogun/useUser.ts`
- Un provider GunDB in `components/shogun/GunProvider.tsx`
- Se presente App Router: una pagina in `app/shogun/user/page.tsx`
- Se presente Pages Router: una pagina in `pages/shogun/user.tsx`

### Utilizzo degli hooks generati

```tsx
import { useUsers, useUser } from '../../hooks/shogun/useUser';

// Nel componente React
function UsersList() {
  const { users, loading } = useUsers();
  
  if (loading) return <div>Caricamento...</div>;
  
  return (
    <div>
      {users.map(user => (
        <div key={user.attrs._soul}>
          {user.name}
        </div>
      ))}
    </div>
  );
}

function UserDetail({ id }) {
  const { user, loading } = useUser(id);
  
  if (loading) return <div>Caricamento...</div>;
  if (!user) return <div>Utente non trovato</div>;
  
  return (
    <div>
      <h1>{user.name}</h1>
      <p>Email: {user.email}</p>
    </div>
  );
}
```

## Inizializzazione di un progetto completo

```bash
gundb-rails shogun-init
```

Questo comando inizializza un nuovo progetto basato su scaffold-eth-2 con:
- Integrazione GunDB
- Relay GunDB per la sincronizzazione dei dati
- Componenti per l'autenticazione Shogun
- Pagine di esempio

## Comandi disponibili

- `gundb-rails generate <model> [fields...]` - Genera un nuovo modello
- `gundb-rails relations` - Mostra esempi di utilizzo delle relazioni
- `gundb-rails shogun-init` - Inizializza un nuovo progetto
- `gundb-rails model` - Mostra informazioni sui modelli

## Contribuire

Le contribuzioni sono benvenute! Apri una issue o una pull request su GitHub.
```