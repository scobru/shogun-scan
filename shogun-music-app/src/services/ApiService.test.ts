import ApiService from './ApiService';
import fallbackTracks from '../data/fallbackTracks';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('ApiService', () => {
  beforeEach(() => {
    // Reset mocks between tests
    jest.clearAllMocks();
  });

  describe('getTracks', () => {
    it('should return tracks when API call is successful', async () => {
      // Mock successful response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: '1', title: 'Test Track' }],
        status: 200,
        statusText: 'OK'
      });

      // Check server availability
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK'
      });

      const tracks = await ApiService.getTracks();
      
      expect(tracks).toEqual([{ id: '1', title: 'Test Track' }]);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should return fallback tracks when API call fails', async () => {
      // Mock failed response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      const tracks = await ApiService.getTracks();
      
      expect(tracks).toEqual(fallbackTracks);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should return fallback tracks when there is a network error', async () => {
      // Mock network error
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const tracks = await ApiService.getTracks();
      
      expect(tracks).toEqual(fallbackTracks);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('retryServerConnection', () => {
    it('should update server status when server becomes available', async () => {
      // Mock successful response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK'
      });

      const result = await ApiService.retryServerConnection();
      
      expect(result).toBe(true);
      expect(ApiService.getServerStatus()).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should update server status when server is unavailable', async () => {
      // Mock failed response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      const result = await ApiService.retryServerConnection();
      
      expect(result).toBe(false);
      expect(ApiService.getServerStatus()).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
}); 