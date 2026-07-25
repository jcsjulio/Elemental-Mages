const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(__dirname));

let players = {};

const BASE_COLORS = [
  '#ff0055', '#00ffcc', '#ffcc00', '#ff00ff', 
  '#00ff66', '#3399ff', '#ff6600', '#9933ff'
];

const GRID_COLS = 20;
const GRID_ROWS = 15;
let grid = createEmptyGrid();

// Configuração do Timer (60 segundos por rodada)
const ROUND_TIME = 60; 
let timeLeft = ROUND_TIME;

function createEmptyGrid() {
  return Array(GRID_ROWS).fill(null).map(() => Array(GRID_COLS).fill(null));
}

function getUniqueColor() {
  const usedColors = Object.values(players).map(p => p.color);
  const availableColor = BASE_COLORS.find(color => !usedColors.includes(color));
  if (availableColor) return availableColor;

  let randomColor;
  let attempts = 0;
  do {
    const hue = Math.floor(Math.random() * 360);
    randomColor = `hsl(${hue}, 100%, 50%)`;
    attempts++;
  } while (usedColors.includes(randomColor) && attempts < 50);

  return randomColor;
}

// Loop do Timer no Servidor (1 tick por segundo)
setInterval(() => {
  if (Object.keys(players).length > 0) {
    timeLeft--;

    if (timeLeft <= 0) {
      // Fim da rodada: Encontra o vencedor
      const sortedPlayers = Object.values(players).sort((a, b) => b.score - a.score);
      const winner = sortedPlayers[0] || null;

      io.emit('roundOver', { winner });

      // Reseta o mapa e o timer
      grid = createEmptyGrid();
      timeLeft = ROUND_TIME;
      recalculateScores();

      setTimeout(() => {
        io.emit('roundStart', { grid, players, timeLeft });
      }, 3000); // 3 segundos de pausa para exibir o vencedor
    } else {
      io.emit('timerUpdate', timeLeft);
    }
  }
}, 1000);

io.on('connection', (socket) => {
  console.log(`Jogador conectado: ${socket.id}`);

  const playerColor = getUniqueColor();

  players[socket.id] = {
    id: socket.id,
    x: Math.floor(Math.random() * 700 + 50),
    y: Math.floor(Math.random() * 500 + 50),
    color: playerColor,
    score: 0,
    name: `Pintor_${socket.id.substring(0, 4)}`
  };

  socket.emit('init', { players, grid, cols: GRID_COLS, rows: GRID_ROWS, timeLeft });
  socket.broadcast.emit('newPlayer', players[socket.id]);

  socket.on('playerMove', (data) => {
    const p = players[socket.id];
    if (!p) return;

    p.x = data.x;
    p.y = data.y;

    const col = Math.floor(p.x / (800 / GRID_COLS));
    const row = Math.floor(p.y / (600 / GRID_ROWS));

    if (row >= 0 && row < GRID_ROWS && col >= 0 && col < GRID_COLS) {
      if (grid[row][col] !== p.color) {
        grid[row][col] = p.color;
        recalculateScores();
        io.emit('gridUpdate', { row, col, color: p.color, players });
      }
    }

    socket.broadcast.emit('playerMoved', p);
  });

  socket.on('chatMessage', (msg) => {
    io.emit('chatMessage', {
      sender: players[socket.id]?.name || 'Pintor',
      color: players[socket.id]?.color || '#fff',
      text: msg
    });
  });

  socket.on('disconnect', () => {
    delete players[socket.id];
    recalculateScores();
    io.emit('playerDisconnected', { id: socket.id, players });
  });
});

function recalculateScores() {
  const totalCells = GRID_COLS * GRID_ROWS;
  let counts = {};

  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const color = grid[r][c];
      if (color) {
        counts[color] = (counts[color] || 0) + 1;
      }
    }
  }

  Object.values(players).forEach(p => {
    const cellCount = counts[p.color] || 0;
    p.score = Math.round((cellCount / totalCells) * 100);
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));