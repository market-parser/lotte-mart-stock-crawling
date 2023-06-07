import Pino from "pino";
import pretty from "pino-pretty";

export const logger = Pino(pretty())
