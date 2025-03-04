const puppeteer = require('puppeteer');
const fsPromises = require('fs').promises;  // For promise-based operations
const fs = require('fs');  // For stream operations
const path = require('path');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { spawn } = require('child_process');
require('dotenv').config();

class PinterestDownloader {
    constructor() {
        this.baseUrl = 'https://www.pinterest.com';
        this.email = process.env.PINTEREST_EMAIL;
        this.password = process.env.PINTEREST_PASSWORD;
        this.cookiesPath = path.join(__dirname, '../..', 'data', 'pinterest-cookies.json');
        this.videoSavePath = path.join(__dirname, '../..', 'public', 'downloads', 'pinterest');
    }

    async saveCookies(page) {
        const cookies = await page.cookies();
        // Ensure directory exists
        await fsPromises.mkdir(path.dirname(this.cookiesPath), { recursive: true });
        await fsPromises.writeFile(this.cookiesPath, JSON.stringify(cookies, null, 2));
    }

    async loadCookies(page) {
        try {
            const cookiesString = await fsPromises.readFile(this.cookiesPath);
            const cookies = JSON.parse(cookiesString);
            await page.setCookie(...cookies);
            return true;
        } catch (error) {
            return false;
        }
    }

    async checkLoginStatus(page) {
        await page.goto(this.baseUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        return await page.evaluate(() => {
            return !document.querySelector('input[type="email"]') && 
                   !document.querySelector('div[data-test-id="login-error"]');
        });
    }

    async login(page) {
        try {
            // Try to load cookies first
            const cookiesLoaded = await this.loadCookies(page);
            
            if (cookiesLoaded) {
                // Check if cookies are still valid
                const isLoggedIn = await this.checkLoginStatus(page);
                if (isLoggedIn) {
                    console.log('Successfully logged in using cookies');
                    return true;
                }
            }

            // If cookies don't work, proceed with normal login
            await page.goto('https://www.pinterest.com/login/', {
                waitUntil: 'domcontentloaded',
                timeout: 15000
            });

            // Wait for email field and ensure it's ready
            const emailSelector = 'input[type="email"]';
            await page.waitForSelector(emailSelector, { 
                visible: true, 
                timeout: 5000 
            });

            // Clear and fill email
            await page.click(emailSelector, { clickCount: 3 });
            await page.keyboard.press('Backspace');
            await page.type(emailSelector, this.email, { delay: 50 });

            // Wait for password field
            const passwordSelector = 'input[type="password"]';
            await page.waitForSelector(passwordSelector, { 
                visible: true, 
                timeout: 5000 
            });

            // Clear and fill password
            await page.click(passwordSelector, { clickCount: 3 });
            await page.keyboard.press('Backspace');
            await page.type(passwordSelector, this.password, { delay: 50 });

            // Verify input values
            const emailValue = await page.$eval(emailSelector, el => el.value);
            const passwordValue = await page.$eval(passwordSelector, el => el.value);

            if (emailValue !== this.email || !passwordValue) {
                throw new Error('Failed to enter credentials correctly');
            }

            // Click login and wait for navigation
            const submitButton = await page.waitForSelector('button[type="submit"]', {
                visible: true,
                timeout: 5000
            });

            await Promise.all([
                page.waitForNavigation({ timeout: 15000 }),
                submitButton.click()
            ]);

            // Check for login errors
            const loginError = await page.$('div[data-test-id="login-error"]');
            if (loginError) {
                throw new Error('Invalid credentials');
            }

            // Verify login success
            const isLoggedIn = await this.checkLoginStatus(page);
            if (!isLoggedIn) {
                throw new Error('Login verification failed');
            }

            // Save cookies for future use
            await this.saveCookies(page);
            console.log('Login successful, cookies saved');

            return true;
        } catch (error) {
            console.error('Login error:', error.message);
            throw new Error(`Failed to login to Pinterest: ${error.message}`);
        }
    }

    async downloadVideo(videoUrl) {
        try {
            // Ensure video directory exists
            await fsPromises.mkdir(this.videoSavePath, { recursive: true });

            // Generate unique filename
            const filename = `pinterest-${uuidv4()}.mp4`;
            const filePath = path.join(this.videoSavePath, filename);

            if (videoUrl.includes('.m3u8')) {
                // Use ffmpeg to download and convert m3u8 stream
                return new Promise((resolve, reject) => {
                    const ffmpeg = spawn('ffmpeg', [
                        '-i', videoUrl,
                        '-c', 'copy',
                        '-bsf:a', 'aac_adtstoasc',
                        filePath
                    ]);

                    ffmpeg.stderr.on('data', (data) => {
                        console.log(`ffmpeg: ${data}`);
                    });

                    ffmpeg.on('close', (code) => {
                        if (code === 0) {
                            resolve(`/downloads/pinterest/${filename}`);
                        } else {
                            reject(new Error(`FFmpeg process exited with code ${code}`));
                        }
                    });

                    ffmpeg.on('error', (err) => {
                        reject(new Error(`FFmpeg process error: ${err.message}`));
                    });
                });
            } else {
                // For direct MP4 URLs, use axios to download
                const response = await axios({
                    method: 'GET',
                    url: videoUrl,
                    responseType: 'stream'
                });

                const writer = fs.createWriteStream(filePath);
                response.data.pipe(writer);

                await new Promise((resolve, reject) => {
                    writer.on('finish', resolve);
                    writer.on('error', reject);
                });

                return `/downloads/pinterest/${filename}`;
            }
        } catch (error) {
            console.error('Video download error:', error);
            throw new Error('Failed to download video');
        }
    }

    async getDownloadLink(pinterestUrl) {
        let browser;
        try {
            browser = await puppeteer.launch({
                headless: false,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-web-security',
                    '--disable-features=IsolateOrigins,site-per-process',
                    '--window-size=1920,1080'
                ]
            });

            const page = await browser.newPage();
            
            // Enable request interception for video URLs
            await page.setRequestInterception(true);

            let videoUrl = null;
            
            // Listen for video requests
            page.on('request', request => {
                const url = request.url();
                if (url.includes('.mp4') || url.includes('/v1/videos/')) {
                    videoUrl = url;
                }
                request.continue();
            });

            await Promise.all([
                page.setViewport({ width: 1920, height: 1080 }),
                page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36')
            ]);

            await this.login(page);

            await page.goto(pinterestUrl, {
                waitUntil: 'domcontentloaded',
                timeout: 15000
            });

            // Try to get media info with enhanced video detection
            const mediaInfo = await page.evaluate(async () => {
                const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

                // Try to get video URL from various sources
                const getVideoUrl = async () => {
                    // Check for video element
                    const video = document.querySelector('video');
                    if (video) {
                        // Try to get src directly
                        if (video.src && !video.src.startsWith('blob:')) {
                            return { url: video.src, type: 'video' };
                        }

                        // Try to get source element
                        const source = video.querySelector('source');
                        if (source && source.src && !source.src.startsWith('blob:')) {
                            return { url: source.src, type: 'video' };
                        }

                        // Get poster as fallback
                        if (video.poster) {
                            return { url: video.poster, type: 'image' };
                        }
                    }

                    // Look for video URL in meta tags
                    const metaVideo = document.querySelector('meta[property="og:video"]');
                    if (metaVideo && metaVideo.content) {
                        return { url: metaVideo.content, type: 'video' };
                    }

                    return null;
                };

                // Try to get image if no video found
                const getImageUrl = () => {
                    const selectors = [
                        'img[src*="originals"]',
                        'img[src*="736x"]',
                        'img[loading="eager"]',
                        'img[srcset]'
                    ];

                    for (const selector of selectors) {
                        const img = document.querySelector(selector);
                        if (img && img.src) {
                            return { url: img.src, type: 'image' };
                        }
                    }
                    return null;
                };

                // Try video first, wait a bit for video to load if needed
                let mediaInfo = await getVideoUrl();
                if (!mediaInfo) {
                    await sleep(1000); // Short wait for video to load
                    mediaInfo = await getVideoUrl();
                }

                // Fallback to image if no video found
                return mediaInfo || getImageUrl();
            });

            // If we found a video URL from request interception, use that
            if (videoUrl) {
                mediaInfo = { url: videoUrl, type: 'video' };
            }

            await browser.close();

            if (!mediaInfo) {
                throw new Error('Could not find media URL');
            }

            // Handle video download if it's a video
            if (mediaInfo.type === 'video' || videoUrl) {
                const urlToDownload = videoUrl || mediaInfo.url;
                const savedVideoPath = await this.downloadVideo(urlToDownload);
                
                return {
                    success: true,
                    message: 'Pinterest video found',
                    data: {
                        type: 'video',
                        url: savedVideoPath
                    }
                };
            }

            // For images, just return the URL
            const finalUrl = mediaInfo.url.replace('236x', 'originals').replace('736x', 'originals');

            return {
                success: true,
                message: `Pinterest ${mediaInfo.type} found`,
                data: {
                    type: mediaInfo.type,
                    url: finalUrl
                }
            };

        } catch (error) {
            if (browser) {
                await browser.close();
            }
            return {
                success: false,
                message: error.message || 'Failed to process Pinterest URL',
                data: null
            };
        }
    }
}

module.exports = PinterestDownloader; 