import { Track } from '../types';

/**
 * Fallback tracks data to use when the server is unavailable
 */
export const fallbackTracks: Track[] = [
  {
    id: 'fallback-1',
    title: 'Bohemian Rhapsody',
    artist: 'Queen',
    album: 'A Night at the Opera',
    duration: 354,
    coverUrl: 'https://via.placeholder.com/300?text=Queen',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
  },
  {
    id: 'fallback-2',
    title: 'Hotel California',
    artist: 'Eagles',
    album: 'Hotel California',
    duration: 390,
    coverUrl: 'https://via.placeholder.com/300?text=Eagles',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3'
  },
  {
    id: 'fallback-3',
    title: 'Sweet Child O\' Mine',
    artist: 'Guns N\' Roses',
    album: 'Appetite for Destruction',
    duration: 356,
    coverUrl: 'https://via.placeholder.com/300?text=GNR',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3'
  },
  {
    id: 'fallback-4',
    title: 'Smells Like Teen Spirit',
    artist: 'Nirvana',
    album: 'Nevermind',
    duration: 301,
    coverUrl: 'https://via.placeholder.com/300?text=Nirvana',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3'
  },
  {
    id: 'fallback-5',
    title: 'Imagine',
    artist: 'John Lennon',
    album: 'Imagine',
    duration: 183,
    coverUrl: 'https://via.placeholder.com/300?text=Lennon',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3'
  }
];

export default fallbackTracks; 