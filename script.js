const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const restartBtn = document.getElementById('restartBtn');

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
    draw(); // Draw initial state
    
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
        ctx.fillText('按方向键 (↑ ↓ ← →) 开始游戏', canvas.width / 2, canvas.height / 2);
    }

    // 绘制食物
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.arc(food.x * gridSize + gridSize / 2, food.y * gridSize + gridSize / 2, gridSize / 2 - 2, 0, Math.PI * 2);
    ctx.fill();

    // 绘制蛇
    for (let i = 0; i < snake.length; i++) {
        // 蛇头颜色稍微不同
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
    restartBtn.style.display = 'inline-block';
}

document.addEventListener('keydown', (e) => {
    // 防止滚动页面
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

restartBtn.addEventListener('click', initGame);

// 启动游戏
initGame();
