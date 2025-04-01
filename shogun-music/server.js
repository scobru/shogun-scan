const express = require('express');
const cors = require('cors');
const Gun = require('gun');
const path = require('path');
const morgan = require('morgan');
const multer = require('multer');
const fs = require('fs');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});
const upload = multer({ storage });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use('/uploads', express.static(uploadsDir));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve React static files if they exist in the build directory
const reactBuildPath = path.join(__dirname, 'src', 'build');
if (fs.existsSync(reactBuildPath)) {
  app.use(express.static(reactBuildPath));
}

// Initialize Gun
const server = require('http').createServer(app);
const gun = Gun({
  web: server,
  file: 'gundb',
  multicast: false
});

// Make Gun available to our routes
app.gun = gun;

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 