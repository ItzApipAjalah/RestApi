const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

class DoujinScraper {
    constructor() {
        this.baseUrl = 'https://doujindesu.tv';
        this.downloadPath = path.join(__dirname, '../../public/downloads/doujin');
    }

    async getChapterList(url) {
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

            await page.goto(url, {
                waitUntil: 'networkidle0'
            });

            const baseUrl = this.baseUrl; // Get baseUrl before evaluate
            const chapterData = await page.evaluate((baseUrl) => {
                const chapterList = document.querySelector('#chapter_list ul');
                if (!chapterList) return null;

                const chapters = [];
                const items = chapterList.querySelectorAll('li');

                items.forEach(item => {
                    const link = item.querySelector('a');
                    if (link) {
                        const title = link.getAttribute('title');
                        const href = link.getAttribute('href');
                        const chapterMatch = title.match(/Chapter\s+(\d+)/i);
                        const chapter = chapterMatch ? chapterMatch[1] : null;

                        chapters.push({
                            title,
                            chapter,
                            url: href.startsWith('http') ? href : `${baseUrl}${href}`
                        });
                    }
                });

                return {
                    totalChapters: chapters.length,
                    chapters: chapters.reverse() // Reverse to get ascending order
                };
            }, baseUrl); // Pass baseUrl to evaluate function

            await browser.close();

            if (!chapterData) {
                throw new Error('No chapters found');
            }

            return {
                success: true,
                message: 'Chapters found',
                data: chapterData
            };

        } catch (error) {
            if (browser) {
                await browser.close();
            }
            return {
                success: false,
                message: error.message || 'Failed to get chapter list',
                data: null
            };
        }
    }

    async downloadImage(url, filepath) {
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'arraybuffer',
            headers: {
                'Referer': 'https://doujindesu.tv/'
            }
        });
        await fs.outputFile(filepath, response.data);
        return filepath;
    }

    async createPDF(images, chapterId) {
        const pdfDoc = await PDFDocument.create();
        
        for (const image of images) {
            try {
                const imagePath = path.join(this.downloadPath, chapterId, `${image.id}.jpg`);
                const imageBytes = await fs.readFile(imagePath);
                let pageImage;

                try {
                    pageImage = await pdfDoc.embedJpg(imageBytes);
                } catch (e) {
                    try {
                        pageImage = await pdfDoc.embedPng(imageBytes);
                    } catch (e2) {
                        console.error(`Failed to process image ${image.id}: ${e2.message}`);
                        continue;
                    }
                }

                const page = pdfDoc.addPage([pageImage.width, pageImage.height]);
                page.drawImage(pageImage, {
                    x: 0,
                    y: 0,
                    width: pageImage.width,
                    height: pageImage.height,
                });
            } catch (error) {
                console.error(`Error processing image ${image.id}: ${error.message}`);
            }
        }

        const pdfPath = path.join(this.downloadPath, chapterId, `${chapterId}.pdf`);
        const pdfBytes = await pdfDoc.save();
        await fs.outputFile(pdfPath, pdfBytes);
        
        // Clean up individual images
        for (const image of images) {
            try {
                const imagePath = path.join(this.downloadPath, chapterId, `${image.id}.jpg`);
                await fs.remove(imagePath);
            } catch (error) {
                console.error(`Error removing image ${image.id}: ${error.message}`);
            }
        }

        return `/downloads/doujin/${chapterId}/${chapterId}.pdf`;
    }

    async getChapterDetail(url) {
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
            
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

            await page.goto(url, {
                waitUntil: 'networkidle0'
            });

            const imageData = await page.evaluate(() => {
                const imageContainer = document.querySelector('#anu');
                if (!imageContainer) return null;

                const images = [];
                const imageElements = imageContainer.querySelectorAll('img#imagech');

                imageElements.forEach(img => {
                    const src = img.getAttribute('src');
                    const id = img.getAttribute('img-id');
                    if (src) {
                        images.push({ id, url: src });
                    }
                });

                return images;
            });

            await browser.close();

            if (!imageData || imageData.length === 0) {
                throw new Error('No images found');
            }

            // Generate a unique chapter ID from the URL
            const chapterId = url.split('/').filter(Boolean).pop() || Date.now().toString();

            // Download all images
            const downloadPromises = imageData.map(image => 
                this.downloadImage(
                    image.url, 
                    path.join(this.downloadPath, chapterId, `${image.id}.jpg`)
                )
            );
            await Promise.all(downloadPromises);

            // Create PDF from images
            const pdfUrl = await this.createPDF(imageData, chapterId);

            return {
                success: true,
                message: 'Chapter downloaded successfully',
                data: {
                    chapterId,
                    totalImages: imageData.length,
                    pdfUrl
                }
            };

        } catch (error) {
            if (browser) {
                await browser.close();
            }
            return {
                success: false,
                message: error.message || 'Failed to get chapter detail',
                data: null
            };
        }
    }
}

module.exports = DoujinScraper; 