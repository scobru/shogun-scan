import { IGunInstance } from 'gun';
import fs from 'fs-extra';
import path from 'path';

/**
 * Creates a NextJS hook for using GunDB models
 * 
 * @param modelName The name of the model to create a hook for
 * @param outputPath The path where to save the hook
 */
export async function createNextJSHook(modelName: string, outputPath: string = './hooks/shogun') {
  const hookContent = `
import { useEffect, useState } from 'react';
import Gun from 'gun';
import 'gun/sea';
import { ${modelName} } from '../../models/${modelName}';

// This is a custom hook for using ${modelName} model with React
export function use${modelName}s() {
  const [${modelName.toLowerCase()}s, set${modelName}s] = useState<${modelName}[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Initialize Gun instance
    const gun = Gun();
    ${modelName}.setGunInstance(gun);
    
    const items: ${modelName}[] = [];
    
    // Subscribe to changes
    ${modelName}.all((item) => {
      items.push(item);
      set${modelName}s([...items]);
      setLoading(false);
    });
    
    return () => {
      // Cleanup (if needed)
    };
  }, []);
  
  return { ${modelName.toLowerCase()}s, loading };
}

// Get a single ${modelName} by ID
export function use${modelName}(id: string) {
  const [${modelName.toLowerCase()}, set${modelName}] = useState<${modelName} | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (!id) return;
    
    // Initialize Gun instance
    const gun = Gun();
    ${modelName}.setGunInstance(gun);
    
    async function load${modelName}() {
      const item = await ${modelName}.find(id);
      set${modelName}(item);
      setLoading(false);
    }
    
    load${modelName}();
  }, [id]);
  
  return { ${modelName.toLowerCase()}, loading };
}`;

  await fs.ensureDir(path.dirname(outputPath));
  await fs.writeFile(
    path.join(outputPath, `use${modelName}.ts`), 
    hookContent
  );
  
  console.log(`✓ Created NextJS hook: ${path.join(outputPath, `use${modelName}.ts`)}`);
}

/**
 * Creates a NextJS integration provider that initializes GunDB
 * 
 * @param outputPath The path where to save the provider
 */
export async function createNextJSProvider(outputPath: string = './components/shogun') {
  const providerContent = `
import { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import Gun, { IGunInstance } from 'gun';
import 'gun/sea';

// You can add more Gun plugins as needed
import 'gun/lib/then';

// Context for Gun
interface GunContextType {
  gun: IGunInstance | null;
  user: any;
  isAuth: boolean;
  login: (username: string, password: string) => Promise<any>;
  signup: (username: string, password: string) => Promise<any>;
  logout: () => void;
}

const GunContext = createContext<GunContextType>({
  gun: null,
  user: null,
  isAuth: false,
  login: async () => {},
  signup: async () => {},
  logout: () => {},
});

export function GunProvider({ children, peers = [] }: { children: ReactNode, peers?: string[] }) {
  const [gun, setGun] = useState<IGunInstance | null>(null);
  const [user, setUser] = useState<any>(null);
  const [isAuth, setIsAuth] = useState(false);

  useEffect(() => {
    // Initialize Gun
    const gunInstance = Gun({
      peers: peers.length ? peers : ['http://localhost:8765/gun'],
      localStorage: false,
    });
    
    setGun(gunInstance);
    setUser(gunInstance.user().recall({ sessionStorage: true }));
    
    return () => {
      // Cleanup if needed
    };
  }, []);

  // Login function
  const login = async (username: string, password: string) => {
    if (!gun) return null;
    
    return new Promise((resolve, reject) => {
      gun.user().auth(username, password, (ack: any) => {
        if (ack.err) {
          reject(ack.err);
        } else {
          setUser(gun.user());
          setIsAuth(true);
          resolve(ack);
        }
      });
    });
  };
  
  // Signup function
  const signup = async (username: string, password: string) => {
    if (!gun) return null;
    
    return new Promise((resolve, reject) => {
      gun.user().create(username, password, (ack: any) => {
        if (ack.err) {
          reject(ack.err);
        } else {
          resolve(ack);
        }
      });
    });
  };
  
  // Logout function
  const logout = () => {
    if (!gun) return;
    gun.user().leave();
    setIsAuth(false);
    setUser(null);
  };

  return (
    <GunContext.Provider value={{ gun, user, isAuth, login, signup, logout }}>
      {children}
    </GunContext.Provider>
  );
}

// Custom hook to use Gun
export function useGun() {
  return useContext(GunContext);
}`;

  await fs.ensureDir(outputPath);
  await fs.writeFile(
    path.join(outputPath, 'GunProvider.tsx'), 
    providerContent
  );
  
  console.log(`✓ Created NextJS Gun Provider: ${path.join(outputPath, 'GunProvider.tsx')}`);
}

