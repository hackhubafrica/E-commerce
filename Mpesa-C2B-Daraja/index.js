require("dotenv").config();

const app = require("./src/app");
const logger = require("./src/utils/logger");

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  logger.info(`🚀 M-PESA C2B server running`, {
    port: PORT,
    env: process.env.NODE_ENV || "development",
    endpoints: {
      health:       `http://localhost:${PORT}/health`,
      validation:   `http://localhost:${PORT}/payment/validation`,
      confirmation: `http://localhost:${PORT}/payment/confirmation`,
      getToken:     `GET  http://localhost:${PORT}/admin/token`,
      registerURLs: `POST http://localhost:${PORT}/admin/register-urls`,
      simulate:     `POST http://localhost:${PORT}/admin/simulate`,
      transactions: `GET  http://localhost:${PORT}/admin/transactions`,
    },
  });
});