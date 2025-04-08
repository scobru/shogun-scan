const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  console.log('Setting up API proxy to http://localhost:3001');
  
  const apiProxy = createProxyMiddleware({
    target: 'http://localhost:3001',
    changeOrigin: true,
    pathRewrite: {
      '^/api': '/api', // No rewrite needed as paths match
    },
    logLevel: 'debug',
    onProxyReq: (proxyReq, req, res) => {
      console.log(`[Proxy] Request to: ${req.method} ${req.path}`);
    },
    onProxyRes: (proxyRes, req, res) => {
      console.log(`[Proxy] Response from: ${req.method} ${req.path} - Status: ${proxyRes.statusCode}`);
    },
    onError: (err, req, res) => {
      console.error(`[Proxy] Error proxying request: ${req.method} ${req.path}`, err);
    }
  });
  
  app.use('/api', apiProxy);
  
  console.log('Proxy middleware set up successfully');
}; 