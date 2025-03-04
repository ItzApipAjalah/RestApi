const puppeteer = require('puppeteer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs').promises;
const fsSync = require('fs');

class ImageUpscaler {
    constructor() {
        this.baseUrl = 'https://www.nightmare-ai.com/ai-image-upscaler';
        this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';
        this.uploadDir = path.join(__dirname, 'uploads');
        this.tempDir = path.join(this.uploadDir, 'temp');
        this.downloadDir = path.join(process.env.HOME || process.env.USERPROFILE, 'Downloads');
    }

    async init() {
        // Create uploads and temp directories if they don't exist
        try {
            await fs.mkdir(this.uploadDir, { recursive: true });
            await fs.mkdir(this.tempDir, { recursive: true });
        } catch (error) {
            console.error('Error creating directories:', error);
        }
    }

    generateFileName() {
        return crypto.randomBytes(16).toString('hex') + '.png';
    }

    async upscaleImage(imageBuffer) {
        if (!imageBuffer || !(imageBuffer instanceof Buffer)) {
            throw new Error('Invalid image data provided');
        }

        let tempFilePath = null;
        let browser = null;
        try {
            browser = await puppeteer.launch({
                headless: "new",
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--start-maximized',
                    '--window-size=1920,1080',
                    '--disable-web-security',
                    '--disable-features=IsolateOrigins,site-per-process'
                ]
            });

            const page = await browser.newPage();
            
            // Set viewport for desktop size
            await page.setViewport({
                width: 1920,
                height: 1080,
                deviceScaleFactor: 1
            });

            await page.setUserAgent(this.userAgent);

            // Set extra headers
            await page.setExtraHTTPHeaders({
                'accept-language': 'en-US,en;q=0.9',
                'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'sec-fetch-site': 'none',
                'sec-fetch-mode': 'navigate',
                'sec-fetch-user': '?1',
                'sec-fetch-dest': 'document',
                'accept-encoding': 'gzip, deflate, br',
                'upgrade-insecure-requests': '1',
                'sec-ch-ua': '"Google Chrome";v="121", "Not A(Brand";v="99"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"'
            });

            // Navigate to upscaler page with proper timeout
            await page.goto(this.baseUrl, {
                waitUntil: 'networkidle0',
                timeout: 60000
            });

            // Create a temporary file in temp directory
            tempFilePath = path.join(this.tempDir, 'temp-' + this.generateFileName());
            await fs.writeFile(tempFilePath, imageBuffer);

            // Upload the file
            const elementHandle = await page.$('input[type="file"]');
            await elementHandle.uploadFile(tempFilePath);

            // Wait for image to be uploaded
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Click upscale button
            await page.waitForSelector('button.bg-primary', { visible: true });
            await page.click('button.bg-primary');

            // Wait and check for error alert
            try {
                const errorAlert = await page.waitForSelector('div[role="alert"]', { 
                    timeout: 5000 
                });
                
                if (errorAlert) {
                    const errorMessage = await page.evaluate(() => {
                        const alert = document.querySelector('div[role="alert"]');
                        const messageSpan = alert.querySelector('span');
                        return messageSpan ? messageSpan.textContent : 'Error processing image';
                    });
                    
                    throw new Error(errorMessage);
                }
            } catch (alertError) {
                if (alertError.message.includes('can not upscale image')) {
                    return {
                        success: false,
                        message: alertError.message,
                        data: null
                    };
                }
                // If error is timeout (no alert found), continue with normal flow
            }

            // Wait for initial processing
            await new Promise(resolve => setTimeout(resolve, 5000));

            // Try to click download button multiple times
            let downloadSuccess = false;
            let attempts = 0;
            const maxAttempts = 20;

            const buttonClasses = [
                'inline-flex',
                'items-center',
                'justify-center',
                'whitespace-nowrap',
                'rounded-md',
                'text-sm',
                'font-medium',
                'ring-offset-background',
                'transition-colors',
                'focus-visible:outline-none',
                'focus-visible:ring-2',
                'focus-visible:ring-ring',
                'focus-visible:ring-offset-2',
                'disabled:pointer-events-none',
                'disabled:opacity-50',
                'bg-primary',
                'text-primary-foreground',
                'hover:bg-primary/90',
                'h-10',
                'px-4',
                'py-2',
                'mt-4'
            ].join(' ');

            while (!downloadSuccess && attempts < maxAttempts) {
                try {
                    // Find button by exact class list
                    const downloadButton = await page.evaluateHandle((classes) => {
                        // Find all buttons
                        const buttons = document.querySelectorAll('button');
                        // Find the one with matching classes that appears after upscaling
                        for (const button of buttons) {
                            if (
                                button.className === classes && 
                                button.offsetParent !== null && // Check if visible
                                !button.disabled
                            ) {
                                return button;
                            }
                        }
                        return null;
                    }, buttonClasses);

                    if (downloadButton) {
                        const isButton = await page.evaluate(el => el.tagName === 'BUTTON', downloadButton);
                        if (isButton) {
                            // Setup download handling
                            const downloadPath = this.downloadDir;
                            const beforeFiles = fsSync.readdirSync(downloadPath);

                            await downloadButton.click();
                            
                            // Wait for download to complete
                            let downloadedFile = null;
                            let waitAttempts = 0;
                            while (!downloadedFile && waitAttempts < 30) {
                                await new Promise(resolve => setTimeout(resolve, 1000));
                                const afterFiles = fsSync.readdirSync(downloadPath);
                                const newFiles = afterFiles.filter(file => !beforeFiles.includes(file));
                                
                                if (newFiles.length > 0) {
                                    downloadedFile = newFiles[0];
                                    break;
                                }
                                waitAttempts++;
                            }

                            if (!downloadedFile) {
                                throw new Error('Download timeout');
                            }

                            // Copy file to uploads directory instead of moving
                            const sourcePath = path.join(downloadPath, downloadedFile);
                            const fileName = `upscaled_${this.generateFileName()}`;
                            const targetPath = path.join(this.uploadDir, fileName);

                            try {
                                // Read the file from source
                                const fileContent = await fs.readFile(sourcePath);
                                // Write to target
                                await fs.writeFile(targetPath, fileContent);
                                // Delete the source file
                                await fs.unlink(sourcePath).catch(console.error);

                                downloadSuccess = true;
                                return {
                                    success: true,
                                    message: 'Image upscaled successfully',
                                    data: {
                                        url: `/uploads/${fileName}`,
                                        dimensions: {
                                            width: null,
                                            height: null
                                        }
                                    }
                                };
                            } catch (copyError) {
                                console.error('File copy error:', copyError);
                                throw new Error('Failed to save upscaled image');
                            }
                        }
                    }
                } catch (error) {
                    console.log(`Attempt ${attempts + 1} failed:`, error.message);
                }
                attempts++;
                if (!downloadSuccess) {
                    await new Promise(resolve => setTimeout(resolve, 3000));
                }
            }

            if (!downloadSuccess) {
                throw new Error('Failed to find and click download button after multiple attempts');
            }

        } catch (error) {
            return {
                success: false,
                message: error.message,
                data: null
            };
        } finally {
            // Clean up resources
            if (tempFilePath) {
                await fs.unlink(tempFilePath).catch(console.error);
            }
            if (browser) {
                await browser.close().catch(console.error);
            }
        }
    }
}

module.exports = ImageUpscaler; 