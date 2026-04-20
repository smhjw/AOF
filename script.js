const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const restartBtn = document.getElementById('restartBtn');
const leaderboardList = document.getElementById('leaderboardList');
const clearBoardBtn = document.getElementById('clearBoardBtn');

const gridSize = 20;
const tileCount = canvas.width / gridSize;

let snake = [];
let food = { x: 15, y: 15 };
let dx = 0;
let dy = 0;
let score = 0;
let gameLoopInterval;
let isGameOver = false;
let isGameStarted = false;
let isPaused = false;
let isGameWon = false; // 完美通关标记

// 解决卡手问题的输入队列
let directionQueue = [];

// 排行榜配置
const MAX_SCORES = 8;
const LEADERBOARD_KEY = 'aof_leaderboard_v1';

function initGame() {
    snake = [
        { x: 10, y: 10 },
        { x: 10, y: 11 },
        { x: 10, y: 12 }
    ];
    dx = 0;
    dy = 0;
    directionQueue = []; 
    score = 0;
    scoreElement.innerText = score;
    isGameOver = false;
    isGameStarted = false;
    isPaused = false;
    isGameWon = false;
    restartBtn.style.display = 'none';
    
    placeFood();
    updateLeaderboardDisplay(); 
    draw(); 
    
    if (gameLoopInterval) clearInterval(gameLoopInterval);
    gameLoopInterval = setInterval(gameLoop, 110); 
}

function gameLoop() {
    update();
    draw();
}

function update() {
    if (isGameOver || !isGameStarted || isPaused) return;

    if (directionQueue.length > 0) {
        const nextDir = directionQueue.shift();
        dx = nextDir.dx;
        dy = nextDir.dy;
    }

    const head = { x: snake[0].x + dx, y: snake[0].y + dy };

    // 碰壁检测
    if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount) {
        gameOver();
        return;
    }

    // 碰到自己检测
    for (let i = 0; i < snake.length; i++) {
        if (head.x === snake[i].x && head.y === snake[i].y) {
            gameOver();
            return;
        }
    }

    snake.unshift(head);

    // 吃到食物检测
    if (food && head.x === food.x && head.y === food.y) {
        score += 10;
        scoreElement.innerText = score;
        placeFood();
        if (!food) {
            // 完美通关：蛇占据了所有格子
            isGameOver = true;
            isGameWon = true;
            setTimeout(() => {
                checkHighScore();
                restartBtn.style.display = 'inline-block';
            }, 100);
            return;
        }
    } else {
        snake.pop();
    }
}

function draw() {
    // 背景
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 网格线
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= canvas.width; i += gridSize) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
    }

    if (isGameOver) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.textAlign = 'center';
        if (isGameWon) {
            ctx.fillStyle = '#f1c40f';
            ctx.font = 'bold 32px Poppins, Arial';
            ctx.fillText('👑 完美通关！', canvas.width / 2, canvas.height / 2 - 20);
        } else {
            ctx.fillStyle = '#ff4757';
            ctx.font = 'bold 36px Poppins, Arial';
            ctx.fillText('Game Over!', canvas.width / 2, canvas.height / 2 - 20);
        }
        
        ctx.fillStyle = '#fff';
        ctx.font = '20px Poppins, Arial';
        ctx.fillText(`最终得分: ${score}`, canvas.width / 2, canvas.height / 2 + 20);
        return;
    }
    
    if (!isGameStarted) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#4facfe';
        ctx.font = 'bold 22px Poppins, Arial';
        ctx.textAlign = 'center';
        ctx.fillText('滑动或按方向键开始', canvas.width / 2, canvas.height / 2);
    } else if (isPaused) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 28px Poppins, Arial';
        ctx.textAlign = 'center';
        ctx.fillText('已暂停 PAUSED', canvas.width / 2, canvas.height / 2);
    }

    // 绘制食物
    if (food) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ff4757';
        ctx.fillStyle = '#ff4757';
        ctx.beginPath();
        ctx.arc(food.x * gridSize + gridSize / 2, food.y * gridSize + gridSize / 2, gridSize / 2 - 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    // 绘制渐变蛇身
    for (let i = 0; i < snake.length; i++) {
        const colorRatio = i / snake.length;
        const r = Math.floor(46 - (46 - 20) * colorRatio);
        const g = Math.floor(204 - (204 - 100) * colorRatio);
        const b = Math.floor(113 - (113 - 50) * colorRatio);
        
        ctx.fillStyle = i === 0 ? '#2ecc71' : `rgb(${r}, ${g}, ${b})`;
        
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(snake[i].x * gridSize + 1, snake[i].y * gridSize + 1, gridSize - 2, gridSize - 2, 5);
        } else {
            ctx.fillRect(snake[i].x * gridSize + 1, snake[i].y * gridSize + 1, gridSize - 2, gridSize - 2);
        }
        ctx.fill();

        if (i === 0) {
            ctx.fillStyle = '#ffffff';
            let eye1X, eye1Y, eye2X, eye2Y;
            const currentDx = directionQueue.length > 0 ? directionQueue[0].dx : dx;
            const currentDy = directionQueue.length > 0 ? directionQueue[0].dy : dy;

            if (currentDx === 1) { 
                eye1X = snake[i].x * gridSize + 14; eye1Y = snake[i].y * gridSize + 5;
                eye2X = snake[i].x * gridSize + 14; eye2Y = snake[i].y * gridSize + 15;
            } else if (currentDx === -1) {
                eye1X = snake[i].x * gridSize + 6; eye1Y = snake[i].y * gridSize + 5;
                eye2X = snake[i].x * gridSize + 6; eye2Y = snake[i].y * gridSize + 15;
            } else if (currentDy === 1) {
                eye1X = snake[i].x * gridSize + 5; eye1Y = snake[i].y * gridSize + 14;
                eye2X = snake[i].x * gridSize + 15; eye2Y = snake[i].y * gridSize + 14;
            } else { 
                eye1X = snake[i].x * gridSize + 5; eye1Y = snake[i].y * gridSize + 6;
                eye2X = snake[i].x * gridSize + 15; eye2Y = snake[i].y * gridSize + 6;
            }
            ctx.beginPath(); ctx.arc(eye1X, eye1Y, 2, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(eye2X, eye2Y, 2, 0, Math.PI * 2); ctx.fill();
            
            ctx.fillStyle = '#000000';
            ctx.beginPath(); ctx.arc(eye1X + (currentDx*1), eye1Y + (currentDy*1), 1, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(eye2X + (currentDx*1), eye2Y + (currentDy*1), 1, 0, Math.PI * 2); ctx.fill();
        }
    }
}

// 修复：使用数组记录空位，避免完美通关时的 while(true) 死循环
function placeFood() {
    let freeSpots = [];
    for (let x = 0; x < tileCount; x++) {
        for (let y = 0; y < tileCount; y++) {
            if (!snake.some(s => s.x === x && s.y === y)) {
                freeSpots.push({x, y});
            }
        }
    }
    
    if (freeSpots.length === 0) {
        food = null; // 没有空位了，通关
        return;
    }
    
    let idx = Math.floor(Math.random() * freeSpots.length);
    food = freeSpots[idx];
}

function gameOver() {
    isGameOver = true;
    clearInterval(gameLoopInterval);
    draw(); 
    
    setTimeout(() => {
        checkHighScore();
        restartBtn.style.display = 'inline-block';
    }, 100);
}

// ---------------- 排行榜逻辑 ----------------
function getLeaderboard() {
    const data = localStorage.getItem(LEADERBOARD_KEY);
    return data ? JSON.parse(data) : [];
}

function saveScore(name, score) {
    const board = getLeaderboard();
    board.push({ name: name || '匿名玩家', score: score });
    board.sort((a, b) => b.score - a.score);
    board.splice(MAX_SCORES);
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(board));
    updateLeaderboardDisplay();
}

