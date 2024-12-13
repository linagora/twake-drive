import { Express } from "express";
import { NephelePromise } from "./loader";
import { Adapter } from "./adapter";
import { Authenticator } from "./authenticator";

export async function createServer(): Promise<Express> {
  const nephele = await NephelePromise;
  return nephele.createServer({
    adapter: new Adapter(nephele),
    authenticator: new Authenticator(nephele),
    plugins: {},
  });
}
