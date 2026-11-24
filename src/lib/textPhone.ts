/**
 * What the checkout can tell of a mobile number before Adminium reads it, for
 * the box "Text me when my order is ready".
 *
 * Adminium reads the number properly when the text is sent, in the kitchen's
 * country where it has no "+". The page only spares the diner a box that
 * cannot work: no text goes to mainland China (+86), so there the box is off
 * and the number stays for a call. Hong Kong (+852), Macao (+853) and Taiwan
 * (+886) are other calling codes, and are texted as anywhere else. A number
 * too short or too long to be anybody's mobile is asked about beside the
 * field, and never stops the order.
 */

/** The number with its separators gone, and a leading `00` written as `+`. */
export function compactPhone(phone: string): string {
  const bare = phone.trim().replace(/[\s().\- ]/g, "");
  return bare.startsWith("00") ? `+${bare.slice(2)}` : bare;
}

/** A number in mainland China: no text goes there, so the box is off. */
export function mainlandChina(phone: string): boolean {
  return compactPhone(phone).startsWith("+86");
}

/**
 * Whether a text could be sent to the number as typed: digits alone after an
 * optional "+", 7 to 15 of them (the longest number there is), and a calling
 * code that does not start with 0.
 */
export function textReadable(phone: string): boolean {
  const bare = compactPhone(phone);
  const match = /^(\+?)(\d+)$/.exec(bare);
  if (match === null) return false;
  const digits = match[2]!;
  if (match[1] === "+" && digits.startsWith("0")) return false;
  return digits.length >= 7 && digits.length <= 15;
}
