class SolsticeRunner {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();
        
        // Game state
        this.gameActive = false;
        this.gamePaused = false;
        this.difficulty = 'normal';
        
        // Player
        this.player = {
            x: 100,
            y: 0,
            width: 30,
            height: 40,
            velocityY: 0,
            jumping: false,
            color: '#FFD700'
        };
        
        // Game mechanics
        this.daylight = 100; // Player health/energy
        this.time = 6; // 6:00 AM start
        this.timeMinutes = 0;
        this.score = 0;
        this.gameStartTime = 0;
        this.daylightDecayRate = 0.15; // Per frame
        
        // Difficulty settings
        this.difficultySettings = {
            easy: {
                daylightDecayRate: 0.08,
                obstacleSpawnRate: 0.02,
                lightSpawnRate: 0.05,
                obstacleSpeed: 3,
                speedMultiplier: 0.8
            },
            normal: {
                daylightDecayRate: 0.15,
                obstacleSpawnRate: 0.03,
                lightSpawnRate: 0.04,
                obstacleSpeed: 5,
                speedMultiplier: 1
            },
            hard: {
                daylightDecayRate: 0.25,
                obstacleSpawnRate: 0.05,
                lightSpawnRate: 0.02,
                obstacleSpeed: 7,
                speedMultiplier: 1.3
            }
        };
        
        // Obstacles and collectibles
        this.obstacles = [];
        this.lightRays = [];
        this.particles = [];
        
        // Input handling
        this.keys = {};
        this.setupEventListeners();
        
