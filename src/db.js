import Gun from 'gun'

// Note: Gun instance is now created and configured in gunContext.jsx
// This file is kept for compatibility but the main Gun instance
// should be accessed through the useGun hook from gunContext

window.gun = Gun({localStorage:false, radisk:false})

export default window.gun