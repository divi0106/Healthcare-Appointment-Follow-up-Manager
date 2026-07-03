const env = require('./config/env');
const app = require('./app');
const { startScheduler } = require('./jobs/scheduler');

app.listen(env.port, () => {
  console.log(`Server running on port ${env.port}`);
  startScheduler();
});