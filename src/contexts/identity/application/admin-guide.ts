import type { Clock } from "../../../shared/clock";
import type { Logger } from "../../../shared/logger";
import type { Role } from "../domain/role";
import type { UserRepository } from "../domain/user-repository";

export interface AdminGuideDeps {
  readonly users: UserRepository;
  readonly clock: Clock;
  readonly logger: Logger;
}

export interface GuideViewer {
  readonly userId: string;
  readonly role: Role;
}

/** The onboarding guide is shown to admins until they complete it once (persisted, so it follows them across devices). */
export async function shouldShowAdminGuide(viewer: GuideViewer, deps: AdminGuideDeps): Promise<boolean> {

  if (viewer.role !== "admin") {
    return false;
  }

  const completedAt: Date | null = await deps.users.findAdminGuideCompletedAt(viewer.userId);

  return completedAt === null;
}

export async function completeAdminGuide(userId: string, deps: AdminGuideDeps): Promise<void> {

  const firstCompletion: boolean = await deps.users.markAdminGuideCompleted(userId, deps.clock.now());

  const message: string = firstCompletion ? "admin guide completed" : "admin guide already completed";

  deps.logger.info(message, { userId });
}
