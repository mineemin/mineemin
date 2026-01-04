// 게임 캔버스 및 컨텍스트 설정
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 캔버스 크기 설정
canvas.width = 800;
canvas.height = 600;

// 게임 상태
const gameState = {
    MENU: 'menu',
    PLAYING: 'playing',
    PAUSED: 'paused',
    GAME_OVER: 'game_over',
    STAGE_CLEAR: 'stage_clear'
};

let currentState = gameState.MENU;
let score = 0;
let lives = 3;
let stage = 1;

// 오디오 컨텍스트 및 효과음 생성
let audioContext;
let sounds = {};

function initAudio() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // 효과음 생성 함수
        function createTone(frequency, duration, type = 'sine') {
            return () => {
                if (!audioContext) return;
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.frequency.value = frequency;
                oscillator.type = type;
                
                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
                
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + duration);
            };
        }
        
        // 효과음 정의
        sounds.paddleHit = createTone(200, 0.1, 'square');
        sounds.brickHit = createTone(300, 0.15, 'square');
        sounds.brickBreak = createTone(150, 0.2, 'sawtooth');
        sounds.wallHit = createTone(100, 0.1, 'sine');
        sounds.lifeLost = createTone(80, 0.3, 'sawtooth');
        sounds.stageClear = createTone(400, 0.5, 'sine');
        sounds.gameOver = createTone(100, 0.5, 'sawtooth');
    } catch (e) {
        console.log('오디오 초기화 실패:', e);
    }
}

// 패들 클래스
class Paddle {
    constructor() {
        this.width = 120;
        this.height = 15;
        this.x = canvas.width / 2 - this.width / 2;
        this.y = canvas.height - 30;
        this.speed = 8;
        this.color = '#4CAF50';
    }
    
    update() {
        // 마우스 위치 추적
        if (mouseX >= 0) {
            this.x = mouseX - this.width / 2;
        }
        
        // 키보드 입력 처리
        if (keys['ArrowLeft'] || keys['a'] || keys['A']) {
            this.x -= this.speed;
        }
        if (keys['ArrowRight'] || keys['d'] || keys['D']) {
            this.x += this.speed;
        }
        
        // 경계 체크
        if (this.x < 0) this.x = 0;
        if (this.x + this.width > canvas.width) {
            this.x = canvas.width - this.width;
        }
    }
    
    draw() {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // 패들 하이라이트
        ctx.fillStyle = '#66BB6A';
        ctx.fillRect(this.x, this.y, this.width, 5);
    }
    
    getBounds() {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height
        };
    }
}

// 공 클래스
class Ball {
    constructor() {
        this.reset();
    }
    
    reset() {
        this.radius = 8;
        this.x = canvas.width / 2;
        this.y = canvas.height / 2;
        this.speed = 5;
        this.angle = Math.random() * Math.PI / 3 + Math.PI / 3; // 60-120도 사이
        this.dx = Math.cos(this.angle) * this.speed;
        this.dy = Math.sin(this.angle) * this.speed;
        this.color = '#FFD700';
    }
    
    update() {
        this.x += this.dx;
        this.y += this.dy;
        
        // 좌우 벽 충돌
        if (this.x - this.radius <= 0 || this.x + this.radius >= canvas.width) {
            this.dx = -this.dx;
            this.x = Math.max(this.radius, Math.min(canvas.width - this.radius, this.x));
            if (sounds.wallHit) sounds.wallHit();
        }
        
        // 상단 벽 충돌
        if (this.y - this.radius <= 0) {
            this.dy = -this.dy;
            this.y = this.radius;
            if (sounds.wallHit) sounds.wallHit();
        }
        
        // 하단 경계 (라이프 감소)
        if (this.y + this.radius >= canvas.height) {
            lives--;
            if (sounds.lifeLost) sounds.lifeLost();
            this.reset();
            if (lives <= 0) {
                currentState = gameState.GAME_OVER;
                if (sounds.gameOver) sounds.gameOver();
                updateUI();
                showOverlay('게임 오버', `최종 점수: ${score}점`);
            } else {
                updateUI();
            }
        }
    }
    
