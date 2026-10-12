export const PASS_MIME = 'application/vnd.apple.pkpass'
export function walletError(status: number) {
 return status === 503 ? 'Apple Wallet signing is not configured yet. Your event QR still works.' : status === 403 ? 'This ticket is no longer eligible for a Wallet pass. Refresh your registration.' : status === 401 ? 'Sign in again to open your Wallet pass.' : 'Unable to open the Wallet pass. Please try again.'
}
export async function readWalletPass(response: Response): Promise<Uint8Array> {
 if (!response.ok) throw new Error(walletError(response.status))
 if (response.headers.get('content-type')?.split(';')[0].trim() !== PASS_MIME) throw new Error('The signing service returned an invalid pass.')
 const bytes = new Uint8Array(await response.arrayBuffer())
 // A signed pkpass is a ZIP bundle, never JSON/HTML or an unsigned pass.json.
 if (bytes.length < 4 || bytes.length > 5_000_000 || bytes[0] !== 80 || bytes[1] !== 75 || bytes[2] !== 3 || bytes[3] !== 4) throw new Error('The signing service returned an invalid pass.')
 return bytes
}
export function createWalletActionGate() {
 let busy = false
 return { start: () => { if (busy) return false; busy = true; return true }, finish: () => { busy = false } }
}
