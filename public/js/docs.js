// API Documentation sections
const apiSections = {
    tiktok: {
        title: 'TikTok Downloader',
        icon: 'fab fa-tiktok',
        description: 'Download videos from TikTok without watermark.',
        endpoint: '/api/download/tiktok',
        method: 'POST',
        request: {
            url: 'https://www.tiktok.com/@username/video/1234567890'
        },
        response: {
            success: true,
            message: 'Video found',
            data: {
                url: 'https://example.com/video.mp4'
            }
        }
    },
    twitter: {
        title: 'Twitter/X Downloader',
        icon: 'fab fa-twitter',
        description: 'Download videos and images from Twitter/X posts.',
        endpoint: '/api/download/twitter',
        method: 'POST',
        request: {
            url: 'https://twitter.com/username/status/1234567890'
        },
        response: {
            success: true,
            message: 'Media found',
            data: {
                type: 'video|image',
                url: 'https://example.com/media.mp4'
            }
        }
    },
    pinterest: {
        title: 'Pinterest Downloader',
        icon: 'fab fa-pinterest',
        description: 'Download videos and images from Pinterest pins.',
        endpoint: '/api/download/pinterest',
        method: 'POST',
        request: {
            url: 'https://pinterest.com/pin/1234567890'
        },
        response: {
            success: true,
            message: 'Media found',
            data: {
                type: 'video|image',
                url: 'https://example.com/media.jpg'
            }
        }
    },
    upscaler: {
        title: 'Image Upscaler',
        icon: 'fas fa-image',
        description: 'Enhance image resolution using AI.',
        endpoint: '/api/upscale',
        method: 'POST',
        request: 'Form Data:\n- image: File (JPEG, PNG)',
        response: {
            success: true,
            message: 'Image upscaled successfully',
            data: {
                url: 'https://example.com/upscaled.jpg'
            }
        }
    }
};

// Generate API section HTML
function generateSection(id, section) {
    return `
        <section id="${id}" class="max-w-3xl mb-12">
            <h2 class="text-2xl font-bold mb-4 flex items-center">
                <i class="${section.icon} mr-2"></i>
                ${section.title}
            </h2>
            <div class="bg-dark-800 rounded-lg p-6 mb-4">
                <h3 class="text-lg font-semibold mb-2">${section.title}</h3>
                <p class="text-gray-400 mb-4">${section.description}</p>
                
                <div class="bg-dark-700 rounded p-4 mb-4">
                    <p class="text-sm font-mono mb-2">${section.method} ${section.endpoint}</p>
                    <p class="text-gray-400 text-sm mb-2">Request Body:</p>
                    <pre class="bg-dark-900 p-3 rounded text-sm overflow-x-auto">${
                        typeof section.request === 'string' 
                            ? section.request 
                            : JSON.stringify(section.request, null, 4)
                    }</pre>
                </div>

                <div class="bg-dark-700 rounded p-4">
                    <p class="text-gray-400 text-sm mb-2">Response:</p>
                    <pre class="bg-dark-900 p-3 rounded text-sm overflow-x-auto">${
                        JSON.stringify(section.response, null, 4)
                    }</pre>
                </div>
            </div>
        </section>
    `;
}

// Render all sections
document.getElementById('api-sections').innerHTML = 
    Object.entries(apiSections)
        .map(([id, section]) => generateSection(id, section))
        .join('');

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        
        // Remove active class from all links
        document.querySelectorAll('a').forEach(a => 
            a.classList.remove('active-link')
        );
        
        // Add active class to clicked link
        this.classList.add('active-link');
        
        // Smooth scroll to section
        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});

// Set active link based on scroll position
window.addEventListener('scroll', () => {
    const sections = document.querySelectorAll('section');
    const navLinks = document.querySelectorAll('nav a');
    
    let current = '';
    
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        if (window.pageYOffset >= sectionTop - 100) {
            current = section.getAttribute('id');
        }
    });
    
    navLinks.forEach(link => {
        link.classList.remove('active-link');
        if (link.getAttribute('href') === `#${current}`) {
            link.classList.add('active-link');
        }
    });
});

// Common navigation functionality
document.addEventListener('DOMContentLoaded', () => {
    // Highlight current page in navigation
    const currentPath = window.location.pathname;
    document.querySelectorAll('nav a').forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active-link');
        }
    });

    // Mobile menu toggle
    const menuButton = document.getElementById('mobile-menu-button');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');

    menuButton?.addEventListener('click', () => {
        sidebar.classList.toggle('translate-x-0');
        sidebar.classList.toggle('-translate-x-full');
        overlay.classList.toggle('hidden');
    });

    overlay?.addEventListener('click', () => {
        sidebar.classList.remove('translate-x-0');
        sidebar.classList.add('-translate-x-full');
        overlay.classList.add('hidden');
    });
}); 