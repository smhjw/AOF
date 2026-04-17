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

// 解决卡手问题的输入队列
let directionQueue = [];

// 排行榜配置
const MAX_SCORES = 8;
const LEADERBOARD_KEY = 'aof_leaderboard_v1';

function initGame() {
    // 初始身体稍微长一点点，看起来更生动
    snake = [
        { x: 10, y: 10 },
        { x: 10, y: 11 },
        { x: 10, y: 12 }
    ];
    food = { x: 15, y: 15 };
    dx = 0;
    dy = 0;
    directionQueue = []; // 清空指令队列
    score = 0;
    scoreElement.innerText = score;
    isGameOver = false;
    isGameStarted = false;
    restartBtn.style.display = 'none';
    
    placeFood();
    updateLeaderboardDisplay(); 
    draw(); 
    
    if (gameLoopInterval) clearInterval(gameLoopInterval);
    gameLoopInterval = setInterval(gameLoop, 110); // 稍微提速一点点，配合队列操作手感极佳
}

function gameLoop() {
    update();
    draw();
}

function update() {
    if (isGameOver || !isGameStarted) return;

    // 从队列中取出下一个执行的指令，避免一次循环吞掉按键
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
    if (head.x === food.x && head.y === food.y) {
        score += 10;
        scoreElement.innerText = score;
        placeFood();
    } else {
        snake.pop();
    }
}

function draw() {
    // 绘制深色背景
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 绘制科技感网格线
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= canvas.width; i += gridSize) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
    }

    if (isGameOver) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#ff4757';
        ctx.font = 'bold 36px Poppins, Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Game Over!', canvas.width / 2, canvas.height / 2 - 20);
        
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
        ctx.fillText('按方向键开始', canvas.width / 2, canvas.height / 2);
    }

    // 绘制发光食物
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#ff4757';
    ctx.fillStyle = '#ff4757';
    ctx.beginPath();
    ctx.arc(food.x * gridSize + gridSize / 2, food.y * gridSize + gridSize / 2, gridSize / 2 - 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0; // 重置阴影以免影响蛇身

    // 绘制渐变蛇身
    for (let i = 0; i < snake.length; i++) {
        // 从头部的亮蓝色渐变到尾部的深蓝色
        const colorRatio = i / snake.length;
        const r = Math.floor(79 - (79 - 30) * colorRatio);
        const g = Math.floor(172 - (172 - 60) * colorRatio);
        const b = Math.floor(254 - (254 - 150) * colorRatio);
        
        ctx.fillStyle = i === 0 ? '#4facfe' : `rgb(${r}, ${g}, ${b})`;
        
        // 带有微小圆角的蛇身体
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(snake[i].x * gridSize + 1, snake[i].y * gridSize + 1, gridSize - 2, gridSize - 2, 5);
        } else {
            ctx.fillRect(snake[i].x * gridSize + 1, snake[i].y * gridSize + 1, gridSize - 2, gridSize - 2);
        }
        ctx.fill();

        // 为蛇头画两个小眼睛
        if (i === 0) {
            ctx.fillStyle = '#1a1a2e';
            let eye1X, eye1Y, eye2X, eye2Y;
            // 预测头部的朝向
            const currentDx = directionQueue.length > 0 ? directionQueue[0].dx : dx;
            const currentDy = directionQueue.length > 0 ? directionQueue[0].dy : dy;

            if (currentDx === 1) { // 往右
                eye1X = snake[i].x * gridSize + 14; eye1Y = snake[i].y * gridSize + 5;
                eye2X = snake[i].x * gridSize + 14; eye2Y = snake[i].y * gridSize + 15;
            } else if (currentDx === -1) { // 往左
                eye1X = snake[i].x * gridSize + 6; eye1Y = snake[i].y * gridSize + 5;
                eye2X = snake[i].x * gridSize + 6; eye2Y = snake[i].y * gridSize + 15;
            } else if (currentDy === 1) { // 往下
                eye1X = snake[i].x * gridSize + 5; eye1Y = snake[i].y * gridSize + 14;
                eye2X = snake[i].x * gridSize + 15; eye2Y = snake[i].y * gridSize + 14;
            } else { // 往上 (或初始状态)
                eye1X = snake[i].x * gridSize + 5; eye1Y = snake[i].y * gridSize + 6;
                eye2X = snake[i].x * gridSize + 15; eye2Y = snake[i].y * gridSize + 6;
            }
            ctx.beginPath(); ctx.arc(eye1X, eye1Y, 2, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(eye2X, eye2Y, 2, 0, Math.PI * 2); ctx.fill();
        }
    }
}

function placeFood() {
    let newFoodPosition;
    while (true) {
        newFoodPosition = {
            x: Math.floor(Math.random() * tileCount),
            y: Math.floor(Math.random() * tileCount)
        };
        
        let collision = false;
        for (let i = 0; i < snake.length; i++) {
            if (snake[i].x === newFoodPosition.x && snake[i].y === newFoodPosition.y) {
                collision = true;
                break;
            }
        }
        
        if (!collision) break;
    }
    food = newFoodPosition;
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
    if (score === 0) return; 
    const board = getLeaderboard();
    if (board.length < MAX_SCORES || score > board[board.length - 1].score) {
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

// ---------------- 游戏控制 ----------------
document.addEventListener('keydown', (e) => {
    if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight", " "].indexOf(e.key) > -1) {
        e.preventDefault();
    }

    if (isGameOver) return;
    isGameStarted = true;

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
        // 取出当前队列中最后一次注册的方向
        let lastDir = directionQueue.length > 0 ? directionQueue[directionQueue.length - 1] : { dx, dy };
        
        // 1. 如果还在原地没动过 (lastDir为0,0)，接受任何方向
        if (lastDir.dx === 0 && lastDir.dy === 0) {
            directionQueue.push({ dx: newDx, dy: newDy });
        } 
        // 2. 如果已经在移动，拦截“180度掉头”和“重复按下同个方向”的操作
        else if ((newDx !== -lastDir.dx || newDy !== -lastDir.dy) && 
                 (newDx !== lastDir.dx || newDy !== lastDir.dy)) {
            // 控制最大缓存队列数，防止玩家瞎按导致缓存一堆错误走位
            if (directionQueue.length < 3) {
                directionQueue.push({ dx: newDx, dy: newDy });
            }
        }
    }
});

restartBtn.addEventListener('click', () => {
    restartBtn.blur(); 
    initGame();
});

// 启动游戏
initGame();