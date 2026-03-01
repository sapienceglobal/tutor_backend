import('./server.js').then(() => console.log('Imported successfully')).catch((err) => {
    console.error('Failed to import server.js:');
    console.error(err);
});
