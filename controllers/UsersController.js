import sha1 from 'sha1';
import dbClient from '../utils/db';

const UsersController = {
  async postNew(req, res) {
    const email = req.body ? req.body.email : null;
    const password = req.body ? req.body.password : null;
    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Missing password' });
    }
    const users = await dbClient.users();
    if (await users.findOne({ email })) {
      return res.status(400).json({ error: 'Already exist' });
    }
    const hashed = sha1(password);

    const result = await users.insertOne({ email, password: hashed });
    return res.status(201).json({ email, id: result.insertedId.toString() });
  },

  async getMe(req, res) {
    const { user } = req;
    return res.status(200).json({ email: user.email, id: user._id.toString() });
  },

};
export default UsersController;
