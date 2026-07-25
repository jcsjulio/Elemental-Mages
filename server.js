const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(__dirname));

let players = {};
let monsters = [];
let nextMonsterId = 1;

// Elementos mágicos disponíveis para os magos
const ELEMENTS = ['Fogo 🔥', 'Gelo ❄️', 'Raio ⚡'];
const ELEMENT_COLORS = { 'Fogo 🔥': '#ff4500', 'Gelo ❄️': '#00ffff', 'Raio ⚡': '#ffd700' };

// Spawn de monstros/golens na arena
setInterval(() => {
  if (Object.keys(players).length > 0 && monsters.length < 8) {
    const monster = {
      id: nextMonsterId++,
      x: Math.random() * 700 + 50,
      y: Math.random() * 500 + 50,
      hp: 4,
      maxHp: 4,
      size: 25
    };
    monsters.push(monster);
    io.emit('spawnMonster', monster);
  }
}, 3500);

io.on('connection', (socket) => {
  console.log(`Mago conectado: ${socket.id}`);

  const chosenElement = ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)];

  players[socket.id] = {
    id: socket.id,
    x: 400,
    y: 300,
    element: chosenElement,
    color: ELEMENT_COLORS[chosenElement],
    name: `Mago_${socket.id.substring(0, 4)}`
  };

  // Envia estado inicial
  socket.emit('currentPlayers', players);
  socket.emit('currentMonsters', monsters);
  socket.broadcast.emit('newPlayer', players[socket.id]);

  // Movimentação do Mago
  socket.on('playerMove', (movementData) => {
    if (players[socket.id]) {
      players[socket.id].x = movementData.x;
      players[socket.id].y = movementData.y;
      socket.broadcast.emit('playerMoved', players[socket.id]);
    }
  });

  // Conjurando Feitiço (Ataque)
  socket.on('castSpell', (spellData) => {
    const mage = players[socket.id];
    if (!mage) return;

    io.emit('spellCast', { ...spellData, color: mage.color, playerId: socket.id });

    // Verifica colisão com monstros
    monsters.forEach((m, index) => {
      const dist = Math.hypot(m.x - spellData.targetX, m.y - spellData.targetY);
      if (dist < m.size + 15) {
        m.hp -= 1;
        if (m.hp <= 0) {
          monsters.splice(index, 1);
          io.emit('monsterDestroyed', m.id);
        } else {
          io.emit('monsterHit', { id: m.id, hp: m.hp });
        }
      }
    });
  });

  // Chat do Grimório/Guilda
  socket.on('chatMessage', (msg) => {
    io.emit('chatMessage', {
      sender: players[socket.id]?.name || 'Mago',
      element: players[socket.id]?.element || '',
      text: msg
    });
  });

  socket.on('disconnect', () => {
    delete players[socket.id];
    io.emit('playerDisconnected', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Arena de Magia ativa na porta ${PORT}`));