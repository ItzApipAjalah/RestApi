const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

class AnimeScraper {
    constructor() {
        this.baseUrl = 'https://nhentai.net';
        this.downloadPath = path.join(__dirname, '../../public/downloads/manga');
    }

    async downloadImage(url, filepath) {
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'arraybuffer',
            headers: {
                'Referer': 'https://nhentai.net/'
            }
        });
        await fs.outputFile(filepath, response.data);
        return filepath;
    }

    async createPDF(images, code) {
        const pdfDoc = await PDFDocument.create();
        
        for (const image of images) {
            try {
                const imagePath = path.join(this.downloadPath, code, `${image.page}.jpg`);
                const imageBytes = await fs.readFile(imagePath);
                let pageImage;

                try {
                    // Try as JPG first
                    pageImage = await pdfDoc.embedJpg(imageBytes);
                } catch (e) {
                    try {
                        // If JPG fails, try as PNG
                        pageImage = await pdfDoc.embedPng(imageBytes);
                    } catch (e2) {
                        console.error(`Failed to process image ${image.page}: ${e2.message}`);
                        continue;
                    }
                }

                // Use the original image dimensions from the scraping
                const width = parseInt(image.width) || pageImage.width;
                const height = parseInt(image.height) || pageImage.height;
                
                const page = pdfDoc.addPage([width, height]);
                page.drawImage(pageImage, {
                    x: 0,
                    y: 0,
                    width: width,
                    height: height,
                });
            } catch (error) {
                console.error(`Error processing image ${image.page}: ${error.message}`);
            }
        }

        const pdfPath = path.join(this.downloadPath, code, `${code}.pdf`);
        const pdfBytes = await pdfDoc.save();
        await fs.outputFile(pdfPath, pdfBytes);
        
        // Clean up individual images
        for (const image of images) {
            try {
                const imagePath = path.join(this.downloadPath, code, `${image.page}.jpg`);
                await fs.remove(imagePath);
            } catch (error) {
                console.error(`Error removing image ${image.page}: ${error.message}`);
            }
        }

        return `/downloads/manga/${code}/${code}.pdf`;
    }

    async scrapeImages(code) {
        let browser;
        try {
            browser = await puppeteer.launch({
                headless: false,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-web-security',
                    '--disable-features=IsolateOrigins,site-per-process'
                ]
            });

            const page = await browser.newPage();
            
            // Set user agent
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

            // Get gallery page
            await page.goto(`${this.baseUrl}/g/${code}/`, {
                waitUntil: 'networkidle0'
            });

            const galleryData = await page.evaluate(() => {
                const thumbContainers = document.querySelectorAll('.thumb-container');
                const images = [];

                thumbContainers.forEach((container, index) => {
                    const img = container.querySelector('img.lazyload');
                    if (img) {
                        // Get the data-src attribute for lazy-loaded images
                        const imageUrl = img.getAttribute('data-src');
                        if (imageUrl) {
                            images.push({
                                page: index + 1,
                                url: imageUrl.replace(/t(\d+)\.nhentai\.net\/galleries\/(\d+)\/(\d+)t\./, 'i$1.nhentai.net/galleries/$2/$3.'),
                                width: img.getAttribute('width'),
                                height: img.getAttribute('height')
                            });
                        }
                    }
                });

                return {
                    totalPages: thumbContainers.length,
                    images
                };
            });

            if (!galleryData.totalPages) {
                throw new Error('No images found or invalid code');
            }

            await browser.close();

            // Download all images
            const downloadPromises = galleryData.images.map(image => 
                this.downloadImage(
                    image.url, 
                    path.join(this.downloadPath, code, `${image.page}.jpg`)
                )
            );
            await Promise.all(downloadPromises);

            // Create PDF from images
            const pdfUrl = await this.createPDF(galleryData.images, code);

            return {
                success: true,
                message: 'PDF created successfully',
                data: {
                    code,
                    totalPages: galleryData.totalPages,
                    pdfUrl
                }
            };

        } catch (error) {
            if (browser) {
                await browser.close();
            }
            return {
                success: false,
                message: error.message || 'Failed to scrape images',
                data: null
            };
        }
    }
}

module.exports = AnimeScraper; 