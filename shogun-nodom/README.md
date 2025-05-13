# 🔫 **Shogun NoDom** beta

An ultra-lightweight reactive library based on signals for building dynamic user interfaces with GunDB.

## 📖 **Introduction**

**Shogun NoDom** is a signal-based reactive JavaScript library for building dynamic user interfaces with GunDB. It offers powerful reactivity with minimal overhead.

> ⚡️ _Shogun NoDom focuses on **simplicity**, **reactivity**, and **data persistence** without sacrificing developer experience._

_Comparison with other reactive libraries_

| Library | Size | Integrated Backend | Strengths |
|----------|------------|-------------------|----------------|
| Shogun NoDom | Lightweight | GunDB (P2P) | Reactivity + Distributed Storage |
| React | ~40kb | No | Rich ecosystem, Virtual DOM |
| Alpine.js | ~7.1kb | No | Minimalist, works with existing HTML |
| Solid.js | ~7kb | No | Fine-grained reactivity, high performance |

## ⚙️ **Core Concepts**

### 🔄 **Signal-based Reactivity**

Shogun NoDom uses a reactive system based on signals with persistent backup:

* 🧠 **Signals** - Reactive values that notify subscribers when they change and persist on GunDB.
* 🌀 **Effects** - Functions that automatically execute when signals change.
* 🧭 **Memo** - Helpers for storing the results of calculations based on reactive dependencies.
* 🔑 **Namespace** - Automatic namespaces to isolate user data.

## 🚀 **Installation**

```bash
# With npm
npm install shogun-nodom gun

# With yarn
yarn add shogun-nodom gun
```

Or include directly from CDN:

```html
<script src="https://cdn.jsdelivr.net/npm/gun/gun.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gun/sea.js"></script>
<script type="module">
  import { init, setSignal, setEffect, h } from 'https://cdn.jsdelivr.net/npm/shogun-nodom/nodom.js';
  // ...
</script>
```

## 📚 **Core API**

### Initialization

```js
import { init } from 'shogun-nodom';
import Gun from 'gun';
import 'gun/sea'; // For authentication

const gun = Gun(['http://localhost:8765/gun']);
init(gun);
```

### Reactivity

```js
import { setSignal, setEffect, setMemo } from 'shogun-nodom';

// Create a signal
const [getCount, setCount] = setSignal(0, { key: 'counter' });

// React to changes
setEffect(() => {
  console.log(`The counter is: ${getCount()}`);
});

// Memorize derived calculations
const getDoubleCount = setMemo(() => getCount() * 2);

// Modify the value
setCount(1);
setCount(prev => prev + 1);
```

### DOM Rendering

```js
import { h, Fragment } from 'shogun-nodom';

function Counter() {
  const [count, setCount] = setSignal(0, { key: 'counter' });
  
  return h('div', {},
    h('h1', {}, () => `Counter: ${count()}`),
    h('button', { 
      onclick: () => setCount(count() + 1) 
    }, 'Increment')
  );
}

document.body.appendChild(Counter());
```

### Authentication

```js
import { auth, logout, getNamespace } from 'shogun-nodom';

// Login or registration
async function login() {
  try {
    // The third parameter (true) creates the user if it doesn't exist
    await auth('username', 'password', true);
    console.log(`Namespace: ${getNamespace()}`);
  } catch (err) {
    console.error('Authentication error:', err);
  }
}

// Logout
function handleLogout() {
  logout();
  console.log('User logged out');
}
```

## 🔑 **Namespace System**

Shogun NoDom includes a powerful namespace system that provides automatic data isolation for authenticated users.

### How Namespaces Work

1. **Automatic generation**: When a user authenticates, a unique namespace is generated based on their public key.
2. **Data isolation**: Data is automatically saved under the user's namespace, creating a "private space" for user data.
3. **Contextual propagation**: Namespaces are automatically propagated to child elements, allowing entire UI branches with isolated data.

### Using Namespaces

```js
import { h, auth, getNamespace, setSignal } from 'shogun-nodom';

// After authentication
await auth('username', 'password');
const namespace = getNamespace(); // e.g.: ~ABCDEF1234567890

// Method 1: Element-level namespace (propagated to children)
function PrivateForm() {
  return h('div', { namespace },
    h('input', { name: 'private-note' }), // Automatically uses the namespace
    h('div', {}, () => {
      // This signal automatically reads/writes to ~ABCDEF1234567890.private-note
      const [getNote] = setSignal('', { key: 'private-note' });
      return `Note: ${getNote()}`;
    })
  );
}

// Method 2: Signal-level namespace
function MixedForm() {
  // Private data (with namespace)
  const [getPrivate] = setSignal('', { key: 'user-data' }); // Uses namespace
  
  // Public data (without namespace)
  const [getPublic] = setSignal('', { key: 'public-data', element: document.createElement('div') });
  
  return h('div', {},
    h('h3', {}, 'Mixed Form'),
    h('div', {}, () => `Private data: ${getPrivate()}`),
    h('div', {}, () => `Public data: ${getPublic()}`)
  );
}
```

