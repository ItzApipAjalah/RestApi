const express = require('express');
const TikTokDownloader = require('./services/downloaders/tiktok-downloader');
const TwitterDownloader = require('./services/downloaders/twitter-downloader');
const colors = require('colors');
const ImageUpscaler = require('./services/upscaler/image-upscaler');
const multer = require('multer');
const upload = multer();
const path = require('path');
const downloaderRoutes = require('./routes/downloader.routes');
const upscalerRoutes = require('./routes/upscaler.routes');
const scraperRoutes = require('./routes/scraper.routes');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());

const downloader = new TikTokDownloader();
const twitterDownloader = new TwitterDownloader();

// Initialize image upscaler
const upscaler = new ImageUpscaler();
upscaler.init();

// Update the root route to serve the HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Use the routes
app.use('/api/download', downloaderRoutes);
app.use('/api/upscale', upscalerRoutes);
app.use('/api/scrape', scraperRoutes);

// Serve uploaded files with proper headers
app.get('/uploads/:filename', (req, res) => {
    const filePath = path.join(__dirname, 'uploads', req.params.filename);
    res.download(filePath, req.params.filename, (err) => {
        if (err) {
            res.status(404).json({
                success: false,
                message: 'File not found',
                data: null
            });
        }
    });
});

// Serve static files
app.use(express.static('public'));

// Add upscaler page route
app.get('/upscaler', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'upscaler.html'));
});

// Add this after other middleware
app.use('/downloads/pinterest', express.static(path.join(__dirname, 'public/downloads/pinterest')));
app.use('/downloads/manga', express.static(path.join(__dirname, 'public/downloads/manga')));
app.use('/downloads/doujin', express.static(path.join(__dirname, 'public/downloads/doujin')));

// Documentation routes
app.get('/docs/tiktok', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'docs', 'tiktok.html'));
});

app.get('/docs/twitter', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'docs', 'twitter.html'));
});

app.get('/docs/pinterest', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'docs', 'pinterest.html'));
});

app.get('/docs/upscaler', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'docs', 'upscaler.html'));
});

// Add documentation route for anime scraper
app.get('/docs/anime-scraper', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'docs', 'anime-scraper.html'));
});

app.listen(PORT, () => {
    console.log("🚀 Server is running!".green.bold);
    console.log(`🌍 URL: http://localhost:${PORT}`.blue);
    console.log("🔗 Rest API is live!".magenta);
}); 