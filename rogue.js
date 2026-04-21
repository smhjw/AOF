const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI 元素
const lengthDisplay = document.getElementById('lengthDisplay');
const killDisplay = document.getElementById('killDisplay');
const expDisplay = document.getElementById('expDisplay');
const startPrompt = document.getElementById('startPrompt');
const upgradeModal = document.getElementById('upgradeModal');
const gameOverModal = document.getElementById('gameOverModal');

// 游戏常量
const gridSize = 20;
const tileCount = canvas.width / gridSize; 

// 游戏状态
let isGameStarted = false;
let isGameOver = false;
let isPaused = false;
let isGameWon = false; // 隐藏的胜利机制（满屏）

let snake = [];
let dx = 0;
let dy = 0;
let directionQueue = [];

let enemies = [];
let bullets = [];
let food = null;

let kills = 0;
let currentExp = 0;
let expToNextLevel = 5;
let lastSnakeMoveTime = 0;
const SNAKE_SPEED = 120; // 蛇移动间隔(ms)

let lastEnemySpawnTime = 0;
let enemySpawnRate = 3500;

let gameStartTime = 0;
let maxSnakeLength = 1;

// 武器配置字典
const WEAPONS = {
    'head': { color: '#2ecc71', range: 0, cd: 999999, dmg: 0, speed: 0, type: 'head' },
    'fire': { color: '#ff4757', range: 8, cd: 800, dmg: 30, speed: 0.2, type: 'fire', projColor: '#ff6b81', size: 4 },
    'ice': { color: '#70a1ff', range: 7, cd: 1200, dmg: 10, speed: 0.15, type: 'ice', projColor: '#1e90ff', size: 3, effect: 'slow' },
    'lightning': { color: '#eccc68', range: 6, cd: 400, dmg: 8, speed: 0.3, type: 'lightning', projColor: '#f1c40f', size: 2 }
};

let animationFrameId;
let lastRenderTime = 0; // 用于计算 dt

function initGame() {
    snake = [
        { x: Math.floor(tileCount/2), y: Math.floor(tileCount/2), weaponType: 'head', lastShootTime: 0 }
    ];
    dx = 0; dy = 0; directionQueue = [];
    enemies = []; bullets = []; kills = 0;
    currentExp = 0; expToNextLevel = 5;
    enemySpawnRate = 3500;
    gameStartTime = 0;
    maxSnakeLength = 1;
    
    updateStats();
    spawnFood();
    
    isGameStarted = false;
    isGameOver = false;
    isPaused = false;
    isGameWon = false;
    lastRenderTime = performance.now();
    
    startPrompt.innerHTML = '滑动或按方向键 (↑↓←→) 启动防线';
    startPrompt.style.display = 'block';
    upgradeModal.style.display = 'none';
    gameOverModal.style.display = 'none';

    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    requestAnimationFrame(gameLoop);
}

function gameLoop(timestamp) {
    if (!lastRenderTime) lastRenderTime = timestamp;
    // 核心修复：引入 Delta Time (dt)
    let dt = timestamp - lastRenderTime;
    lastRenderTime = timestamp;

    // 防止玩家切换标签页太久导致 dt 爆表（造成瞬间瞬移暴毙）
    if (dt > 100) dt = 16.67; 

    if (isGameOver) return;

    if (!isPaused && isGameStarted) {
        if (timestamp - lastSnakeMoveTime > SNAKE_SPEED) {
            moveSnake();
            lastSnakeMoveTime = timestamp;
        }

        if (timestamp - lastEnemySpawnTime > enemySpawnRate) {
            spawnEnemy();
            lastEnemySpawnTime = timestamp;
            enemySpawnRate = Math.max(600, 3500 - kills * 30); 
        }

        updateEnemies(dt);
        updateBullets(dt);
        processShooting(timestamp);
    }

    draw();
    animationFrameId = requestAnimationFrame(gameLoop);
}

// ---------------- 蛇的移动与操作 ----------------
function moveSnake() {
    if (directionQueue.length > 0) {
        const nextDir = directionQueue.shift();
        dx = nextDir.dx; dy = nextDir.dy;
    }

    const headX = snake[0].x + dx;
    const headY = snake[0].y + dy;

    if (headX < 0 || headX >= tileCount || headY < 0 || headY >= tileCount) {
        triggerGameOver(); return;
    }

    for (let i = 0; i < snake.length; i++) {
        if (headX === snake[i].x && headY === snake[i].y) {
            triggerGameOver(); return;
        }
    }

    let newSnake = [{ x: headX, y: headY, weaponType: 'head', lastShootTime: snake[0].lastShootTime }];
    
    let ateFood = false;
    if (food && headX === food.x && headY === food.y) {
        ateFood = true;
    }

    for (let i = 0; i < snake.length - (ateFood ? 0 : 1); i++) {
        newSnake.push({
            x: snake[i].x,
            y: snake[i].y,
            weaponType: snake[i+1] ? snake[i+1].weaponType : snake[i].weaponType,
            lastShootTime: snake[i+1] ? snake[i+1].lastShootTime : 0
        });
    }
    
    snake = newSnake;

    if (ateFood) {
        spawnFood();
        let hasWeapon = snake.some((s, i) => i > 0 && s.weaponType !== 'head');
        if (!hasWeapon) {
            triggerUpgrade();
        } else {
            updateStats();
        }
    }
}

