# Shogun NoDom Examples

This folder contains practical examples to learn how to use Shogun NoDom in its different versions and scenarios.

## Browser Examples

### 1. [basic.html](./basic.html)
A minimal example of Shogun NoDom that shows how signals and effects work in a simple web application.

**Features:**
- Basic Gun initialization
- Creation of reactive signals
- Automatic UI updates

### 2. [namespace.html](./namespace.html)
A more complex example that demonstrates the use of namespaces to isolate user data.

**Features:**
- User authentication
- Automatic namespace
- Forms with isolated data fields
- Data persistence between sessions

## Node.js Examples

### 1. [node-basic.js](./node-basic.js)
Basic example of using nodom-node.js that demonstrates server-side reactivity.

**Features:**
- Gun initialization in Node.js
- Creation of reactive signals
- Effects that respond to changes

**Execution:**
```bash
node node-basic.js
```

### 2. [node-namespace.js](./node-namespace.js)
Example showing authentication and namespace management in a Node.js environment.

**Features:**
- User authentication
- Automatic namespace management
- Custom namespace contexts
- Data persistence

**Important note:**
The example also shows the security limitations of Gun/SEA when trying to write to a custom namespace without having the appropriate credentials. A "Signature did not match" error is expected and is explained in the comments.

**Execution:**
```bash
node node-namespace.js <username> <password>
```

### 3. [nodom-standalone.js](./nodom-standalone.js)
Example that demonstrates using Shogun NoDom as a standalone reactive library, without GunDB integration.

**Features:**
- Using signals without persistence
- Pure reactive effects
- Derived values with setMemo
- Dynamic creation of reactive objects
- No dependency on Gun or authentication

**Execution:**
```bash
node nodom-standalone.js
```

## General Structure

All examples follow these common steps:

1. **Initialization**: Gun and Shogun NoDom configuration (except nodom-standalone)
2. **Signal Creation**: Definition of reactive data
3. **Effect Creation**: Automatic response to changes
4. **Data Manipulation**: Updating signal values

## Tips

- Make sure you have Gun installed: `npm install gun` (not needed for nodom-standalone)
- For browser examples, you can use a static server like `serve` or `http-server`
- For Node.js examples, you can run them directly with Node.js
- Examples with Gun automatically start a local server for data synchronization 