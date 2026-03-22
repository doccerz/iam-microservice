import express from "express";
import authRouter from "./routes/auth.routes.js";
import usersRouter from "./routes/users.routes.js";
import { errorHandler } from "./middleware/error-handler.js";

const app = express();

app.use(express.json());
app.use("/auth", authRouter);
app.use("/users", usersRouter);
app.use(errorHandler);

export default app;
