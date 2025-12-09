import express from 'express';

const server = express();

server.all('/', (req, res) => {
  res.send('Bot is alive! 🎅');
});

export function keepAlive() {
  // Render выдает порт в process.env.PORT. Если его нет, используем 3000.
  const port = process.env.PORT || 3000;
  
  server.listen(port, '0.0.0.0', () => {
    console.log(`Server is ready on port ${port}`);
  });
}
