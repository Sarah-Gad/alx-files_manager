#!/usr/bin/node
import { createClient } from 'redis';
import { promisify } from 'util';

class RedisClient {
  constructor() {
    this.cli = createClient();
    this.cli.on('error', (err) => {
      console.log(`Redis Error: ${err}`);
    });
  }

  isAlive() {
    return this.cli.connected;
  }

  async get(key) {
    const gt = promisify(this.cli.get).bind(this.cli);
    return gt(key);
  }

  async set(key, value, duration) {
    const st = promisify(this.cli.set).bind(this.cli);
    return st(key, value, 'EX', duration);
  }

  async del(key) {
    const dlt = promisify(this.cli.del).bind(this.cli);
    return dlt(key);
  }
}

const redisClient = new RedisClient();

export default redisClient;
