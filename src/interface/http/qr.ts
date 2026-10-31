import qrcode from "qrcode-generator";

const AUTO_TYPE_NUMBER = 0;

/** Server-side QR code as an SVG string (no client JS needed to display tickets or Pix codes). */
export function qrSvg(data: string): string {

  const qr = qrcode(AUTO_TYPE_NUMBER, "M");

  qr.addData(data);

  qr.make();

  return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
}
