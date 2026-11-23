/** Whether a message has files attached, read from its IMAP body structure without downloading it. */
export type StructureNode = {
  type: string;
  disposition?: string | undefined;
  dispositionParameters?: { [key: string]: string } | undefined;
  parameters?: { [key: string]: string } | undefined;
  childNodes?: StructureNode[] | undefined;
};

export function hasAttachment(node: StructureNode | undefined): boolean {
  if (!node) return false;
  if (node.childNodes?.length) return node.childNodes.some(hasAttachment);
  const type = node.type.toLowerCase();
  if (node.disposition?.toLowerCase() === "attachment") return true;
  if (node.disposition?.toLowerCase() === "inline") return false;
  // A leaf that is neither the readable body nor an embedded signature is a file.
  if (type === "text/plain" || type === "text/html" || type.startsWith("multipart/")) return false;
  if (type === "application/pgp-signature" || type === "application/pkcs7-signature") return false;
  return Boolean(node.dispositionParameters?.filename || node.parameters?.name);
}
