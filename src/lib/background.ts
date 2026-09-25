/**
 * Fire-and-forget for async work started from an event handler with no error UI of its own
 * (tick a checkbox, pin a note, log a focus session). Failures are logged — they show in the
 * dev overlay / browser console — instead of becoming unhandled rejections or vanishing.
 */
export function background(work: Promise<unknown>, what: string): void {
  work.catch((e: unknown) => console.error(`${what} failed:`, e));
}