function updateLeaderboardDisplay() {
    const board = getLeaderboard();
    if (board.length === 0) {
        leaderboardList.innerHTML = '<li><span style="color: #a0a5b5;">暂无记录，快来霸榜！</span></li>';
        return;
    }
    
    leaderboardList.innerHTML = board.map((entry, index) => {
        let medal = '';
        if (index === 0) medal = '🥇 ';
        else if (index === 1) medal = '🥈 ';
        else if (index === 2) medal = '🥉 ';
        else medal = `<span style="display:inline-block; width: 24px; text-align: left; color:#a0a5b5;">${index + 1}.</span>`;
        
        return `<li>
            <span class="name" title="${entry.name}">${medal}${entry.name}</span>
            <span class="score">${entry.score}</span>
        </li>`;
    }).join('');
}

function checkHighScore() {
    if (score === 0 && !isGameWon) return; 
    const board = getLeaderboard();
    if (board.length < MAX_SCORES || score > board[board.length - 1].score || isGameWon) {
        const playerName = prompt(`🎉 恭喜！你以 ${score} 分进入了排行榜！\n请留下你的大名：`);
        if (playerName !== null) { 
            saveScore(playerName.trim() || '匿名玩家', score);
        }
    }
}

clearBoardBtn.addEventListener('click', () => {
    if (confirm('确定要清空本地的排行榜记录吗？')) {
        localStorage.removeItem(LEADERBOARD_KEY);
        updateLeaderboardDisplay();
    }
});

// ---------------- 游戏控制 (键盘 + 触摸) ----------------
function handleDirectionInput(newDx, newDy) {
    let lastDir = directionQueue.length > 0 ? directionQueue[directionQueue.length - 1] : { dx, dy };
    
    if (lastDir.dx === 0 && lastDir.dy === 0) {
        if (snake.length > 1 && (snake[0].x + newDx === snake[1].x && snake[0].y + newDy === snake[1].y)) {
            return;
        }
        isGameStarted = true;
        directionQueue.push({ dx: newDx, dy: newDy });
    } else if ((newDx !== -lastDir.dx || newDy !== -lastDir.dy) && 
               (newDx !== lastDir.dx || newDy !== lastDir.dy)) {
        isGameStarted = true;
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
        if (!isGameOver && isGameStarted) {
            isPaused = !isPaused;
            draw(); // 立即渲染暂停画面
        }
        return;
    }

    if (isGameOver || isPaused) return;

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

// 移动端滑动支持
let touchStartX = 0;
let touchStartY = 0;
document.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
}, { passive: false });

document.addEventListener('touchmove', (e) => {
    // 如果在 canvas 区域内滑动，阻止页面滚动
    if (e.target === canvas) {
        e.preventDefault();
    }
}, { passive: false });

document.addEventListener('touchend', (e) => {
    if (isGameOver || isPaused) return;
    let touchEndX = e.changedTouches[0].screenX;
    let touchEndY = e.changedTouches[0].screenY;
    
    let deltaX = touchEndX - touchStartX;
    let deltaY = touchEndY - touchStartY;
    
    // 滑动距离大于 30 像素才判定为有效滑动
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
    } else if (e.target === canvas && isGameStarted && !isGameOver) {
         // 点击 canvas 暂停/继续
         isPaused = !isPaused;
         draw();
    }
}, { passive: false });

restartBtn.addEventListener('click', () => {
    restartBtn.blur(); 
    initGame();
});

initGame();