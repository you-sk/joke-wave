const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let width, height;
let currentMode = 'simple';
let animationId = null;

// Simple mode variables
let ripples = [];

// Physics mode variables
let cellSize = 3;
let cols, rows;
let current, previous;
let damping = 0.98;

// Modal and UI
let selectedMode = 'simple';

function setMode(mode) {
    currentMode = mode;
    
    // Update UI
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.mode === mode) {
            btn.classList.add('active');
        }
    });
    
    // Update info
    const modeTitle = document.getElementById('modeTitle');
    const modeDescription = document.getElementById('modeDescription');
    
    if (mode === 'simple') {
        modeTitle.textContent = '水面波紋 - 簡易版';
        modeDescription.textContent = 'シンプルな波紋エフェクト';
    } else {
        modeTitle.textContent = '水面波紋 - 物理シミュレーション版';
        modeDescription.textContent = '波同士が干渉して複雑なパターンを作ります';
    }
    
    // Reset and restart
    resetWaves();
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
    
    if (mode === 'simple') {
        animateSimple();
    } else {
        animatePhysics();
    }
}

// Simple mode classes and functions
class Ripple {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 0;
        this.maxRadius = Math.min(width, height) * 0.4;
        this.speed = 2;
        this.opacity = 1;
        this.lineWidth = 2;
        this.color = {
            r: 100 + Math.random() * 155,
            g: 150 + Math.random() * 105,
            b: 200 + Math.random() * 55
        };
    }

    update() {
        this.radius += this.speed;
        this.opacity = Math.max(0, 1 - (this.radius / this.maxRadius));
        this.lineWidth = Math.max(0.5, 2 * (1 - this.radius / this.maxRadius));
        
        if (this.radius > this.maxRadius * 1.2) {
            return false;
        }
        return true;
    }

    draw() {
        ctx.save();
        
        for (let i = 0; i < 3; i++) {
            const offset = i * 15;
            const opacity = this.opacity * (1 - i * 0.3);
            
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + offset, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, ${opacity * 0.6})`;
            ctx.lineWidth = this.lineWidth * (1 - i * 0.2);
            ctx.stroke();
        }
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.7, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${this.opacity * 0.3})`;
        ctx.lineWidth = this.lineWidth * 0.5;
        ctx.stroke();
        
        ctx.restore();
    }
}

function addRipple(x, y) {
    ripples.push(new Ripple(x, y));
    
    if (ripples.length > 20) {
        ripples.shift();
    }
}

function animateSimple() {
    ctx.fillStyle = 'rgba(0, 30, 60, 0.1)';
    ctx.fillRect(0, 0, width, height);
    
    ripples = ripples.filter(ripple => {
        const alive = ripple.update();
        if (alive) {
            ripple.draw();
        }
        return alive;
    });
    
    animationId = requestAnimationFrame(animateSimple);
}

// Physics mode functions
function initializeArrays() {
    cols = Math.ceil(width / cellSize);
    rows = Math.ceil(height / cellSize);
    
    current = new Float32Array(cols * rows);
    previous = new Float32Array(cols * rows);
}

function getIndex(x, y) {
    if (x < 0 || x >= cols || y < 0 || y >= rows) return -1;
    return y * cols + x;
}

function addWave(mouseX, mouseY, strength = 255) {
    const x = Math.floor(mouseX / cellSize);
    const y = Math.floor(mouseY / cellSize);
    const radius = 2;
    
    for (let i = -radius; i <= radius; i++) {
        for (let j = -radius; j <= radius; j++) {
            const dist = Math.sqrt(i * i + j * j);
            if (dist <= radius) {
                const idx = getIndex(x + i, y + j);
                if (idx !== -1) {
                    const falloff = 1 - (dist / radius);
                    current[idx] = strength * falloff;
                }
            }
        }
    }
}

