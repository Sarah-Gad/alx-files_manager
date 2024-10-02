import express from 'express';
import Routes from './routes';

const port = process.env.PORT || 5000;

const app = express();
app.use(express.json());

Routes(app);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
