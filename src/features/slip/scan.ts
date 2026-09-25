import { scanFromURLAsync } from 'expo-camera';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { aiAllowed } from '@/features/premium';

import { parseSlipQr, type SlipQr } from './qr';
import { readSlipRemote, slipRemoteEnabled } from './remote';
import type { SlipResult } from './types';

/** Slips are tall screenshots with large print; 800px wide keeps them legible at ~1.5k image tokens. */
const WIDTH = 800;

export type ScanOutcome =
  | { kind: 'read'; slip: SlipResult; qr: SlipQr | null }
  | { kind: 'duplicate'; ref: string; qr: SlipQr | null; slip?: SlipResult }
  | { kind: 'not_slip' }
  | { kind: 'offline'; qr: SlipQr | null } // no Supabase configured or the call failed → fill by hand
  | { kind: 'error' };

/** Free, on-device: the slip QR gives the ref and the payer's bank. Best effort — never throws. */
async function readQr(uri: string): Promise<SlipQr | null> {
  try {
    const codes = await scanFromURLAsync(uri, ['qr']);
    for (const c of codes) {
      const qr = parseSlipQr(c.data);
      if (qr) return qr;
    }
  } catch {
    // Unsupported on this platform / browser, or no QR in the picture.
  }
  return null;
}

/**
 * One picked image → what we know about it, cheapest step first:
 *   1. slip QR on the device (free) → a ref already saved means a duplicate, and no paid call is made
 *   2. slip-ocr (Claude Haiku) on a resized copy for amount / date / names
 * `knownRefs` holds refs already in the database and earlier in this batch.
 */
export async function scanSlip(image: { uri: string; width?: number }, knownRefs: Set<string>, signal?: AbortSignal): Promise<ScanOutcome> {
  const { uri } = image;
  const qr = await readQr(uri);
  if (qr && knownRefs.has(qr.ref)) return { kind: 'duplicate', ref: qr.ref, qr };
  if (!slipRemoteEnabled || !aiAllowed()) return { kind: 'offline', qr }; // free tier: fill by hand (P4-06)

  let base64: string | undefined;
  try {
    const context = ImageManipulator.manipulate(uri);
    if (!image.width || image.width > WIDTH) context.resize({ width: WIDTH }); // never upscale a small screenshot
    const rendered = await context.renderAsync();
    base64 = (await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true })).base64;
  } catch {
    return { kind: 'error' };
  }
  if (!base64) return { kind: 'error' };

  let slip: SlipResult;
  try {
    slip = await readSlipRemote(base64, signal);
  } catch {
    return { kind: 'offline', qr };
  }
  if (!slip.isSlip) return { kind: 'not_slip' };
  const ref = qr?.ref ?? slip.ref;
  if (ref && knownRefs.has(ref)) return { kind: 'duplicate', ref, qr, slip };
  return { kind: 'read', slip, qr };
}
