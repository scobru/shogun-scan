// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Mock fetch API
global.fetch = jest.fn().mockImplementation(() => 
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve([]),
    status: 200,
    statusText: 'OK'
  })
);

// Create a mock for the browser metadata
const mockMetaElement = document.createElement('meta');
mockMetaElement.setAttribute('name', 'api-server');
mockMetaElement.setAttribute('content', 'http://localhost:3001');
mockMetaElement.setAttribute('data-dev-proxy', '/api');
document.head.appendChild(mockMetaElement);

// Reset mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});