function handleDirectionInput(newDx, newDy) {
    if (!isGameStarted) {
        isGameStarted = true;
        startPrompt.style.display = 'none';
        lastSnakeMoveTime = performance.now();
        gameStartTime = performance.now();
        dx = newDx;
        dy = newDy;
        return;
    }

    let lastDir = directionQueue.length > 0 ? directionQueue[directionQueue.length - 1] : { dx, dy };
    
    if (lastDir.dx === 0 && lastDir.dy === 0) {
        if (snake.length > 1 && (snake[0].x + newDx === snake[1].x && snake[0].y + newDy === snake[1].y)) {
            return;
        }
        directionQueue.push({ dx: newDx, dy: newDy });
    } 
    else if ((newDx !== -lastDir.dx || newDy !== -lastDir.dy) && 
             (newDx !== lastDir.dx || newDy !== lastDir.dy)) {
        if (directionQueue.length < 3) {
            directionQueue.push({ dx: newDx, dy: newDy });
        }
    }
}

document.addEventListener('keydown', (e) => {
    if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight", " "].indexOf(e.key) > -1) {
        e.preventDefault();
    }

    if (e.key === ' ') {
        // 如果正在选择升级，不允许通过空格解开暂停
        if (isGameOver || upgradeModal.style.display === 'flex') return;
        if (isGameStarted) {
            isPaused = !isPaused;
            draw(); // 立即渲染暂停画面
        }
        return;
    }

    // 如果游戏结束，或者游戏处于真实的“暂停”状态且不是在等待玩家起步，则忽略输入
    if (isGameOver || (isPaused && isGameStarted)) return;

    let newDx = 0, newDy = 0;
    let isDirKey = false;

    switch (e.key) {
        case 'ArrowUp': case 'w': case 'W': newDx = 0; newDy = -1; isDirKey = true; break;
        case 'ArrowDown': case 's': case 'S': newDx = 0; newDy = 1; isDirKey = true; break;
        case 'ArrowLeft': case 'a': case 'A': newDx = -1; newDy = 0; isDirKey = true; break;
        case 'ArrowRight': case 'd': case 'D': newDx = 1; newDy = 0; isDirKey = true; break;
    }

    if (isDirKey) handleDirectionInput(newDx, newDy);
});

// ---------------- 移动端触摸控制 ----------------
let touchStartX = 0;
let touchStartY = 0;
document.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
}, { passive: false });

document.addEventListener('touchmove', (e) => {
    if (e.target === canvas) e.preventDefault();
}, { passive: false });

document.addEventListener('touchend', (e) => {
    if (isGameOver || (isPaused && isGameStarted)) return;
    
    let touchEndX = e.changedTouches[0].screenX;
    let touchEndY = e.changedTouches[0].screenY;
    
    let deltaX = touchEndX - touchStartX;
    let deltaY = touchEndY - touchStartY;
    
    if (Math.abs(deltaX) > 30 || Math.abs(deltaY) > 30) {
        let newDx = 0, newDy = 0;
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            newDx = deltaX > 0 ? 1 : -1;
            newDy = 0;
        } else {
            newDx = 0;
            newDy = deltaY > 0 ? 1 : -1;
        }
        handleDirectionInput(newDx, newDy);
    } else if (e.target === canvas && isGameStarted && !isGameOver && upgradeModal.style.display !== 'flex') {
         isPaused = !isPaused;
         draw();
    }
}, { passive: false });


// ---------------- 实体逻辑 (怪、子弹) ----------------

// 修复：寻找全图空位，解决满屏死循环
function spawnFood() {
    let freeSpots = [];
    for (let x = 0; x < tileCount; x++) {
        for (let y = 0; y < tileCount; y++) {
            if (!snake.some(s => s.x === x && s.y === y)) {
                freeSpots.push({x, y});
            }
        }
    }
    
    if (freeSpots.length === 0) {
        food = null; // 满屏通关！
        return;
    }
    
    let idx = Math.floor(Math.random() * freeSpots.length);
    food = freeSpots[idx];
}

