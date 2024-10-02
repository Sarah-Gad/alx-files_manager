import redisClient from '../utils/redis';
import dbClient from '../utils/db';

const AppController = {
  async getStatus(req, res) {
    const rStat = await redisClient.isAlive();
    const dStat = await dbClient.isAlive();
    res.json({ redis: rStat, db: dStat });
  },
  async getStats(req, res) {
    const uCount = await dbClient.nbUsers();
    const fCount = await dbClient.nbFiles();
    res.json({ users: uCount, files: fCount });
  },
};
export default AppController;
