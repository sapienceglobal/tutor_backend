const { spawn } = require('child_process');

const server = spawn('node', ['server.js'], { stdio: 'inherit' });

server.on('close', (code) => {
    console.log('Server process exited with code', code);
});

setTimeout(() => {
    console.log('Wrapper still alive after 3s...');
}, 3000);

setTimeout(() => {
    console.log('Wrapper still alive after 10s... killing server.');
    server.kill();
}, 10000);
