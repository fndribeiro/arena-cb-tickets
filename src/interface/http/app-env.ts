import type { Bindings } from "../../bindings";
import type { Role } from "../../contexts/identity/domain/role";
import type { Logger } from "../../shared/logger";
import type { Container } from "./container";

export interface Viewer {
  readonly userId: string;
  readonly email: string;
  readonly name: string;
  readonly role: Role;
}

export interface AppEnv {
  Bindings: Bindings;
  Variables: {
    requestId: string;
    logger: Logger;
    container: Container;
    viewer: Viewer | null;
  };
}
