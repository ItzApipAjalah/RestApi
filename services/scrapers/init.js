const fs = require('fs-extra');
const path = require('path');

// Create downloads directories
fs.ensureDirSync(path.join(__dirname, '../../public/downloads/manga'));
fs.ensureDirSync(path.join(__dirname, '../../public/downloads/doujin')); 