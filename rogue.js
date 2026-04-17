const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI 元素
const lengthDisplay = document.getElementById('lengthDisplay');
const killDisplay = document.getElementById('killDisplay');
const startPrompt = document.getElementById('startPrompt');
const upgradeModal = document.getElementById('upgradeModal');
const gameOverModal = document.getElementById('gameOverModal');

// 游戏常量
const gridSize = 20;
const tileCountX = canvas.width / gridSize;
const tileCountY = canvas.height / gridSize;

// 游戏状态
let isGameStarted = false;
let isGameOver = false;
let isPaused = false;

// 实体数组
// snake: [{x, y, weaponType, lastShootTime}]
let snake = [];
let dx = 0;
let dy = 0;
let directionQueue = [];

let enemies = [];
let bullets = [];
let food = null;

let kills = 0;
let lastSnakeMoveTime = 0;
const SNAKE_SPEED = 120; // 蛇移动间隔(ms)

let lastEnemySpawnTime = 0;
let enemySpawnRate = 2000; // 初始两秒刷一个怪

// 武器配置字典
const WEAPONS = {
    'head': { color: '#2ecc71', range: 0, cd: 999999, dmg: 0, speed: 0, type: 'head' },
    'fire': { color: '#ff4757', range: 8, cd: 800, dmg: 30, speed: 0.2, type: 'fire', projColor: '#ff6b81', size: 4 },
    'ice': { color: '#70a1ff', range: 7, cd: 1200, dmg: 10, speed: 0.15, type: 'ice', projColor: '#1e90ff', size: 3, effect: 'slow' },
    'lightning': { color: '#eccc68', range: 6, cd: 400, dmg: 8, speed: 0.3, type: 'lightning', projColor: '#f1c40f', size: 2 }
};

// 动画循环 ID
let animationFrameId;

function initGame() {
    snake = [
        { x: Math.floor(tileCountX/2), y: Math.floor(tileCountY/2), weaponType: 'head', lastShootTime: 0 }
    ];
    dx = 0; dy = 0; directionQueue = [];
    enemies = []; bullets = []; kills = 0;
    enemySpawnRate = 2000;
    
    updateStats();
    spawnFood();
    
    isGameStarted = false;
    isGameOver = false;
    isPaused = false;
    
    startPrompt.innerHTML = '按方向键 (↑↓←→) 启动防线';
    startPrompt.style.display = 'block';
    upgradeModal.style.display = 'none';
    gameOverModal.style.display = 'none';

    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    requestAnimationFrame(gameLoop);
}

