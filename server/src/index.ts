import dotenv from "dotenv";
dotenv.config();

import { createApp } from "./app";

const PORT = Number(process.env.PORT || 4000);

const app = createApp();

app.listen(PORT, () => {
  console.log(`AI document app server listening on http://localhost:${PORT}`);
});