function updateWaves() {
    const temp = previous;
    previous = current;
    current = temp;
    
    for (let y = 1; y < rows - 1; y++) {
        for (let x = 1; x < cols - 1; x++) {
            const idx = getIndex(x, y);
            
            const left = previous[getIndex(x - 1, y)] || 0;
            const right = previous[getIndex(x + 1, y)] || 0;
            const top = previous[getIndex(x, y - 1)] || 0;
            const bottom = previous[getIndex(x, y + 1)] || 0;
            const center = previous[idx];
            
            current[idx] = ((left + right + top + bottom) / 2 - current[idx]) * damping;
        }
    }
}

function drawWaves() {
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;
    
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const idx = getIndex(x, y);
            const value = current[idx];
            
            const startX = x * cellSize;
            const startY = y * cellSize;
            const endX = Math.min(startX + cellSize, width);
            const endY = Math.min(startY + cellSize, height);
            
            for (let pixelY = startY; pixelY < endY; pixelY++) {
                for (let pixelX = startX; pixelX < endX; pixelX++) {
                    const pixelIdx = (pixelY * width + pixelX) * 4;
                    
                    const intensity = Math.abs(value);
                    const normalized = Math.min(1, intensity / 128);
                    
                    if (value > 0) {
                        data[pixelIdx] = 50 + normalized * 150;
                        data[pixelIdx + 1] = 100 + normalized * 155;
                        data[pixelIdx + 2] = 150 + normalized * 105;
                    } else if (value < 0) {
                        data[pixelIdx] = 0 + normalized * 50;
                        data[pixelIdx + 1] = 30 + normalized * 70;
                        data[pixelIdx + 2] = 60 + normalized * 90;
                    } else {
                        data[pixelIdx] = 50;
                        data[pixelIdx + 1] = 100;
                        data[pixelIdx + 2] = 150;
                    }
                    data[pixelIdx + 3] = 255;
                }
            }
        }
    }
    
    ctx.putImageData(imageData, 0, 0);
}

function drawOverlay() {
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = '#001e3c';
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
}

function animatePhysics() {
    updateWaves();
    drawWaves();
    drawOverlay();
    animationId = requestAnimationFrame(animatePhysics);
}

// Common functions
function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    
    if (currentMode === 'physics') {
        initializeArrays();
    }
}

function resetWaves() {
    if (currentMode === 'simple') {
        ripples = [];
        ctx.clearRect(0, 0, width, height);
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, 'rgba(0, 30, 60, 0.95)');
        gradient.addColorStop(1, 'rgba(0, 61, 122, 0.95)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
    } else {
        if (current) current.fill(0);
        if (previous) previous.fill(0);
    }
}

// Event listeners
canvas.addEventListener('click', (e) => {
    if (currentMode === 'simple') {
        addRipple(e.clientX, e.clientY);
    } else {
        addWave(e.clientX, e.clientY, 200);
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (e.buttons === 1) {
        if (currentMode === 'simple') {
            if (Math.random() > 0.7) {
                addRipple(e.clientX, e.clientY);
            }
        } else {
            addWave(e.clientX, e.clientY, 150);
        }
    }
});

window.addEventListener('resize', resize);

// Mode selector buttons
document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        setMode(btn.dataset.mode);
    });
});

// Modal functions
function closeModal() {
    const modal = document.getElementById('modal');
    modal.classList.remove('active');
    setMode(selectedMode);
}

document.querySelectorAll('.mode-card').forEach(card => {
    card.addEventListener('click', () => {
        selectedMode = card.dataset.select;
        document.querySelectorAll('.mode-card').forEach(c => {
            c.style.borderColor = 'transparent';
        });
        card.style.borderColor = 'rgba(255, 255, 255, 0.8)';
    });
});

// Initialize
window.resetWaves = resetWaves;
window.closeModal = closeModal;

resize();

// Auto-start with simple mode demo
setTimeout(() => {
    for (let i = 0; i < 3; i++) {
        setTimeout(() => {
            if (currentMode === 'simple') {
                addRipple(
                    Math.random() * width,
                    Math.random() * height
                );
            }
        }, i * 500);
    }
}, 1000);