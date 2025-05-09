
const express = require('express');
const app = express();

// Set up middleware, routes, and other configurations here

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
