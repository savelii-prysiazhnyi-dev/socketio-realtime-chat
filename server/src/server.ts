import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const PORT = 3000;

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  },
});

io.on('connection', socket => {
  console.log(`${socket.id} connected`);
  socket.emit('data', 'message from the server!');
});

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