/**
 * Creates sample Next.js page that demonstrates usage of a GunDB model
 * 
 * @param modelName The name of the model to use in the page
 * @param outputPath The path where to save the page
 */
export async function createNextJSPage(modelName: string, outputPath: string = './pages/shogun') {
  // Determine if we should use App Router or Pages Router
  const useAppRouter = await detectAppRouter(outputPath);
  
  if (useAppRouter) {
    // Create page for App Router (Next.js 13+)
    await createAppRouterPage(modelName, outputPath);
  } else {
    // Create page for Pages Router (Legacy)
    await createPagesRouterPage(modelName, outputPath);
  }
}

/**
 * Detects if the project is using App Router (Next.js 13+)
 */
async function detectAppRouter(outputPath: string): Promise<boolean> {
  // Extract the base path (packages/nextjs)
  const basePath = outputPath.split('/pages')[0].split('/shogun')[0];
  
  // Check if app directory exists
  const appDirExists = await fs.pathExists(path.join(basePath, 'app'));
  
  return appDirExists;
}

/**
 * Creates a page for the App Router (Next.js 13+)
 */
async function createAppRouterPage(modelName: string, outputPath: string) {
  // For app router, we need to create page in app/shogun/[model] directory
  // Extract the base path (packages/nextjs)
  const basePath = outputPath.split('/pages')[0].split('/shogun')[0];
  
  // Create the app/shogun directory path
  const appShogunPath = path.join(basePath, 'app/shogun');
  
  // Create the model directory path (lowercase)
  const modelDirPath = path.join(appShogunPath, modelName.toLowerCase());
  
  // Ensure directories exist
  await fs.ensureDir(modelDirPath);
  
  // Client component content
  const clientContent = `"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useGun } from '../../../components/shogun/GunProvider';
import { use${modelName}s } from '../../../hooks/shogun/use${modelName}';
import { ${modelName} } from '../../../models/${modelName}';

export default function ${modelName}Client() {
  const { gun } = useGun();
  const { ${modelName.toLowerCase()}s, loading } = use${modelName}s();
  const [formData, setFormData] = useState<{[key: string]: any}>({});
  
  // Set Gun instance for the model
  if (gun) {
    ${modelName}.setGunInstance(gun);
  }
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const newItem = new ${modelName}(formData);
      await newItem.save();
      setFormData({});
    } catch (error) {
      console.error('Error saving ${modelName}:', error);
    }
  };
  
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">${modelName} Manager</h1>
        <Link href="/debug/gundb" className="btn btn-sm btn-secondary">
          GunDB Debug
        </Link>
      </div>
      
      {loading ? (
        <div className="w-full flex justify-center">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : (
        <>
          {/* Form */}
          <div className="card bg-base-200 shadow-xl mb-8">
            <div className="card-body">
              <h2 className="card-title">Add new ${modelName}</h2>
              
              <form onSubmit={handleSubmit}>
                {Object.keys(${modelName.toLowerCase()}s[0]?.attrs || {}).map(field => (
                  field !== '_soul' && (
                    <div className="form-control mb-4" key={field}>
                      <label className="label">
                        <span className="label-text">{field.charAt(0).toUpperCase() + field.slice(1)}</span>
                      </label>
                      <input
                        type="text"
                        name={field}
                        value={formData[field] || ''}
                        onChange={handleChange}
                        className="input input-bordered w-full"
                        placeholder={\`Enter \${field}\`}
                      />
                    </div>
                  )
                ))}
                
                <div className="card-actions justify-end">
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                  >
                    Save
                  </button>
                </div>
              </form>
            </div>
          </div>
          
          {/* List */}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {${modelName.toLowerCase()}s.length === 0 ? (
              <div className="col-span-full text-center py-10">
                <p className="text-lg">No ${modelName.toLowerCase()}s available. Add one!</p>
              </div>
            ) : (
              ${modelName.toLowerCase()}s.map((item, index) => (
                <div key={index} className="card bg-base-100 shadow-xl">
                  <div className="card-body">
                    {Object.entries(item.attrs).map(([key, value]) => (
                      key !== '_soul' && (
                        <p key={key}>
                          <strong>{key.charAt(0).toUpperCase() + key.slice(1)}:</strong> {String(value)}
                        </p>
                      )
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}`;

  // Main page component
  const pageContent = `import { Metadata } from "next";
import ${modelName}Client from "./${modelName}Client";
import { getMetadata } from "~~/utils/scaffold-eth/getMetadata";

export const metadata: Metadata = getMetadata({
  title: "${modelName} Manager",
  description: "Manage ${modelName} data with GunDB integration",
});

export default function ${modelName}Page() {
  return <${modelName}Client />;
}`;
  
  // Create client component file
  await fs.writeFile(
    path.join(modelDirPath, `${modelName}Client.tsx`), 
    clientContent
  );
  
  // Create page component file
  await fs.writeFile(
    path.join(modelDirPath, 'page.tsx'), 
    pageContent
  );
  
  // Create top-level shogun page if it doesn't exist
  await createShogunIndexPage(appShogunPath, modelName);
  
  console.log(`✓ Created NextJS page (App Router): ${path.join(modelDirPath, 'page.tsx')}`);
  console.log(`✓ Created NextJS client component: ${path.join(modelDirPath, `${modelName}Client.tsx`)}`);
}