    draw() {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // 공 하이라이트
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.arc(this.x - 2, this.y - 2, 3, 0, Math.PI * 2);
        ctx.fill();
    }
    
    checkPaddleCollision(paddle) {
        const paddleBounds = paddle.getBounds();
        const ballBounds = {
            x: this.x - this.radius,
            y: this.y - this.radius,
            width: this.radius * 2,
            height: this.radius * 2
        };
        
        if (this.y + this.radius >= paddleBounds.y &&
            this.y - this.radius <= paddleBounds.y + paddleBounds.height &&
            this.x + this.radius >= paddleBounds.x &&
            this.x - this.radius <= paddleBounds.x + paddleBounds.width &&
            this.dy > 0) {
            
            // 패들 중심에서의 거리에 따라 각도 조정
            const hitPos = (this.x - (paddleBounds.x + paddleBounds.width / 2)) / (paddleBounds.width / 2);
            const angle = hitPos * Math.PI / 3; // 최대 60도
            
            this.dy = -Math.abs(this.dy);
            this.dx = Math.sin(angle) * this.speed;
            
            // 속도 정규화
            const speed = Math.sqrt(this.dx * this.dx + this.dy * this.dy);
            this.dx = (this.dx / speed) * this.speed;
            this.dy = (this.dy / speed) * this.speed;
            
            if (sounds.paddleHit) sounds.paddleHit();
            return true;
        }
        return false;
    }
    
    checkBrickCollision(brick) {
        const brickBounds = brick.getBounds();
        const ballCenterX = this.x;
        const ballCenterY = this.y;
        
        // AABB 충돌 감지
        if (ballCenterX + this.radius >= brickBounds.x &&
            ballCenterX - this.radius <= brickBounds.x + brickBounds.width &&
            ballCenterY + this.radius >= brickBounds.y &&
            ballCenterY - this.radius <= brickBounds.y + brickBounds.height) {
            
            // 충돌 방향 계산
            const ballPrevX = this.x - this.dx;
            const ballPrevY = this.y - this.dy;
            
            const distX = Math.abs(ballCenterX - (brickBounds.x + brickBounds.width / 2));
            const distY = Math.abs(ballCenterY - (brickBounds.y + brickBounds.height / 2));
            
            if (distX > distY) {
                this.dx = -this.dx;
            } else {
                this.dy = -this.dy;
            }
            
            return true;
        }
        return false;
    }
}

// 벽돌 클래스
class Brick {
    constructor(x, y, width, height, color, points = 10, durability = 1) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = color;
        this.points = points;
        this.durability = durability;
        this.maxDurability = durability;
        this.destroyed = false;
    }
    
    draw() {
        if (this.destroyed) return;
        
        // 벽돌 그리기
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // 내구도 표시 (여러 내구도인 경우)
        if (this.maxDurability > 1) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.fillRect(this.x, this.y, this.width, this.height);
            
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(
                this.durability,
                this.x + this.width / 2,
                this.y + this.height / 2 + 5
            );
        }
        
        // 테두리
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(this.x, this.y, this.width, this.height);
    }
    
    hit() {
        this.durability--;
        if (this.durability <= 0) {
            this.destroyed = true;
            if (sounds.brickBreak) sounds.brickBreak();
            return this.points;
        } else {
            if (sounds.brickHit) sounds.brickHit();
            return 0;
        }
    }
    
    getBounds() {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height
        };
    }
}

