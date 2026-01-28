export default () => ({
  port: parseInt(process.env.PORT || '3003', 10),
  ccaas: {
    url: process.env.CCAAS_URL || 'http://localhost:3001',
  },
  database: {
    path: process.env.DATABASE_PATH || './data/problem-explainer.db',
  },
});
