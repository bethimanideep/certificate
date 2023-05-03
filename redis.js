const redis = require("redis");
require("dotenv").config();

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