/**
 * Creates the index page for the /shogun route
 */
async function createShogunIndexPage(shogunPath: string, modelName: string) {
  const indexPath = path.join(shogunPath, 'page.tsx');
  
  // Skip if index page already exists
  if (await fs.pathExists(indexPath)) {
    return;
  }
  
  const indexContent = `import Link from "next/link";
import { Metadata } from "next";
import { getMetadata } from "~~/utils/scaffold-eth/getMetadata";

export const metadata: Metadata = getMetadata({
  title: "Shogun - GunDB Integration",
  description: "Explore GunDB-powered models with Shogun",
});

export default function ShogunIndexPage() {
  return (
    <div className="flex flex-col gap-y-6 lg:gap-y-8 py-8 lg:py-12 justify-center items-center">
      <h1 className="text-4xl font-bold">Shogun GunDB Models</h1>
      <p className="text-center text-lg">
        Explore your GunDB-powered models and data
      </p>
      
      <div className="flex flex-col gap-4 mt-8">
        <Link href="/shogun/${modelName.toLowerCase()}" className="btn btn-primary btn-lg">
          ${modelName} Manager
        </Link>
        
        <Link href="/debug/gundb" className="btn btn-secondary">
          GunDB Debug
        </Link>
      </div>
    </div>
  );
}`;
  
  await fs.writeFile(indexPath, indexContent);
  console.log(`✓ Created NextJS Shogun index page: ${indexPath}`);
}

/**
 * Creates a page for the Pages Router (Legacy Next.js)
 */
async function createPagesRouterPage(modelName: string, outputPath: string) {
  const pageContent = `
import { useState } from 'react';
import Link from 'next/link';
import { useGun } from '../../components/shogun/GunProvider';
import { use${modelName}s, use${modelName} } from '../../hooks/shogun/use${modelName}';
import { ${modelName} } from '../../models/${modelName}';

export default function ${modelName}Page() {
  const { gun } = useGun();
  const { ${modelName.toLowerCase()}s, loading } = use${modelName}s();
  const [formData, setFormData] = useState<{[key: string]: any}>({});
  
  // Set Gun instance for the model
  if (gun) {
    ${modelName}.setGunInstance(gun);
  }
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const newItem = new ${modelName}(formData);
      await newItem.save();
      setFormData({});
    } catch (error) {
      console.error('Error saving ${modelName}:', error);
    }
  };
  
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">${modelName} Manager</h1>
        <Link href="/debug/gundb">
          <a className="btn btn-sm btn-secondary">GunDB Debug</a>
        </Link>
      </div>
      
      {loading ? (
        <div className="w-full flex justify-center">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : (
        <>
          {/* Form */}
          <div className="card bg-base-200 shadow-xl mb-8">
            <div className="card-body">
              <h2 className="card-title">Add new ${modelName}</h2>
              
              <form onSubmit={handleSubmit}>
                {Object.keys(${modelName.toLowerCase()}s[0]?.attrs || {}).map(field => (
                  field !== '_soul' && (
                    <div className="form-control mb-4" key={field}>
                      <label className="label">
                        <span className="label-text">{field.charAt(0).toUpperCase() + field.slice(1)}</span>
                      </label>
                      <input
                        type="text"
                        name={field}
                        value={formData[field] || ''}
                        onChange={handleChange}
                        className="input input-bordered w-full"
                        placeholder={\`Enter \${field}\`}
                      />
                    </div>
                  )
                ))}
                
                <div className="card-actions justify-end">
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                  >
                    Save
                  </button>
                </div>
              </form>
            </div>
          </div>
          
          {/* List */}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {${modelName.toLowerCase()}s.length === 0 ? (
              <div className="col-span-full text-center py-10">
                <p className="text-lg">No ${modelName.toLowerCase()}s available. Add one!</p>
              </div>
            ) : (
              ${modelName.toLowerCase()}s.map((item, index) => (
                <div key={index} className="card bg-base-100 shadow-xl">
                  <div className="card-body">
                    {Object.entries(item.attrs).map(([key, value]) => (
                      key !== '_soul' && (
                        <p key={key}>
                          <strong>{key.charAt(0).toUpperCase() + key.slice(1)}:</strong> {String(value)}
                        </p>
                      )
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}`;

  await fs.ensureDir(path.dirname(outputPath));
  await fs.writeFile(
    path.join(outputPath, `${modelName.toLowerCase()}.tsx`), 
    pageContent
  );
  
  console.log(`✓ Created NextJS page (Pages Router): ${path.join(outputPath, `${modelName.toLowerCase()}.tsx`)}`);
}

