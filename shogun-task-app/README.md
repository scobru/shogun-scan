# Shogun Task App

A decentralized task management application built with Next.js and TypeScript, featuring secure user authentication, real-time task synchronization, and collaborative list management. Shogun Task App is part of the Shogun ecosystem, providing a privacy-focused alternative to traditional to-do applications.

![Shogun Task App Screenshot](docs/screenshot.png)

## About Shogun Task App

Shogun Task App leverages the Shogun Protocol and decentralized database technology to offer a unique task management experience:

- **Privacy-First**: Your task data is encrypted and stored in a decentralized manner
- **Real-Time Sync**: Changes synchronize instantly across devices
- **Collaborative**: Share task lists with trusted contacts
- **Offline Support**: Continue working even when offline
- **Open Source**: Community-driven development and transparency

## Features

- [x] Authentication
  - Username/Password login with Shogun Protocol
  - Secure key management
  - Session persistence
- [x] Task Management
  - [x] Create, edit, and delete tasks
  - [x] Mark tasks as completed
  - [x] Task prioritization
  - [x] Due dates and reminders
- [x] List Organization
  - [x] Create multiple task lists
  - [x] Switch between lists
  - [x] List sharing capabilities
  - [x] List deletion with confirmation
- [x] User Experience
  - [x] Clean, intuitive interface
  - [x] Responsive design for all devices
  - [x] Dark/light mode support
  - [x] Keyboard shortcuts
- [x] Synchronization
  - [x] Real-time updates across devices
  - [x] Offline-first capability
  - [x] Conflict resolution

## Tech Stack

- **Frontend Framework**: [Next.js](https://nextjs.org/) - React framework with enhanced features
- **Language**: [TypeScript](https://www.typescriptlang.org/) - Typed JavaScript for better development experience
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) with [shadcn/ui](https://ui.shadcn.com/) components
- **Authentication**: [Shogun Protocol](https://github.com/scobru/shogun-core) - Web3 authentication and identity management
- **Database**: [GunDB](https://gun.eco/) - Decentralized graph database
- **UI Components**: [Radix UI](https://www.radix-ui.com/) - Unstyled, accessible components
- **Form Handling**: [React Hook Form](https://react-hook-form.com/) with [Zod](https://zod.dev/) validation

## Integration with Shogun Ecosystem

Shogun Task App integrates with other Shogun components:

- **Shogun Core**: Provides core authentication and cryptographic functions
- **Shogun Button**: React component for simplified Shogun authentication
- **GunDB**: Decentralized database for secure data storage

## Project Structure

```
shogun-task-app/
├── app/               # Next.js app directory
│   ├── layout.tsx     # Root layout component
│   ├── page.tsx       # Main application page
│   └── globals.css    # Global styles
├── components/        # Reusable UI components
│   ├── ui/            # Base UI components
│   ├── auth-form.tsx  # Authentication form
│   ├── task-list.tsx  # Task list component
│   └── ...            # Other components
├── lib/               # Utility libraries
│   ├── gun-context.tsx # GunDB context provider
│   └── utils.ts       # Utility functions
├── public/            # Static assets
└── styles/            # Additional styles
```

## Getting Started

### Prerequisites

- Node.js 18 or later
- npm or yarn

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/shogun-task-app.git
   cd shogun-task-app
   ```

2. Install dependencies
   ```bash
   npm install
   # or
   yarn
   ```

3. Start the development server
   ```bash
   npm run dev
   # or
   yarn dev
   ```

4. Open your browser and navigate to `http://localhost:3000`

## Development

The application follows a modern component-based architecture with these key characteristics:

- **Server Components**: Leveraging Next.js server and client components for optimal performance
- **Type Safety**: Comprehensive TypeScript typing for reliable development
- **Component Library**: Built on shadcn/ui for consistent design
- **Context API**: GunDB context provides database access throughout the application
- **Responsive Design**: Mobile-first interface for task management on any device

### Key Workflows

- **Authentication Flow**: Users authenticate securely using the Shogun Protocol
- **Task Creation**: Users can create tasks that are stored in the decentralized database
- **List Management**: Create, switch between, and organize multiple task lists
- **Task Interaction**: Complete, edit, or delete tasks with real-time updates

## Security Features

- Encrypted task data with Shogun Protocol security
- Authentication using secure cryptographic methods
- Decentralized storage minimizes data breach risks
- No central server storing user data
- Session management with secure key handling

## Contributing

Contributions to Shogun Task App are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- The Next.js and React teams for their excellent frameworks
- shadcn/ui for the component library foundation
- GunDB team for the decentralized database
- Shogun ecosystem developers for the protocol and core libraries 