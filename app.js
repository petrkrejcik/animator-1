const imageContainer = document.getElementById('imageContainer');
const addImageBtn = document.getElementById('addImageBtn');
const createAnimationBtn = document.getElementById('createAnimation');
const downloadBtn = document.getElementById('downloadBtn');
const durationInput = document.getElementById('duration');
const animationPreview = document.getElementById('animationPreview');
const maskingContainer = document.getElementById('maskingContainer');
const maskingCanvasContainer = document.getElementById('maskingCanvas');
const brushSizeInput = document.getElementById('brushSize');
const clearMaskBtn = document.getElementById('clearMask');
const confirmMaskBtn = document.getElementById('confirmMask');

let images = new Map();
let nextImageId = 3;
let maskCanvas, maskCtx;
let baseCanvas, baseCtx;
let isDrawing = false;
let maskData = null;

function loadImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function updatePreview(previewElement, file) {
    loadImage(file).then(img => {
        previewElement.innerHTML = '';
        previewElement.appendChild(img);
    });
}

function createCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
}

function initializeMaskingCanvas(baseImage) {
    maskingCanvasContainer.innerHTML = '';
    
    baseCanvas = createCanvas(baseImage.width, baseImage.height);
    baseCanvas.style.position = 'absolute';
    baseCtx = baseCanvas.getContext('2d');
    baseCtx.drawImage(baseImage, 0, 0);
    
    maskCanvas = createCanvas(baseImage.width, baseImage.height);
    maskCanvas.style.position = 'absolute';
    maskCtx = maskCanvas.getContext('2d');
    
    const containerDiv = document.createElement('div');
    containerDiv.style.position = 'relative';
    containerDiv.style.width = '100%';
    containerDiv.style.paddingTop = `${(baseImage.height / baseImage.width) * 100}%`;
    
    const canvasWrapper = document.createElement('div');
    canvasWrapper.style.position = 'absolute';
    canvasWrapper.style.top = '0';
    canvasWrapper.style.left = '0';
    canvasWrapper.style.width = '100%';
    canvasWrapper.style.height = '100%';
    
    canvasWrapper.appendChild(baseCanvas);
    canvasWrapper.appendChild(maskCanvas);
    containerDiv.appendChild(canvasWrapper);
    maskingCanvasContainer.appendChild(containerDiv);
    
    setupDrawingEvents();
}

function setupDrawingEvents() {
    let lastX = 0;
    let lastY = 0;
    
    function draw(e) {
        if (!isDrawing) return;
        
        const rect = maskCanvas.getBoundingClientRect();
        const scaleX = maskCanvas.width / rect.width;
        const scaleY = maskCanvas.height / rect.height;
        
        const x = (e.clientX || e.touches[0].clientX) - rect.left * scaleX;
        const y = (e.clientY || e.touches[0].clientY) - rect.top * scaleY;
        
        maskCtx.beginPath();
        maskCtx.moveTo(lastX, lastY);
        maskCtx.lineTo(x, y);
        maskCtx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        maskCtx.lineWidth = parseInt(brushSizeInput.value);
        maskCtx.lineCap = 'round';
        maskCtx.stroke();
        
        lastX = x;
        lastY = y;
    }
    
    maskCanvas.addEventListener('mousedown', (e) => {
        isDrawing = true;
        const rect = maskCanvas.getBoundingClientRect();
        const scaleX = maskCanvas.width / rect.width;
        const scaleY = maskCanvas.height / rect.height;
        lastX = (e.clientX - rect.left) * scaleX;
        lastY = (e.clientY - rect.top) * scaleY;
    });
    
    maskCanvas.addEventListener('mousemove', draw);
    maskCanvas.addEventListener('mouseup', () => isDrawing = false);
    maskCanvas.addEventListener('mouseout', () => isDrawing = false);
    
    maskCanvas.addEventListener('touchstart', (e) => {
        isDrawing = true;
        const rect = maskCanvas.getBoundingClientRect();
        const scaleX = maskCanvas.width / rect.width;
        const scaleY = maskCanvas.height / rect.height;
        lastX = (e.touches[0].clientX - rect.left) * scaleX;
        lastY = (e.touches[0].clientY - rect.top) * scaleY;
    });
    
    maskCanvas.addEventListener('touchmove', draw);
    maskCanvas.addEventListener('touchend', () => isDrawing = false);
    maskCanvas.addEventListener('touchcancel', () => isDrawing = false);
}

