const redis = require('redis');
const client = redis.createClient({ url: 'redis://localhost:6379' });

client.on('error', err => {
    console.error('Redis Client Error:', err);
});

client.connect()
    .then(() => {
        console.log('Redis connected successfully from script!');
        return client.ping();
    })
    .then(res => {
        console.log('Ping response:', res);
        client.disconnect(); // Disconnect after test
    })
    .catch(err => {
        console.error('Failed to connect from script:', err);
    });