function spawnEnemy() {
    let ex, ey;
    if (Math.random() < 0.5) {
        ex = Math.random() < 0.5 ? -1 : tileCount;
        ey = Math.random() * tileCount;
    } else {
        ex = Math.random() * tileCount;
        ey = Math.random() < 0.5 ? -1 : tileCount;
    }
    
    const hp = 30 + (kills * 2);
    enemies.push({ x: ex, y: ey, hp: hp, maxHp: hp, speed: 0.03, baseSpeed: 0.03, slowTimer: 0 });
}

// 修复：引入 dt 解绑帧率
function updateEnemies(dt) {
    const timeScale = dt / 16.67; // 以 60帧 (约 16.67ms) 为基准
    const head = snake[0];
    
    for (let i = enemies.length - 1; i >= 0; i--) {
        let e = enemies[i];
        
        if (e.slowTimer > 0) {
            e.slowTimer -= dt; 
            e.speed = e.baseSpeed * 0.4; 
        } else {
            e.speed = e.baseSpeed;
        }

        let dirX = head.x - e.x;
        let dirY = head.y - e.y;
        let dist = Math.hypot(dirX, dirY);
        
        if (dist > 0) {
            e.x += (dirX / dist) * e.speed * timeScale;
            e.y += (dirY / dist) * e.speed * timeScale;
        }

        for (let s of snake) {
            if (Math.hypot(s.x - e.x, s.y - e.y) < 0.8) {
                triggerGameOver();
                return;
            }
        }
    }
}

function processShooting(timestamp) {
    for (let i = 1; i < snake.length; i++) {
        let seg = snake[i];
        let weapon = WEAPONS[seg.weaponType];
        if (!weapon || weapon.type === 'head') continue;

        if (timestamp - seg.lastShootTime > weapon.cd) {
            let target = null;
            let minDist = weapon.range;

            for (let e of enemies) {
                let d = Math.hypot(e.x - seg.x, e.y - seg.y);
                if (d < minDist) {
                    minDist = d;
                    target = e;
                }
            }

            if (target) {
                let dirX = target.x - seg.x;
                let dirY = target.y - seg.y;
                let dist = Math.hypot(dirX, dirY);
                bullets.push({
                    x: seg.x, y: seg.y,
                    vx: (dirX / dist) * weapon.speed,
                    vy: (dirY / dist) * weapon.speed,
                    dmg: weapon.dmg,
                    type: weapon.type,
                    color: weapon.projColor,
                    size: weapon.size,
                    effect: weapon.effect
                });
                seg.lastShootTime = timestamp;
            }
        }
    }
}

// 修复：引入 dt 解绑子弹帧率
function updateBullets(dt) {
    const timeScale = dt / 16.67;
    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i];
        b.x += b.vx * timeScale;
        b.y += b.vy * timeScale;

        if (b.x < -2 || b.x > tileCount+2 || b.y < -2 || b.y > tileCount+2) {
            bullets.splice(i, 1);
            continue;
        }

        let hit = false;
        for (let j = enemies.length - 1; j >= 0; j--) {
            let e = enemies[j];
            if (Math.hypot(b.x - e.x, b.y - e.y) < 0.6) { 
                e.hp -= b.dmg;
                hit = true;
                
                if (b.effect === 'slow') {
                    e.slowTimer = 2000; 
                }

                if (e.hp <= 0) {
                    enemies.splice(j, 1);
                    kills++;
                    currentExp++;
                    if (currentExp >= expToNextLevel) {
                        triggerUpgrade();
                    }
                    updateStats();
                }
                break; 
            }
        }
        if (hit) bullets.splice(i, 1);
    }
}

