const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer();
const ImageUpscaler = require('../services/upscaler/image-upscaler');

const upscaler = new ImageUpscaler();
upscaler.init();

router.post('/', upload.single('image'), async (req, res) => {
    if (!req.file || !req.file.buffer) {
        return res.status(400).json({
            success: false,
            message: 'No image file provided',
            data: null
        });
    }

    try {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
        if (!allowedTypes.includes(req.file.mimetype)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid file type. Only JPEG, JPG and PNG are allowed',
                data: null
            });
        }

        const result = await upscaler.upscaleImage(req.file.buffer);
        
        if (result.success) {
            result.data.url = 'http://' + req.get('host') + result.data.url;
        }
        
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
            data: null
        });
    }
});

module.exports = router; 