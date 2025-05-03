const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*'
  }
});

const players = {};
let mapChosen = false;
let gameStarted = false;

function allPlayersReady() {
  return Object.keys(players).length === 3;
}

function allFarEnough() {
  const playerList = Object.values(players);
  for (let i = 0; i < playerList.length; i++) {
    for (let j = i + 1; j < playerList.length; j++) {
      const a = playerList[i].location;
      const b = playerList[j].location;
      if (!a || !b) return false;
      const dist = getDistance(a.lat, a.lng, b.lat, b.lng);
      if (dist < 20) return false;
    }
  }
  return true;
}

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // м
  const toRad = x => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

io.on('connection', socket => {
  console.log('🔌 Нове підключення:', socket.id);

  socket.on('join', ({ name }) => {
    players[socket.id] = { name, alive: true, location: null };
    console.log(`${name} приєднався`);

    io.emit('playersUpdate', Object.values(players));
    if (allPlayersReady()) {
      io.emit('canStart');
    }
  });

  socket.on('startGame', () => {
    mapChosen = true;
    checkStartCondition();
  });

  socket.on('playerLocation', loc => {
    if (!players[socket.id]) return;
    players[socket.id].location = loc;
    checkStartCondition();
  });

  function checkStartCondition() {
    if (mapChosen && !gameStarted && allFarEnough()) {
      gameStarted = true;
      io.emit('gameStarted');
    }
  }

  socket.on('playerDied', () => {
    if (!players[socket.id]) return;
    players[socket.id].alive = false;
    io.emit('playerDied', { name: players[socket.id].name });

    const alive = Object.values(players).filter(p => p.alive);
    if (alive.length === 1) {
      io.emit('gameOver', { winner: alive[0].name });
    }
  });

  socket.on('disconnect', () => {
    console.log('❌ Відключився:', socket.id);
    delete players[socket.id];
    io.emit('playersUpdate', Object.values(players));
  });
});

server.listen(process.env.PORT || 3000, () => {
  console.log('✅ Сервер запущено на порту 3000');
});
