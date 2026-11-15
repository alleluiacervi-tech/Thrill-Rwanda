import { readPrivateDocument } from "@/lib/document-access";
import { getSession } from "@/lib/session";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) {
 const user=(await getSession())?.user;if(!user)return new Response("Please sign in",{status:401});
 const {id}=await params; const doc=await readPrivateDocument(user.id,id);
 if(!doc)return new Response("Not found",{status:404,headers:{"Cache-Control":"private, no-store"}});
 return new Response(new Uint8Array(doc.data),{headers:{"Content-Type":doc.contentType,"Content-Disposition":`inline; filename="${doc.fileName.replace(/[^\w. -]/g,"")}"`,"Cache-Control":"private, no-store, max-age=0","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'; sandbox"}});
}
