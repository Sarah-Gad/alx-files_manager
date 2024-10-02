import { MongoClient } from 'mongodb';
/**
* - class DBClient is our handler for the database
 */
class DBClient {
  constructor() {
    const host = process.env.DB_HOST || '127.0.0.1';
    const port = process.env.DB_PORT || '27017';
    const database = process.env.DB_DATABASE || 'files_manager';
    this.cli = new MongoClient(`mongodb://${host}:${port}/${database}`, { useUnifiedTopology: true });
    this.cli.connect();
  }

  isAlive() {
    return this.cli.isConnected();
  }

  async nbUsers() {
    return this.cli.db().collection('users').countDocuments();
  }

  async nbFiles() {
    return this.cli.db().collection('files').countDocuments();
  }

  async files() {
    return this.cli.db().collection('files');
  }

  async users() {
    return this.cli.db().collection('users');
  }
}

const dbClient = new DBClient();
export default dbClient;
