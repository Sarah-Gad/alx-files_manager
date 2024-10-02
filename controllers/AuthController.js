import { v4 as uuidv4 } from 'uuid';
import redisClient from '../utils/redis';

const AuthController = {
  async getConnect(req, res) {
    const { user } = req;
    const key = uuidv4();
    await redisClient.set(`auth_${key}`, user._id.toString(), 86400);
    return res.status(200).json({ token: key.toString() });
  },
  async getDisconnect(req, res) {
    const auth = req.headers['x-token'];
    await redisClient.del(`auth_${auth}`);
    return res.status(204).send();
  },
};
export default AuthController;