function gameLoop(timestamp) {
    if (isGameOver) return;

    if (!isPaused && isGameStarted) {
        // 1. 蛇体网格移动逻辑
        if (timestamp - lastSnakeMoveTime > SNAKE_SPEED) {
            moveSnake();
            lastSnakeMoveTime = timestamp;
        }

        // 2. 刷怪逻辑 (随击杀数加快刷新)
        if (timestamp - lastEnemySpawnTime > enemySpawnRate) {
            spawnEnemy();
            lastEnemySpawnTime = timestamp;
            enemySpawnRate = Math.max(400, 2000 - kills * 20); // 最快0.4秒一个
        }

        // 3. 实时逻辑更新 (不锁帧，实现平滑移动)
        updateEnemies();
        updateBullets();
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

    // 撞墙死亡
    if (headX < 0 || headX >= tileCountX || headY < 0 || headY >= tileCountY) {
        triggerGameOver(); return;
    }

    // 撞到自己身体死亡
    for (let i = 0; i < snake.length; i++) {
        if (headX === snake[i].x && headY === snake[i].y) {
            triggerGameOver(); return;
        }
    }

    // 移动身体：在头部插入新坐标，弹出尾部（除非吃到食物）
    // 注意：我们要继承原位置的武器属性
    let newSnake = [{ x: headX, y: headY, weaponType: 'head', lastShootTime: snake[0].lastShootTime }];
    
    let ateFood = false;
    if (headX === food.x && headY === food.y) {
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

    // 吃到食物，触发肉鸽升级！
    if (ateFood) {
        triggerUpgrade();
    }
}

document.addEventListener('keydown', (e) => {
    if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight", " "].indexOf(e.key) > -1) {
        e.preventDefault();
    }

    if (isGameOver || isPaused) return;

    let newDx = 0;
    let newDy = 0;
    let isDirKey = false;

    switch (e.key) {
        case 'ArrowUp': case 'w': case 'W': newDx = 0; newDy = -1; isDirKey = true; break;
        case 'ArrowDown': case 's': case 'S': newDx = 0; newDy = 1; isDirKey = true; break;
        case 'ArrowLeft': case 'a': case 'A': newDx = -1; newDy = 0; isDirKey = true; break;
        case 'ArrowRight': case 'd': case 'D': newDx = 1; newDy = 0; isDirKey = true; break;
    }

    if (isDirKey) {
        if (!isGameStarted) {
            isGameStarted = true;
            startPrompt.style.display = 'none';
            lastSnakeMoveTime = performance.now();
            dx = newDx; // 立即赋予方向，不用只进队列
            dy = newDy;
            return;
        }

        // 取出当前队列中最后一次注册的方向
        let lastDir = directionQueue.length > 0 ? directionQueue[directionQueue.length - 1] : { dx, dy };
        
        // 1. 如果还在原地没动过 (lastDir为0,0)，接受任何方向
        if (lastDir.dx === 0 && lastDir.dy === 0) {
            directionQueue.push({ dx: newDx, dy: newDy });
        } 
        // 2. 如果已经在移动，拦截“180度掉头”和“重复按下同个方向”的操作
        else if ((newDx !== -lastDir.dx || newDy !== -lastDir.dy) && 
                 (newDx !== lastDir.dx || newDy !== lastDir.dy)) {
            if (directionQueue.length < 3) {
                directionQueue.push({ dx: newDx, dy: newDy });
            }
        }
    }
});

// ---------------- 实体逻辑 (怪、子弹) ----------------

function spawnFood() {
    while (true) {
        let fx = Math.floor(Math.random() * tileCount);
        let fy = Math.floor(Math.random() * tileCount);
        // 确保食物不刷在蛇身上
        if (!snake.some(s => s.x === fx && s.y === fy)) {
            food = { x: fx, y: fy };
            break;
        }
    }
}

function spawnEnemy() {
    // 在屏幕边缘随机生成敌人
    let ex, ey;
    if (Math.random() < 0.5) {
        ex = Math.random() < 0.5 ? -1 : tileCount;
        ey = Math.random() * tileCount;
    } else {
        ex = Math.random() * tileCount;
        ey = Math.random() < 0.5 ? -1 : tileCount;
    }
    
    // 随时间增加血量
    const hp = 30 + (kills * 2);
    enemies.push({ x: ex, y: ey, hp: hp, maxHp: hp, speed: 0.03, baseSpeed: 0.03, slowTimer: 0 });
}

function updateEnemies() {
    const head = snake[0];
    for (let i = enemies.length - 1; i >= 0; i--) {
        let e = enemies[i];
        
        // 减速debuff处理
        if (e.slowTimer > 0) {
            e.slowTimer -= 16; // 大约一帧的时间
            e.speed = e.baseSpeed * 0.4; // 减速60%
        } else {
            e.speed = e.baseSpeed;
        }

        // 敌人永远追踪蛇头
        let dirX = head.x - e.x;
        let dirY = head.y - e.y;
        let dist = Math.hypot(dirX, dirY);
        
        if (dist > 0) {
            e.x += (dirX / dist) * e.speed;
            e.y += (dirY / dist) * e.speed;
        }

        // 碰撞检测：如果敌人碰到蛇头或蛇身任何部位
        for (let s of snake) {
            if (Math.hypot(s.x - e.x, s.y - e.y) < 0.8) {
                // 暂时设定被摸到直接游戏结束（后续可做成扣血）
                triggerGameOver();
                return;
            }
        }
    }
}

function processShooting(timestamp) {
    // 遍历蛇身（跳过蛇头），找怪射击
    for (let i = 1; i < snake.length; i++) {
        let seg = snake[i];
        let weapon = WEAPONS[seg.weaponType];
        if (!weapon || weapon.type === 'head') continue;

        if (timestamp - seg.lastShootTime > weapon.cd) {
            // 找最近的敌人
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
                // 开火！
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

function updateBullets() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i];
        b.x += b.vx;
        b.y += b.vy;

        // 子弹飞出屏幕销毁
        if (b.x < -2 || b.x > tileCount+2 || b.y < -2 || b.y > tileCount+2) {
            bullets.splice(i, 1);
            continue;
        }

        // 子弹打怪检测
        let hit = false;
        for (let j = enemies.length - 1; j >= 0; j--) {
            let e = enemies[j];
            if (Math.hypot(b.x - e.x, b.y - e.y) < 0.6) { // 命中判定半径
                e.hp -= b.dmg;
                hit = true;
                
                // 应用特效
                if (b.effect === 'slow') {
                    e.slowTimer = 2000; // 减速2秒
                }

                // 怪物死亡
                if (e.hp <= 0) {
                    enemies.splice(j, 1);
                    kills++;
                    updateStats();
                }
                break; // 一发子弹只打一个怪
            }
        }
        if (hit) bullets.splice(i, 1);
    }
}

// ---------------- 渲染与 UI ----------------

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 画网格暗纹
    ctx.strokeStyle = 'rgba(138, 43, 226, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= canvas.width; i += gridSize) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
    }

    // 画食物 (升级核心)
    if (food) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#f39c12';
        ctx.fillStyle = '#f1c40f';
        ctx.beginPath();
        ctx.arc(food.x * gridSize + gridSize/2, food.y * gridSize + gridSize/2, gridSize/2 - 2, 0, Math.PI*2);
        ctx.fill();
        // 核心内圈
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(food.x * gridSize + gridSize/2, food.y * gridSize + gridSize/2, gridSize/4, 0, Math.PI*2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    // 画子弹
    for (let b of bullets) {
        ctx.shadowBlur = 5;
        ctx.shadowColor = b.color;
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(b.x * gridSize + gridSize/2, b.y * gridSize + gridSize/2, b.size, 0, Math.PI*2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    // 画蛇
    for (let i = snake.length - 1; i >= 0; i--) {
        let seg = snake[i];
        let color = WEAPONS[seg.weaponType].color;
        
        ctx.fillStyle = color;
        // 蛇身渲染
        if (i === 0) {
            ctx.shadowBlur = 10; ctx.shadowColor = color;
            ctx.fillRect(seg.x * gridSize + 1, seg.y * gridSize + 1, gridSize - 2, gridSize - 2);
            ctx.shadowBlur = 0;
            // 眼睛
            ctx.fillStyle = 'white';
            ctx.fillRect(seg.x * gridSize + 5, seg.y * gridSize + 5, 3, 3);
            ctx.fillRect(seg.x * gridSize + 12, seg.y * gridSize + 5, 3, 3);
        } else {
            // 身体武器节段画成圆形更像炮塔
            ctx.beginPath();
            ctx.arc(seg.x * gridSize + gridSize/2, seg.y * gridSize + gridSize/2, gridSize/2 - 1, 0, Math.PI*2);
            ctx.fill();
            // 中心加个黑点代表枪管
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.beginPath();
            ctx.arc(seg.x * gridSize + gridSize/2, seg.y * gridSize + gridSize/2, 2, 0, Math.PI*2);
            ctx.fill();
        }
    }

    // 画怪物
    for (let e of enemies) {
        let px = e.x * gridSize;
        let py = e.y * gridSize;
        
        // 怪物本体 (受减速变蓝)
        ctx.fillStyle = e.slowTimer > 0 ? '#74b9ff' : '#ff4757';
        ctx.beginPath();
        ctx.moveTo(px + gridSize/2, py);
        ctx.lineTo(px + gridSize, py + gridSize);
        ctx.lineTo(px, py + gridSize);
        ctx.closePath();
        ctx.fill();

        // 血条
        ctx.fillStyle = '#333';
        ctx.fillRect(px, py - 6, gridSize, 3);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(px, py - 6, gridSize * (Math.max(0, e.hp) / e.maxHp), 3);
    }
}

// ---------------- 游戏流程控制 ----------------

function updateStats() {
    lengthDisplay.innerText = snake.length;
    killDisplay.innerText = kills;
}

function triggerUpgrade() {
    isPaused = true;
    upgradeModal.style.display = 'flex';
}

function selectUpgrade(type) {
    // 给尾巴赋予所选武器属性
    snake[snake.length - 1].weaponType = type;

    upgradeModal.style.display = 'none';
    spawnFood(); 
    updateStats();

    // 核心修改：升级完成后进入“战术暂停”状态，等待玩家按方向键才继续
    isPaused = false;
    isGameStarted = false;
    directionQueue = []; // 清空之前的按键缓存，防止自动狂奔

    startPrompt.innerHTML = '升级完成！<br><span style="font-size:16px; color:#a0a5b5;">按方向键继续移动</span>';
    startPrompt.style.display = 'block';
}
function triggerGameOver() {
    isGameOver = true;
    document.getElementById('finalLength').innerText = snake.length;
    document.getElementById('finalKills').innerText = kills;
    gameOverModal.style.display = 'flex';
}

initGame();