// 벽돌 그리드 생성
function createBricks() {
    const bricks = [];
    const rows = 5;
    const cols = 10;
    const brickWidth = 70;
    const brickHeight = 25;
    const padding = 5;
    const offsetTop = 60;
    const offsetLeft = (canvas.width - (cols * (brickWidth + padding) - padding)) / 2;
    
    const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
        '#F7DC6F', '#BB8FCE', '#85C1E2'
    ];
    
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const x = offsetLeft + col * (brickWidth + padding);
            const y = offsetTop + row * (brickHeight + padding);
            
            // 스테이지에 따라 내구도 증가
            const durability = stage > 1 ? Math.floor(Math.random() * stage) + 1 : 1;
            const colorIndex = row % colors.length;
            const points = durability * 10;
            
            bricks.push(new Brick(
                x, y, brickWidth, brickHeight,
                colors[colorIndex],
                points,
                durability
            ));
        }
    }
    
    return bricks;
}

// 게임 객체
let paddle;
let ball;
let bricks = [];

// 입력 처리
let mouseX = -1;
let keys = {};

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
});

canvas.addEventListener('mouseleave', () => {
    mouseX = -1;
});

document.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    
    if (e.key === ' ' && currentState === gameState.MENU) {
        startGame();
    }
    
    if (e.key === ' ' && currentState === gameState.PAUSED) {
        currentState = gameState.PLAYING;
        hideOverlay();
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

// UI 업데이트
function updateUI() {
    document.getElementById('score').textContent = score;
    document.getElementById('lives').textContent = lives;
    document.getElementById('stage').textContent = stage;
}

// 오버레이 표시/숨김
function showOverlay(title, message) {
    document.getElementById('overlayTitle').textContent = title;
    document.getElementById('overlayMessage').textContent = message;
    document.getElementById('gameOverlay').classList.remove('hidden');
    
    const startButton = document.getElementById('startButton');
    if (currentState === gameState.GAME_OVER) {
        startButton.textContent = '다시 시작';
        startButton.onclick = () => {
            resetGame();
            startGame();
        };
    } else if (currentState === gameState.STAGE_CLEAR) {
        startButton.textContent = '다음 스테이지';
        startButton.onclick = () => {
            stage++;
            startGame();
        };
    }
}

function hideOverlay() {
    document.getElementById('gameOverlay').classList.add('hidden');
}

// 게임 시작
function startGame() {
    currentState = gameState.PLAYING;
    hideOverlay();
    
    paddle = new Paddle();
    ball = new Ball();
    bricks = createBricks();
}

// 게임 리셋
function resetGame() {
    score = 0;
    lives = 3;
    stage = 1;
    updateUI();
}

// 게임 루프
function gameLoop() {
    // 화면 지우기
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (currentState === gameState.PLAYING) {
        // 게임 객체 업데이트
        paddle.update();
        ball.update();
        
        // 충돌 검사
        ball.checkPaddleCollision(paddle);
        
        // 벽돌 충돌 검사
        for (let i = bricks.length - 1; i >= 0; i--) {
            const brick = bricks[i];
            if (!brick.destroyed && ball.checkBrickCollision(brick)) {
                const points = brick.hit();
                if (points > 0) {
                    score += points;
                    updateUI();
                    bricks.splice(i, 1);
                }
            }
        }
        
        // 스테이지 클리어 체크
        if (bricks.length === 0 || bricks.every(b => b.destroyed)) {
            currentState = gameState.STAGE_CLEAR;
            if (sounds.stageClear) sounds.stageClear();
            showOverlay('스테이지 클리어!', `점수: ${score}점`);
        }
        
        // 게임 객체 그리기
        bricks.forEach(brick => brick.draw());
        paddle.draw();
        ball.draw();
    }
    
    requestAnimationFrame(gameLoop);
}

// 초기화
function init() {
    initAudio();
    updateUI();
    showOverlay('게임 시작', '스페이스바를 눌러 시작하세요');
    
    document.getElementById('startButton').onclick = () => {
        if (currentState === gameState.MENU) {
            startGame();
        }
    };
    
    gameLoop();
}

// 게임 시작
init();