function createUploadSection(id) {
    const div = document.createElement('div');
    div.className = 'upload-section';
    div.innerHTML = `
        <label for="image${id}" class="upload-label">
            <div class="upload-placeholder" id="preview${id}">
                <span>Upload Image ${id}</span>
            </div>
        </label>
        <input type="file" id="image${id}" accept="image/*" class="file-input">
        <button class="remove-button" data-index="${id}" style="display: none;">×</button>
    `;
    
    const input = div.querySelector(`#image${id}`);
    const removeBtn = div.querySelector('.remove-button');
    const preview = div.querySelector(`#preview${id}`);
    
    input.addEventListener('change', (e) => {
        if (e.target.files[0]) {
            const file = e.target.files[0];
            updatePreview(preview, file);
            loadImage(file).then(img => {
                images.set(id, img);
                removeBtn.style.display = 'flex';
                checkCanCreate();
            });
        }
    });
    
    removeBtn.addEventListener('click', () => {
        images.delete(id);
        div.remove();
        checkCanCreate();
    });
    
    return div;
}

async function createWebPAnimation(imageList, duration) {
    const firstImage = imageList.get(1);
    const maxWidth = firstImage.width;
    const maxHeight = firstImage.height;
    
    const canvas = createCanvas(maxWidth, maxHeight);
    const ctx = canvas.getContext('2d');
    
    const frames = [];
    const mask = maskData ? maskCtx.getImageData(0, 0, maxWidth, maxHeight).data : null;
    
    ctx.drawImage(firstImage, 0, 0);
    frames.push(canvas.toDataURL('image/webp', 0.9));
    
    for (const [id, img] of imageList) {
        if (id === 1) continue;
        
        ctx.drawImage(firstImage, 0, 0);
        
        if (mask) {
            const tempCanvas = createCanvas(maxWidth, maxHeight);
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(img, 0, 0);
            
            const baseImageData = ctx.getImageData(0, 0, maxWidth, maxHeight);
            const frameImageData = tempCtx.getImageData(0, 0, maxWidth, maxHeight);
            
            for (let i = 0; i < mask.length; i += 4) {
                if (mask[i] > 0) {
                    baseImageData.data[i] = frameImageData.data[i];
                    baseImageData.data[i + 1] = frameImageData.data[i + 1];
                    baseImageData.data[i + 2] = frameImageData.data[i + 2];
                    baseImageData.data[i + 3] = frameImageData.data[i + 3];
                }
            }
            
            ctx.putImageData(baseImageData, 0, 0);
        } else {
            ctx.drawImage(img, 0, 0);
        }
        
        frames.push(canvas.toDataURL('image/webp', 0.9));
    }
    
    return frames;
}

function previewAnimation(frames, duration) {
    const img = document.createElement('img');
    animationPreview.innerHTML = '';
    animationPreview.appendChild(img);
    
    let currentFrame = 0;
    const frameInterval = duration / frames.length;
    
    setInterval(() => {
        img.src = frames[currentFrame];
        currentFrame = (currentFrame + 1) % frames.length;
    }, frameInterval);
}

function downloadAnimation(frames) {
    const link = document.createElement('a');
    link.href = frames[0];
    link.download = 'animation-frame.webp';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function checkCanCreate() {
    const hasEnoughImages = images.size >= 2;
    createAnimationBtn.disabled = !hasEnoughImages;
    
    if (hasEnoughImages && images.has(1)) {
        maskingContainer.style.display = 'block';
        initializeMaskingCanvas(images.get(1));
    } else {
        maskingContainer.style.display = 'none';
    }
}

addImageBtn.addEventListener('click', () => {
    imageContainer.appendChild(createUploadSection(nextImageId++));
});

clearMaskBtn.addEventListener('click', () => {
    if (maskCtx) {
        maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
        maskData = null;
    }
});

confirmMaskBtn.addEventListener('click', () => {
    if (maskCtx) {
        maskData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    }
});

document.querySelectorAll('.file-input').forEach((input, index) => {
    const id = index + 1;
    const removeBtn = input.parentElement.querySelector('.remove-button');
    const preview = document.getElementById(`preview${id}`);
    
    input.addEventListener('change', (e) => {
        if (e.target.files[0]) {
            const file = e.target.files[0];
            updatePreview(preview, file);
            loadImage(file).then(img => {
                images.set(id, img);
                removeBtn.style.display = 'flex';
                checkCanCreate();
            });
        }
    });
    
    removeBtn.addEventListener('click', () => {
        images.delete(id);
        input.value = '';
        preview.innerHTML = `<span>Upload Image ${id}</span>`;
        removeBtn.style.display = 'none';
        checkCanCreate();
    });
});

createAnimationBtn.addEventListener('click', async () => {
    if (images.size >= 2) {
        const duration = parseInt(durationInput.value);
        const frames = await createWebPAnimation(images, duration);
        previewAnimation(frames, duration);
        downloadBtn.disabled = false;
        downloadBtn.onclick = () => downloadAnimation(frames);
    }
});