/**
 * Integration with Hardhat for Web3 functionality
 * Creates utility to connect Ethereum with GunDB
 */
export async function createHardhatIntegration(outputPath: string = './utils/web3') {
  const content = `
import { IGunInstance } from 'gun';
import { ethers } from 'ethers';

export async function signMessageWithWallet(message: string, provider: ethers.providers.Web3Provider) {
  const signer = provider.getSigner();
  const address = await signer.getAddress();
  return {
    message,
    signature: await signer.signMessage(message),
    address
  };
}

export function verifySignedMessage(message: string, signature: string) {
  try {
    const address = ethers.utils.verifyMessage(message, signature);
    return { valid: true, address };
  } catch (error) {
    return { valid: false, error };
  }
}

export async function attachWeb3ToGun(gun: IGunInstance, provider: ethers.providers.Web3Provider) {
  // Get Ethereum address
  const signer = provider.getSigner();
  const address = await signer.getAddress();
  
  // Add web3 utilities to Gun instance
  const gunWithWeb3 = gun as IGunInstance & { web3?: any };
  
  gunWithWeb3.web3 = {
    address,
    provider,
    signer,
    // Add a sign method to Gun
    sign: async (data: any) => {
      const message = JSON.stringify(data);
      return signMessageWithWallet(message, provider);
    },
    // Verify a signature
    verify: (message: string, signature: string) => {
      return verifySignedMessage(message, signature);
    }
  };
  
  return gunWithWeb3;
}

// Connect a GunDB model to Ethereum identity
export function addWeb3Auth(ModelClass: any) {
  ModelClass.authenticate = async function(gun: IGunInstance, provider: ethers.providers.Web3Provider) {
    const gunWithWeb3 = await attachWeb3ToGun(gun, provider);
    this.setGunInstance(gunWithWeb3);
    return gunWithWeb3;
  };
  
  return ModelClass;
}`;

  await fs.ensureDir(outputPath);
  await fs.writeFile(
    path.join(outputPath, 'gunWeb3.ts'), 
    content
  );
  
  console.log(`✓ Created Hardhat integration: ${path.join(outputPath, 'gunWeb3.ts')}`);
}

/**
 * Updates the Generator to include NextJS and Hardhat integration
 */
export async function enhanceGenerator(modelName: string, fields: string[], options: {
  nextjs?: boolean,
  hardhat?: boolean,
  outputDir?: string
}) {
  // Default paths
  const nextjsHooksPath = options.outputDir ? 
    path.join(options.outputDir, 'hooks/shogun') : 
    './hooks/shogun';
    
  const nextjsComponentsPath = options.outputDir ? 
    path.join(options.outputDir, 'components/shogun') : 
    './components/shogun';
    
  const nextjsPagesPath = options.outputDir ? 
    path.join(options.outputDir, 'pages/shogun') : 
    './pages/shogun';
    
  const hardhatUtilsPath = options.outputDir ? 
    path.join(options.outputDir, 'utils/web3') : 
    './utils/web3';
  
  // Generate core model and seed
  // (Your existing generator would be called here)
  
  // Create NextJS integration
  if (options.nextjs) {
    await createNextJSHook(modelName, nextjsHooksPath);
    await createNextJSProvider(nextjsComponentsPath);
    await createNextJSPage(modelName, nextjsPagesPath);
  }
  
  // Create Hardhat integration
  if (options.hardhat) {
    await createHardhatIntegration(hardhatUtilsPath);
  }
} 