        // Background scrolling
        this.scrollX = 0;
    }
    
    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.groundY = this.canvas.height - 80;
        this.player.y = this.groundY;
    }
    
    setupEventListeners() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.key] = true;
            if ((e.key === ' ' || e.key === 'ArrowUp') && this.gameActive) {
                this.playerJump();
            }
        });
        
        window.addEventListener('keyup', (e) => {
            this.keys[e.key] = false;
        });
        
        window.addEventListener('resize', () => this.resizeCanvas());
    }
    
    playerJump() {
        if (!this.player.jumping && this.gameActive) {
            this.player.velocityY = -15;
            this.player.jumping = true;
        }
    }
    
    startGame(difficulty = 'normal') {
        this.difficulty = difficulty;
        const settings = this.difficultySettings[difficulty];
        this.daylightDecayRate = settings.daylightDecayRate;
        
        document.getElementById('startScreen').style.display = 'none';
        this.gameActive = true;
        this.gameStartTime = Date.now();
        this.daylight = 100;
        this.time = 6;
        this.timeMinutes = 0;
        this.score = 0;
        this.scrollX = 0;
        this.obstacles = [];
        this.lightRays = [];
        this.particles = [];
        
        this.gameLoop();
    }
    
    update() {
        if (!this.gameActive) return;
        
        const settings = this.difficultySettings[this.difficulty];
        
        // Update player physics
        this.player.velocityY += 0.6; // Gravity
        this.player.y += this.player.velocityY;
        
        // Ground collision
        if (this.player.y >= this.groundY) {
            this.player.y = this.groundY;
            this.player.jumping = false;
            this.player.velocityY = 0;
        }
        
        // Boundary checks
        if (this.player.y < 0) {
            this.player.y = 0;
            this.player.velocityY = 0;
        }
        
        // Daylight decay
        this.daylight -= this.daylightDecayRate;
        
        // Time progression (1 real second = ~1 game minute, speed up for demo)
        this.timeMinutes += 0.05; // Adjust for desired game speed
        if (this.timeMinutes >= 60) {
            this.time += 1;
            this.timeMinutes = 0;
        }
        
        // Win condition: reach midnight (24:00 or past)
        if (this.time >= 24) {
            this.endGameWin();
            return;
        }
        
        // Lose condition: no daylight left
        if (this.daylight <= 0) {
            this.endGameLose();
            return;
        }
        
        // Spawn obstacles
        if (Math.random() < settings.obstacleSpawnRate) {
            this.spawnObstacle();
        }
        
        // Spawn light rays
        if (Math.random() < settings.lightSpawnRate) {
            this.spawnLightRay();
        }
        
        // Update obstacles
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            this.obstacles[i].x -= settings.obstacleSpeed * settings.speedMultiplier;
            
            // Check collision with player
            if (this.checkCollision(this.player, this.obstacles[i])) {
                this.daylight -= 20;
                this.createParticles(this.obstacles[i].x, this.obstacles[i].y, '#333333', 10);
                this.obstacles.splice(i, 1);
                continue;
            }
            
            // Remove off-screen obstacles
            if (this.obstacles[i].x < -50) {
                this.obstacles.splice(i, 1);
            }
        }
        
        // Update light rays
        for (let i = this.lightRays.length - 1; i >= 0; i--) {
            this.lightRays[i].x -= 3 * settings.speedMultiplier;
            this.lightRays[i].y += Math.sin(this.lightRays[i].x * 0.02) * 0.5;
            
            // Check collision with player
            if (this.checkCollision(this.player, this.lightRays[i])) {
                this.daylight = Math.min(100, this.daylight + 15);
                this.score += 10;
                this.createParticles(this.lightRays[i].x, this.lightRays[i].y, '#FFD700', 15);
                this.lightRays.splice(i, 1);
                continue;
            }
            
            // Remove off-screen rays
            if (this.lightRays[i].x < -50) {
                this.lightRays.splice(i, 1);
            }
        }
        
        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update();
            if (this.particles[i].life <= 0) {
                this.particles.splice(i, 1);
            }
        }
        
        // Camera follow
        this.scrollX += 2 * settings.speedMultiplier;
        
        // Score bonus: survive longer
        this.score += Math.floor(this.time - 6) * 5;
    }
    
    checkCollision(rect1, rect2) {
        return rect1.x < rect2.x + rect2.width &&
               rect1.x + rect1.width > rect2.x &&
               rect1.y < rect2.y + rect2.height &&
               rect1.y + rect1.height > rect2.y;
    }
    
    spawnObstacle() {
        const height = Math.random() * 30 + 20;
        this.obstacles.push({
            x: this.canvas.width,
            y: this.groundY - height,
            width: 25,
            height: height,
            color: '#333333'
        });
    }
    
    spawnLightRay() {
        this.lightRays.push({
            x: this.canvas.width,
            y: Math.random() * (this.canvas.height * 0.7),
            width: 20,
            height: 20,
            color: '#FFD700'
        });
    }
    
    createParticles(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            this.particles.push(new Particle(x, y, color));
        }
    }
    
    draw() {
        // Dynamic background based on time
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        
        if (this.time < 12) {
            // Morning: sunrise colors
            const progress = (this.time - 6) / 6;
            gradient.addColorStop(0, `hsl(${60 + progress * 30}, 100%, ${60 + progress * 10}%)`);
            gradient.addColorStop(1, `hsl(${30 + progress * 30}, 100%, ${80 + progress * 10}%)`);
        } else if (this.time < 18) {
            // Afternoon: bright
            gradient.addColorStop(0, '#87CEEB');
            gradient.addColorStop(0.5, '#E0F6FF');
            gradient.addColorStop(1, '#FFD700');
        } else {
            // Evening/Night: sunset colors
            const progress = (this.time - 18) / 6;
            gradient.addColorStop(0, `hsl(${270 - progress * 100}, 80%, ${40 - progress * 30}%)`);
            gradient.addColorStop(0.5, `hsl(${30 + progress * 20}, 100%, ${50 - progress * 30}%)`);
            gradient.addColorStop(1, `hsl(${0 + progress * 270}, 80%, ${20 - progress * 15}%)`);
        }
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw ground
        this.ctx.fillStyle = '#8B7355';
        this.ctx.fillRect(0, this.groundY, this.canvas.width, this.canvas.height - this.groundY);
        
        // Draw grass
        this.ctx.fillStyle = '#228B22';
        this.ctx.fillRect(0, this.groundY, this.canvas.width, 10);
        
        // Draw player
        this.ctx.fillStyle = this.player.color;
        this.ctx.fillRect(this.player.x, this.player.y, this.player.width, this.player.height);
        
        // Player glow
        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = '#FFD700';
        this.ctx.strokeStyle = '#FFD700';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(this.player.x - 2, this.player.y - 2, this.player.width + 4, this.player.height + 4);
        this.ctx.shadowBlur = 0;
        
        // Draw obstacles
        for (const obstacle of this.obstacles) {
            this.ctx.fillStyle = obstacle.color;
            this.ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
            
            // Obstacle glow
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = '#FF0000';
            this.ctx.strokeStyle = '#FF6B6B';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
            this.ctx.shadowBlur = 0;
        }
        
        // Draw light rays
        for (const ray of this.lightRays) {
            // Glow effect
            this.ctx.shadowBlur = 20;
            this.ctx.shadowColor = '#FFD700';
            
            this.ctx.fillStyle = '#FFD700';
            this.ctx.beginPath();
            this.ctx.arc(ray.x + ray.width / 2, ray.y + ray.height / 2, 10, 0, Math.PI * 2);
            this.ctx.fill();
            
            this.ctx.shadowBlur = 0;
        }
        
        // Draw particles
        for (const particle of this.particles) {
            particle.draw(this.ctx);
        }
    }
    
    updateUI() {
        // Update health bar
        const healthFill = document.getElementById('healthFill');
        healthFill.style.width = Math.max(0, this.daylight) + '%';
        document.getElementById('healthValue').textContent = Math.max(0, Math.floor(this.daylight)) + '%';
        
        // Update time
        const hours = Math.floor(this.time);
        const minutes = Math.floor(this.timeMinutes);
        document.getElementById('timeValue').textContent = 
            String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
        
        // Update score
        document.getElementById('scoreValue').textContent = Math.floor(this.score);
    }
    
    endGameLose() {
        this.gameActive = false;
        const finalTime = String(Math.floor(this.time)).padStart(2, '0') + ':' + 
                          String(Math.floor(this.timeMinutes)).padStart(2, '0');
        
        document.getElementById('gameOverTitle').textContent = '🌑 Darkness Falls';
        document.getElementById('gameOverMessage').textContent = 
            'Your daylight ran out before the solstice cycle was complete.';
        document.getElementById('finalTime').textContent = finalTime;
        document.getElementById('finalScore').textContent = Math.floor(this.score);
        document.getElementById('gameOverScreen').classList.remove('hidden');
    }
    
    endGameWin() {
        this.gameActive = false;
        const survivalTime = String(Math.floor(this.time - 6)).padStart(2, '0') + ':' + 
                             String(Math.floor(this.timeMinutes)).padStart(2, '0');
        
        document.getElementById('survivalTime').textContent = survivalTime;
        document.getElementById('winScore').textContent = Math.floor(this.score);
        document.getElementById('winScreen').classList.remove('hidden');
    }
    
    gameLoop() {
        this.update();
        this.draw();
        this.updateUI();
        
        if (this.gameActive) {
            requestAnimationFrame(() => this.gameLoop());
        }
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 8;
        this.vy = (Math.random() - 0.5) * 8 - 2;
        this.life = 1;
        this.color = color;
        this.size = Math.random() * 4 + 2;
    }
    
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.3; // Gravity
        this.life -= 0.02;
    }
    
    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.globalAlpha = this.life;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

// Initialize game
const game = new SolsticeRunner();

// Make startGame globally accessible
window.startGame = (difficulty) => game.startGame(difficulty);
