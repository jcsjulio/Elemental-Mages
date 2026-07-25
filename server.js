const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(__dirname));

let players = {};
const COLORS = ['#ff0055', '#00ffcc', '#ffcc00', '#ff00ff', '#00ff66', '#3399ff'];

const GRID_COLS = 20;
const GRID_ROWS = 15;
let grid = Array(GRID_ROWS).fill(null).map(() => Array(GRID_COLS).fill(null));

io.on('connection', (socket) => {
  console.log(`Jogador conectado: ${socket.id}`);

  const assignedColor = COLORS[Object.keys(players).length % COLORS.length];

  players[socket.id] = {
    id: socket.id,
    x: Math.floor(Math.random() * 700 + 50),
    y: Math.floor(Math.random() * 500 + 50),
    color: assignedColor,
    score: 0,
    name: `Pintor_${socket.id.substring(0, 4)}`
  };

  // Envia estado inicial
  socket.emit('init', { players, grid, cols: GRID_COLS, rows: GRID_ROWS });
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