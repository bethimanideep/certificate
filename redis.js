const redis = require("redis").createClient({
    url: "redis://default:0atyiDj4MjFdV1OiTdLGheqEKu6MHkN6@redis-13263.c278.us-east-1-4.ec2.cloud.redislabs.com:13263"
})
redis.on('error', err => console.log('Redis Client Error', err));


module.exports={
    redis
}

// // const REDIS_PORT ="redis://127.0.0.1:6379" ;
// const redisPort = process.env.REDIS_URL;

// const client = redis.createClient({ url: redisPort, legacyMode: true });

// // IIFE  for redis connection //
// (async () => {
//   await client.connect();
// })();

// client.on("connect", () => console.log("Redis Client Connected"));
// client.on("error", (err) => console.log("Redis Client Error", err));

// module.exports = client ;