// ---------------- 渲染与 UI ----------------

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(138, 43, 226, 0.04)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= canvas.width; i += gridSize) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
    }

    if (food) {
        ctx.shadowBlur = 6;
        ctx.shadowColor = '#d8bc61';
        ctx.fillStyle = '#e2bd2f';
        ctx.beginPath();
        ctx.arc(food.x * gridSize + gridSize/2, food.y * gridSize + gridSize/2, gridSize/2 - 2, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(food.x * gridSize + gridSize/2, food.y * gridSize + gridSize/2, gridSize/4, 0, Math.PI*2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    for (let b of bullets) {
        // 完全移除子弹辉光，减轻快速运动物体的视觉疲劳
        ctx.shadowBlur = 0;
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(b.x * gridSize + gridSize/2, b.y * gridSize + gridSize/2, b.size, 0, Math.PI*2);
        ctx.fill();
    }

    for (let i = snake.length - 1; i >= 0; i--) {
        let seg = snake[i];
        let color = WEAPONS[seg.weaponType].color;
        
        ctx.fillStyle = color;
        if (i === 0) {
            ctx.shadowBlur = 4; ctx.shadowColor = color;
            ctx.fillRect(seg.x * gridSize + 1, seg.y * gridSize + 1, gridSize - 2, gridSize - 2);
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#f0f0f0';
            ctx.fillRect(seg.x * gridSize + 5, seg.y * gridSize + 5, 3, 3);
            ctx.fillRect(seg.x * gridSize + 12, seg.y * gridSize + 5, 3, 3);
        } else {
            ctx.beginPath();
            ctx.arc(seg.x * gridSize + gridSize/2, seg.y * gridSize + gridSize/2, gridSize/2 - 1, 0, Math.PI*2);
            ctx.fill();
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.beginPath();
            ctx.arc(seg.x * gridSize + gridSize/2, seg.y * gridSize + gridSize/2, 2, 0, Math.PI*2);
            ctx.fill();
        }
    }

    for (let e of enemies) {
        let px = e.x * gridSize;
        let py = e.y * gridSize;
        
        // 调整敌人的颜色
        ctx.fillStyle = e.slowTimer > 0 ? '#6ca0eb' : '#e65c68';
        ctx.beginPath();
        ctx.moveTo(px + gridSize/2, py);
        ctx.lineTo(px + gridSize, py + gridSize);
        ctx.lineTo(px, py + gridSize);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#2c2c38';
        ctx.fillRect(px, py - 6, gridSize, 3);
        ctx.fillStyle = '#3db26b';
        ctx.fillRect(px, py - 6, gridSize * (Math.max(0, e.hp) / e.maxHp), 3);
    }
    
    // 暂停 UI 遮罩
    if (isPaused && upgradeModal.style.display !== 'flex') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#e2bd2f';
        ctx.font = 'bold 30px Poppins, Arial';
        ctx.textAlign = 'center';
        ctx.fillText('已暂停 PAUSED', canvas.width / 2, canvas.height / 2);
    }
}

// ---------------- 游戏流程控制 ----------------

function updateStats() {
    lengthDisplay.innerText = snake.length;
    killDisplay.innerText = kills;
    if (snake.length > maxSnakeLength) maxSnakeLength = snake.length;

    const pct = Math.floor((currentExp / expToNextLevel) * 100);
    if (expDisplay) {
        expDisplay.innerText = pct + '%';
    }
    const expBarFill = document.getElementById('expBarFill');
    if (expBarFill) {
        expBarFill.style.width = pct + '%';
    }
}

function triggerUpgrade() {
    isPaused = true;
    upgradeModal.style.display = 'flex';
}

function selectUpgrade(type) {
    let upgraded = false;
    for (let i = snake.length - 1; i >= 1; i--) {
        if (snake[i].weaponType === 'head') {
            snake[i].weaponType = type;
            upgraded = true;
            break;
        }
    }
    if (!upgraded && snake.length > 1) {
        snake[snake.length - 1].weaponType = type;
    }

    currentExp = 0;
    expToNextLevel = Math.min(15, 5 + Math.floor(kills / 5));

    upgradeModal.style.display = 'none';
    updateStats();

    isPaused = false;
    isGameStarted = false;
    directionQueue = [];
    startPrompt.innerHTML = '升级完成！<br><span style="font-size:16px; color:#a0a5b5;">滑动或按方向键继续</span>';
    startPrompt.style.display = 'block';
}

function formatTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return min > 0 ? min + 'm ' + sec + 's' : sec + 's';
}

function triggerGameOver() {
    isGameOver = true;
    const survivalTime = gameStartTime > 0 ? performance.now() - gameStartTime : 0;
    document.getElementById('finalLength').innerText = snake.length;
    document.getElementById('finalKills').innerText = kills;
    document.getElementById('finalTime').innerText = formatTime(survivalTime);
    document.getElementById('finalMaxLen').innerText = maxSnakeLength;
    document.getElementById('gameOverTitle').innerText = '堡垒被摧毁！';
    document.getElementById('gameOverTitle').style.color = '#ff4757';
    gameOverModal.style.display = 'flex';
}

function triggerWin() {
    isGameOver = true;
    isGameWon = true;
    const survivalTime = gameStartTime > 0 ? performance.now() - gameStartTime : 0;
    document.getElementById('gameOverTitle').innerText = '🏆 堡垒化身神明！';
    document.getElementById('gameOverTitle').style.color = '#f1c40f';
    document.getElementById('finalLength').innerText = snake.length + ' (满级)';
    document.getElementById('finalKills').innerText = kills;
    document.getElementById('finalTime').innerText = formatTime(survivalTime);
    document.getElementById('finalMaxLen').innerText = maxSnakeLength;
    gameOverModal.style.display = 'flex';
}

initGame();