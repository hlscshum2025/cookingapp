import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(){
  const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const turnstileSiteKey=process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  if(!supabaseUrl||!supabasePublishableKey){
    return NextResponse.json(
      {error:"Supabase runtime configuration is unavailable."},
      {status:503,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}},
    );
  }

  return NextResponse.json(
    {supabaseUrl,supabasePublishableKey,turnstileSiteKey:turnstileSiteKey||undefined},
    {headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}},
  );
}
