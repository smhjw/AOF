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

// 排行榜配置
const MAX_SCORES = 8;
const LEADERBOARD_KEY = 'aof_leaderboard_v1';

function initGame() {
    snake = [
        { x: 10, y: 10 },
    ];
    food = { x: 15, y: 15 };
    dx = 0;
    dy = 0;
    score = 0;
    scoreElement.innerText = score;
    isGameOver = false;
    isGameStarted = false;
    restartBtn.style.display = 'none';
    
    placeFood();
    updateLeaderboardDisplay(); // 初始化显示排行榜
    draw(); // 绘制初始状态
    
    if (gameLoopInterval) clearInterval(gameLoopInterval);
    gameLoopInterval = setInterval(gameLoop, 120);
}

function gameLoop() {
    update();
    draw();
}

function update() {
    if (isGameOver || !isGameStarted) return;

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
    // 清空画布
    ctx.fillStyle = '#34495e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (isGameOver) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = 'white';
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('游戏结束!', canvas.width / 2, canvas.height / 2 - 20);
        
        ctx.font = '20px Arial';
        ctx.fillText(`最终得分: ${score}`, canvas.width / 2, canvas.height / 2 + 20);
        return;
    }
    
    if (!isGameStarted) {
        ctx.fillStyle = 'white';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('按方向键开始游戏', canvas.width / 2, canvas.height / 2);
    }

    // 绘制食物
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.arc(food.x * gridSize + gridSize / 2, food.y * gridSize + gridSize / 2, gridSize / 2 - 2, 0, Math.PI * 2);
    ctx.fill();

    // 绘制蛇
    for (let i = 0; i < snake.length; i++) {
        ctx.fillStyle = i === 0 ? '#2ecc71' : '#27ae60';
        ctx.fillRect(snake[i].x * gridSize, snake[i].y * gridSize, gridSize - 1, gridSize - 1);
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
    draw(); // 确保画面停在结束状态
    
    // 延迟一点点触发弹窗，保证渲染完成
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
    // 降序排序
    board.sort((a, b) => b.score - a.score);
    // 只保留前 N 名
    board.splice(MAX_SCORES);
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(board));
    updateLeaderboardDisplay();
}

function updateLeaderboardDisplay() {
    const board = getLeaderboard();
    if (board.length === 0) {
        leaderboardList.innerHTML = '<li><span style="color: #bdc3c7;">暂无记录，快来霸榜！</span></li>';
        return;
    }
    
    leaderboardList.innerHTML = board.map((entry, index) => {
        let medal = '';
        if (index === 0) medal = '🥇 ';
        else if (index === 1) medal = '🥈 ';
        else if (index === 2) medal = '🥉 ';
        else medal = `<span style="display:inline-block; width: 24px; text-align: left; color:#bdc3c7;">${index + 1}.</span>`;
        
        return `<li>
            <span class="name" title="${entry.name}">${medal}${entry.name}</span>
            <span class="score">${entry.score}</span>
        </li>`;
    }).join('');
}

function checkHighScore() {
    if (score === 0) return; // 0分不记录
    const board = getLeaderboard();
    // 检查是否有资格上榜：榜单未满 或 分数大于榜单最后一名
    if (board.length < MAX_SCORES || score > board[board.length - 1].score) {
        const playerName = prompt(`🎉 恭喜！你以 ${score} 分进入了排行榜！\n请留下你的大名：`);
        if (playerName !== null) { // 用户没有点取消
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
    // 防止方向键和空格键滚动页面
    if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight", " "].indexOf(e.key) > -1) {
        e.preventDefault();
    }

    if (isGameOver) return;
    
    isGameStarted = true;

    switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
            if (dy === 1) break;
            dx = 0;
            dy = -1;
            break;
        case 'ArrowDown':
        case 's':
        case 'S':
            if (dy === -1) break;
            dx = 0;
            dy = 1;
            break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
            if (dx === 1) break;
            dx = -1;
            dy = 0;
            break;
        case 'ArrowRight':
        case 'd':
        case 'D':
            if (dx === -1) break;
            dx = 1;
            dy = 0;
            break;
    }
});

restartBtn.addEventListener('click', () => {
    restartBtn.blur(); // 移除焦点，防止空格键误触
    initGame();
});

// 启动游戏
initGame();
