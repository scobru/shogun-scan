# Shogun Scan

[https://shogun-scan.vercel.app/](Website)

**Shogun Scan** is a modern web application for exploring and managing GunDB databases in real-time. Built with React and Vite, it provides an intuitive interface for navigating, viewing, and modifying decentralized data.

## 🚀 Key Features

### 🔍 **Data Exploration**
- **Tree navigation**: Explore GunDB data structure with an intuitive interface
- **Breadcrumb navigation**: Track current path and easily navigate between levels
- **Typed visualization**: Automatically identify data types (string, number, object, array, null)
- **Search and filters**: Quickly find the data you're looking for

### ✏️ **Data Editing**
- **Integrated JSON editor**: Edit data with syntax highlighting and validation
- **CRUD operations**: Create, read, update, and delete database nodes
- **Real-time validation**: Check JSON syntax before saving
- **Automatic backup**: Automatically save changes locally

### 🌐 **Relay Management**
- **Automatic discovery**: Automatically find available GunDB relays
- **Connectivity testing**: Verify relay status and performance
- **Peer management**: Configure and manage multiple peer connections
- **Status monitoring**: View connection status in real-time

### 🎨 **User Interface**
- **Modern design**: Clean and responsive interface
- **Dark/light theme**: Support for user preferences
- **Reusable components**: Modular and maintainable architecture
- **Accessibility**: WCAG standards compliant

## 📦 Installation

### Prerequisites
- Node.js (version 16 or higher)
- npm or yarn

### Local Setup

```bash
# Clone the repository
git clone <repository-url>
cd shogun-Scan

# Install dependencies
npm install
# or
yarn install

# Start development server
npm run dev
# or
yarn dev
```

The application will be available at `http://localhost:5173`

### Production Build

```bash
# Create optimized build
npm run build
# or
yarn build

# Preview the build
npm run preview
# or
yarn preview
```

## 🏗️ Architecture

### Project Structure

```
shogun-Scan/
├── src/
│   ├── api/                    # API management and GunDB context
│   │   ├── gunContext.jsx      # React provider for GunDB
│   │   └── gunHelpers.js       # Utilities for GunDB operations
│   ├── com/                    # React components
│   │   ├── DataBrowser.jsx     # Data navigation and exploration
│   │   ├── DataEditor.jsx      # Editor for data modifications
│   │   ├── RelayDiscovery.jsx  # Relay discovery and management
│   │   ├── Help.jsx            # Help system
│   │   ├── JSONItem.jsx        # JSON element visualization
│   │   ├── DataElement.jsx     # Component for individual elements
│   │   └── GunElement.jsx      # Wrapper for GunDB elements
│   ├── img/                    # Image resources
│   ├── App.jsx                 # Main component
│   ├── App.css                 # Global styles
│   ├── main.jsx               # Application entry point
│   └── db.js                  # Database configuration
├── public/                     # Static files
├── package.json               # Dependencies and scripts
└── README.md                  # Documentation
```

### Main Components

#### **GunProvider** (`src/api/gunContext.jsx`)
React provider that manages the GunDB connection and makes it available to all child components.

```javascript
// Provider usage
<GunProvider peers={['http://localhost:8765/gun']}>
  <App />
</GunProvider>
```

#### **DataBrowser** (`src/com/DataBrowser.jsx`)
Component for exploring GunDB data structure with features:
- Hierarchical navigation
- Breadcrumb
- Node deletion
- Typed visualization

#### **DataEditor** (`src/com/DataEditor.jsx`)
Advanced editor for data modification with:
- JSON syntax highlighting
- Real-time validation
- Change preview
- Error handling

#### **RelayDiscovery** (`src/com/RelayDiscovery.jsx`)
Relay discovery and management system with:
- Automatic scanning of common relays
- Connectivity testing
- Custom peer management
- Performance monitoring

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
# Default URLs for GunDB peers
VITE_DEFAULT_PEERS=http://localhost:8765/gun,https://gun-manhattan.herokuapp.com/gun

# Default root path for exploration
VITE_DEFAULT_ROOT_PATH=data

# Development configurations
VITE_DEV_MODE=true
```

### GunDB Configuration

The `src/api/gunContext.jsx` file manages GunDB configuration:

```javascript
const gun = Gun({
  peers: ['http://localhost:8765/gun'], // Default peers
  localStorage: false,                   // Disable local storage
  radisk: false                         // Disable disk storage
})
```

### Theme Customization

Modify CSS variables in `src/App.css`:

```css
:root {
  --primary: #3b82f6;
  --primary-light: #dbeafe;
  --background: #ffffff;
  --text-primary: #1f2937;
  --text-secondary: #6b7280;
  /* ... other variables */
}
```

## 📚 Usage

### Connecting to GunDB

1. **Configure Peers**: Enter GunDB peer URLs in the "Gun Peer URLs" field
2. **Set Root Path**: Define the starting path for exploration
3. **Verify Connection**: Check the status indicator to confirm connection

### Data Exploration

1. **Navigate**: Click on nodes to explore the data structure
2. **Breadcrumb**: Use the navigation bar to return to previous levels
3. **Filter**: Use search controls to find specific data
4. **Visualize**: Observe data types and values in readable format

### Data Modification

1. **Select Node**: Click on an element to open the editor
2. **Edit JSON**: Use the editor with syntax highlighting
3. **Validate**: Check JSON validity before saving
4. **Save**: Apply changes to the database

### Relay Management

1. **Discover**: Use the "Discover" tab to find available relays
2. **Test**: Verify connectivity and performance of relays
3. **Add**: Incorporate working relays into configuration
4. **Monitor**: Observe connection status in real-time

## 🔌 API and Hooks

### useGun Hook

Custom hook to access the GunDB instance:

```javascript
import { useGun } from './api/gunContext'

function MyComponent() {
  const gun = useGun()
  
  useEffect(() => {
    if (gun) {
      gun.get('myData').on(data => {
        console.log('Data received:', data)
      })
    }
  }, [gun])
}
```

### GunDB Utilities

Helper functions for common operations:

```javascript
import { getNode } from './api/gunHelpers'

// Get a specific node
const node = getNode(gun, 'path/to/data')

// Listen to changes
node.on(data => {
  console.log('Data updated:', data)
})
```

## 🧪 Testing

### Development Testing

```bash
# Start local test server
npm run dev

# Test relay connections
# Use the "Discover" tab in the application
```

### Production Testing

```bash
# Build and test
npm run build
npm run preview

# Deployment testing
npm run deploy
```

## 🚀 Deployment

### GitHub Pages

```bash
# Automatic deployment to GitHub Pages
npm run deploy
```

### Custom Server

```bash
# Build for production
npm run build

# Files will be in dist/
# Serve the dist/ folder with your web server
```

### Docker

```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "preview"]
```

## 🛠️ Development

### Adding New Components

1. Create the component in `src/com/`
2. Import and use in parent component
3. Add styles if necessary
4. Document usage

### Extending GunDB Functionality

1. Modify `src/api/gunHelpers.js` for new utilities
2. Update context if necessary
3. Test new functionality
4. Update documentation

### Customizing the UI

1. Modify CSS variables in `App.css`
2. Update components for new styles
3. Test responsiveness
4. Verify accessibility

## 🐛 Troubleshooting

### Connection Issues

**Problem**: Cannot connect to GunDB peers
**Solution**: 
- Verify that peer URLs are correct
- Check internet connection
- Try alternative peers from the discovery list

### JSON Validation Errors

**Problem**: Editor shows JSON syntax errors
**Solution**:
- Check brackets and commas
- Verify strings are quoted
- Use preview to identify errors

### Slow Performance

**Problem**: Application is slow with large datasets
**Solution**:
- Use filters to limit displayed data
- Navigate to more specific levels
- Consider pagination for large collections

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/new-feature`)
3. Commit your changes (`git commit -am 'Add new feature'`)
4. Push to the branch (`git push origin feature/new-feature`)
5. Create a Pull Request

## 📄 License

This project is distributed under the MIT license. See the `LICENSE` file for details.

## 🙏 Acknowledgments

- **GunDB**: For the decentralized database
- **React**: For the UI framework
- **Vite**: For the fast build tool
- **Community**: For feedback and contributions

## 📞 Support

For support and questions:
- Open an issue on GitHub
- Consult the GunDB documentation
- Participate in community discussions

---

**Shogun Scan** - Explore the future of decentralized databases 🚀