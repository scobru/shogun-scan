/**
 * Utility to test API connections
 * This allows testing both direct and proxy connections to the API
 */

/**
 * Gets the API server URL from the meta tag
 * @returns Object with direct and proxy URLs
 */
const getApiUrls = (): { direct: string, proxy: string } => {
  const metaTag = document.querySelector('meta[name="api-server"]');
  
  // Default values if meta tag is not found
  let directUrl = 'http://localhost:3001/api';
  let proxyUrl = '/api';
  
  if (metaTag) {
    directUrl = metaTag.getAttribute('content') || directUrl;
    if (!directUrl.endsWith('/api')) {
      directUrl = `${directUrl}/api`;
    }
    
    proxyUrl = metaTag.getAttribute('data-dev-proxy') || proxyUrl;
  }
  
  return { direct: directUrl, proxy: proxyUrl };
};

/**
 * Tests API connections (both direct and through proxy)
 */
export const testAPIConnection = async (): Promise<void> => {
  console.log('Starting API connection test...');
  const { direct, proxy } = getApiUrls();
  
  // Test direct connection
  try {
    console.log(`Testing direct connection to: ${direct}/tracks`);
    const directResponse = await fetch(`${direct}/tracks`, { method: 'GET' });
    console.log(`Direct connection status: ${directResponse.status}`);
    
    if (directResponse.ok) {
      const data = await directResponse.json();
      console.log('Direct connection successful!', { status: directResponse.status, data });
    } else {
      console.error('Direct connection failed with status:', directResponse.status);
    }
  } catch (error) {
    console.error('Direct connection error:', error);
  }
  
  // Test proxy connection
  try {
    console.log(`Testing proxy connection to: ${proxy}/tracks`);
    const proxyResponse = await fetch(`${proxy}/tracks`, { method: 'GET' });
    console.log(`Proxy connection status: ${proxyResponse.status}`);
    
    if (proxyResponse.ok) {
      const data = await proxyResponse.json();
      console.log('Proxy connection successful!', { status: proxyResponse.status, data });
    } else {
      console.error('Proxy connection failed with status:', proxyResponse.status);
    }
  } catch (error) {
    console.error('Proxy connection error:', error);
  }
  
  console.log('API connection test complete!');
};

// Add it to the window for browser console access
if (typeof window !== 'undefined') {
  (window as any).testAPIConnection = testAPIConnection;
}

export default testAPIConnection; 