### Advanced Namespace Management

```js
import { setNamespace, withNamespace } from 'shogun-nodom';

// Manually set a namespace
setNamespace('~customnamespace');

// Create a component with a specific namespace
const PrivateComponent = withNamespace('~customnamespace', 
  h('div', {}, 
    h('input', { name: 'special-input' })
  )
);

// Nested namespaces
function NestedNamespaces() {
  return h('div', { namespace: '~user1' },
    h('div', {}, 'User 1 Area'),
    h('div', { namespace: '~user2' },
      h('input', { name: 'shared-note' }) // Uses namespace ~user2
    )
  );
}
```

### Namespace Context

Namespaces in Shogun NoDom work through a context system:

1. **DOM traversal**: When accessing a signal, the system searches for the namespace attribute by traversing up the DOM tree.
2. **Context stack**: During rendering, a stack of active namespaces is maintained to handle nesting.
3. **Priority**: The namespace is selected with this priority:
   - Namespace attribute in the element or its ancestors
   - Current rendering context
   - Global namespace of the authenticated user

## 🌐 **Node.js Version**

Shogun NoDom also includes a Node.js version that supports reactivity and authentication in server environments.

```js
// Node.js Server
import Gun from 'gun';
import { init, setSignal, auth } from 'shogun-nodom/nodom-node.js';

const gun = new Gun();
init(gun);

// Usable for server-side reactivity
const [getConfig, setConfig] = setSignal({ port: 8080 }, { key: 'server-config' });

// Authentication also available server-side
await auth('server', 'password');
```

## 🔍 **Complete Examples**

### Simple Counter

```html
<!DOCTYPE html>
<html>
<head>
  <title>Shogun NoDom Counter</title>
</head>
<body>
  <div id="app"></div>
  
  <script src="https://cdn.jsdelivr.net/npm/gun/gun.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/gun/sea.js"></script>
  <script type="module">
    import { init, setSignal, setEffect, h } from './nodom.js';
    
    const gun = Gun(['http://localhost:8765/gun']);
    init(gun);
    
    function Counter() {
      const [count, setCount] = setSignal(0, { key: 'counter' });
      
      return h('div', {},
        h('h1', {}, () => `Counter: ${count()}`),
        h('button', { 
          onclick: () => setCount(count() + 1) 
        }, 'Increment')
      );
    }
    
    document.getElementById('app').appendChild(Counter());
  </script>
</body>
</html>
```

### App with Authentication and Namespace

```html
<!DOCTYPE html>
<html>
<head>
  <title>Shogun NoDom - Private Notes</title>
</head>
<body>
  <div id="auth">
    <input id="username" placeholder="Username">
    <input id="password" type="password" placeholder="Password">
    <button id="loginBtn">Login</button>
  </div>
  <div id="app"></div>
  
  <script src="https://cdn.jsdelivr.net/npm/gun/gun.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/gun/sea.js"></script>
  <script type="module">
    import { init, auth, getNamespace, setSignal, h } from './nodom.js';
    
    const gun = Gun(['http://localhost:8765/gun']);
    init(gun);
    
    document.getElementById('loginBtn').addEventListener('click', async () => {
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      
      try {
        await auth(username, password, true);
        renderApp();
      } catch (err) {
        alert(`Error: ${err}`);
      }
    });
    
    function renderApp() {
      const namespace = getNamespace();
      
      function Notes() {
        return h('div', { namespace },
          h('h2', {}, `Notes by ${document.getElementById('username').value}`),
          h('textarea', { name: 'notes', placeholder: 'Write here...' }),
          h('div', {}, () => {
            const [getNotes] = setSignal('', { key: 'notes' });
            return `Saved content: ${getNotes()}`;
          })
        );
      }
      
      const app = document.getElementById('app');
      app.innerHTML = '';
      app.appendChild(Notes());
    }
  </script>
</body>
</html>
```

## 🤝 **Contributing**

Contributions are welcome! Feel free to:

1. Report bugs or issues
2. Propose new features
3. Submit pull requests

## �� **License**

MIT
