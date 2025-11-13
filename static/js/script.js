document.addEventListener('DOMContentLoaded', function() {
    // Preloader
    const preloader = document.getElementById('preloader');
    
    // Hide preloader after 2.5 seconds
    setTimeout(() => {
        preloader.classList.add('fade-out');
        setTimeout(() => {
            preloader.style.display = 'none';
        }, 500);
    }, 2500);

    // Elements
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const progressContainer = document.getElementById('progressContainer');
    const toolsSection = document.getElementById('toolsSection');
    const resultsSection = document.getElementById('resultsSection');
    const originalImage = document.getElementById('originalImage');
    const convertedImage = document.getElementById('convertedImage');
    const convertedTitle = document.getElementById('convertedTitle');
    const textOutput = document.getElementById('textOutput');
    
    // Tool navigation
    const toolBtns = document.querySelectorAll('.tool-btn');
    const toolPanels = document.querySelectorAll('.tool-panel');
    
    // Model selection
    const modelBtns = document.querySelectorAll('.model-btn');
    
    // Color mode buttons
    const colorBtns = document.querySelectorAll('.color-btn');
    
    // Adjustment controls
    const hueSlider = document.getElementById('hueSlider');
    const saturationSlider = document.getElementById('saturationSlider');
    const brightnessSlider = document.getElementById('brightnessSlider');
    const hueValue = document.getElementById('hueValue');
    const saturationValue = document.getElementById('saturationValue');
    const brightnessValue = document.getElementById('brightnessValue');
    const applyAdjustmentsBtn = document.getElementById('applyAdjustments');
    
    // Download options
    const downloadBtn = document.getElementById('downloadBtn');
    const qualitySlider = document.getElementById('qualitySlider');
    const qualityValue = document.getElementById('qualityValue');
    
    // Copy text button
    const copyTextBtn = document.getElementById('copyText');
    
    // Current state
    let currentImages = {};
    let currentModel = 'celeba';
    let currentTool = 'anime';
    let currentColorMode = '';
    let currentFilename = '';
    
    // Event listeners for file selection
    uploadArea.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);
    
    // Drag and drop functionality
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        
        if (e.dataTransfer.files.length) {
            fileInput.files = e.dataTransfer.files;
            handleFileSelect();
        }
    });
    
    // Tool navigation
    toolBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tool = btn.getAttribute('data-tool');
            
            // Update active button
            toolBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Show corresponding panel
            toolPanels.forEach(panel => panel.classList.remove('active'));
            document.getElementById(`${tool}Panel`).classList.add('active');
            
            currentTool = tool;
            updateConvertedImage();
        });
    });
    
    // Model selection
    modelBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            modelBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentModel = btn.getAttribute('data-model');
            updateConvertedImage();
        });
    });
    
    // Color mode selection
    colorBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            colorBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentColorMode = btn.getAttribute('data-mode');
            updateConvertedImage();
        });
    });
    
    // Adjustment sliders
    hueSlider.addEventListener('input', () => {
        hueValue.textContent = `${hueSlider.value}%`;
    });
    
    saturationSlider.addEventListener('input', () => {
        saturationValue.textContent = `${saturationSlider.value}%`;
    });
    
    brightnessSlider.addEventListener('input', () => {
        brightnessValue.textContent = `${brightnessSlider.value}%`;
    });
    
    // Apply adjustments
    applyAdjustmentsBtn.addEventListener('click', applyAdjustments);
    
    // Quality slider
    qualitySlider.addEventListener('input', () => {
        qualityValue.textContent = qualitySlider.value;
    });
    
    // Download button
    downloadBtn.addEventListener('click', downloadImage);
    
    // Copy text button
    copyTextBtn.addEventListener('click', copyText);
    
    function handleFileSelect() {
        const file = fileInput.files[0];
        if (!file) return;
        
        // Validate file type
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/bmp', 'image/tiff', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            showNotification('Please select a valid image file (JPG, PNG, BMP, TIFF, or WEBP).', 'error');
            return;
        }
        
        // Show progress
        uploadArea.style.display = 'none';
        progressContainer.style.display = 'block';
        
        // Create FormData and send to server
        const formData = new FormData();
        formData.append('file', file);
        
        fetch('/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                showNotification(data.error, 'error');
                resetUploadArea();
                return;
            }
            
            // Store image paths and data
            currentImages = data;
            currentFilename = data.original.split('/').pop();
            
            // Display tools and results
            displayResults();
        })
        .catch(error => {
            console.error('Error:', error);
            showNotification('An error occurred while processing your image. Please try again.', 'error');
            resetUploadArea();
        });
    }
    
    function displayResults() {
        progressContainer.style.display = 'none';
        toolsSection.style.display = 'block';
        resultsSection.style.display = 'block';
        
        // Set original image
        originalImage.src = currentImages.original;
        
        // Set extracted text
        if (currentImages.text) {
            textOutput.textContent = currentImages.text;
        }
        
        // Set initial converted image
        updateConvertedImage();
        
        // Scroll to results
        resultsSection.scrollIntoView({ behavior: 'smooth' });
        
        // Show success notification
        showNotification('Image processed successfully! Choose your transformation tools.', 'success');
    }
    
    function updateConvertedImage() {
        let imageUrl = '';
        let title = '';
        
        switch(currentTool) {
            case 'anime':
                imageUrl = currentImages[currentModel] || currentImages.celeba;
                title = `${getModelName(currentModel)} Style`;
                break;
            case 'color':
                imageUrl = currentImages.converted[currentColorMode] || currentImages.original;
                title = `${currentColorMode.charAt(0).toUpperCase() + currentColorMode.slice(1)} Mode`;
                break;
            case 'adjust':
                imageUrl = currentImages.original;
                title = 'Adjusted Image';
                break;
            case 'ocr':
                // OCR doesn't change the image
                imageUrl = currentImages.original;
                title = 'Original Image';
                break;
        }
        
        convertedImage.src = imageUrl;
        convertedTitle.textContent = title;
    }
    
    function applyAdjustments() {
        const hFactor = hueSlider.value / 100;
        const sFactor = saturationSlider.value / 100;
        const vFactor = brightnessSlider.value / 100;
        
        showNotification('Applying adjustments...', 'info');
        
        fetch('/convert', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                filename: currentFilename,
                type: 'hsv_adjust',
                params: {
                    h: hFactor,
                    s: sFactor,
                    v: vFactor
                }
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                showNotification(data.error, 'error');
                return;
            }
            
            // Update converted image
            convertedImage.src = data.converted;
            showNotification('Adjustments applied successfully!', 'success');
        })
        .catch(error => {
            console.error('Error:', error);
            showNotification('Error applying adjustments.', 'error');
        });
    }
    
    function downloadImage() {
        if (!convertedImage.src) {
            showNotification('No image available to download.', 'error');
            return;
        }
        
        const format = document.querySelector('input[name="format"]:checked').value;
        const quality = qualitySlider.value;
        
        const imagePath = convertedImage.src.split('/static/images/')[1];
        const downloadUrl = `/download/${imagePath}?format=${format}&quality=${quality}`;
        
        // Create a temporary link to trigger download
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `converted_image.${format.toLowerCase()}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showNotification('Download started!', 'success');
    }
    
    function copyText() {
        const text = textOutput.textContent;
        
        navigator.clipboard.writeText(text).then(() => {
            showNotification('Text copied to clipboard!', 'success');
        }).catch(err => {
            showNotification('Failed to copy text.', 'error');
        });
    }
    
    function getModelName(model) {
        const names = {
            'celeba': 'CelebA',
            'facev1': 'Face V1',
            'facev2': 'Face V2',
            'paprika': 'Paprika'
        };
        return names[model] || 'Anime';
    }
    
    function resetUploadArea() {
        uploadArea.style.display = 'block';
        progressContainer.style.display = 'none';
        fileInput.value = '';
    }
    
    function showNotification(message, type) {
        // Remove existing notifications
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(notification => notification.remove());
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${getNotificationIcon(type)}"></i>
                <span>${message}</span>
            </div>
        `;
        
        // Add styles
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${getNotificationColor(type)};
            color: white;
            padding: 15px 25px;
            border-radius: 10px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
            z-index: 1000;
            animation: slideInRight 0.3s ease;
            max-width: 400px;
        `;
        
        document.body.appendChild(notification);
        
        // Remove after 5 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);
    }
    
    function getNotificationIcon(type) {
        const icons = {
            'success': 'check-circle',
            'error': 'exclamation-circle',
            'info': 'info-circle',
            'warning': 'exclamation-triangle'
        };
        return icons[type] || 'info-circle';
    }
    
    function getNotificationColor(type) {
        const colors = {
            'success': 'linear-gradient(45deg, #4CAF50, #45a049)',
            'error': 'linear-gradient(45deg, #f44336, #d32f2f)',
            'info': 'linear-gradient(45deg, #2196F3, #1976D2)',
            'warning': 'linear-gradient(45deg, #ff9800, #f57c00)'
        };
        return colors[type] || colors.info;
    }
    
    // Add CSS for notification animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOutRight {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
        
        .notification-content {
            display: flex;
            align-items: center;
            gap: 10px;
        }
    `;
    document.head.appendChild(style);
});