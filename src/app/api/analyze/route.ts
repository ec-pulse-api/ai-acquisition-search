import { NextRequest, NextResponse } from "next/server";
import { analyzePage } from "@/lib/acquisition/analyze";
import { fetchPageSnapshot } from "@/lib/acquisition/fetch-url";
import { discoverAcquisitionSignals } from "@/lib/acquisition/search-web";\nimport { discoverSocialSignals } from "@/lib/acquisition/social-search";\nimport { discoverShopSignals } from "@/lib/acquisition/shop-search";

export const runtime="nodejs";

export async function POST(request:NextRequest){
  try{
    const body=await request.json();
    const url=typeof body?.url==="string"?body.url.trim():"";
    if(!url)return NextResponse.json({error:"商品・サービスURLを入力してください。"},{status:400});
    const source=await fetchPageSnapshot(url);
    const search=await discoverAcquisitionSignals({productName:source.productName||source.title,description:source.description,productSignals:source.productSignals,productCategory:source.productCategory});
    const productName=source.productName||source.title;\n    const socialSignals=await discoverSocialSignals(productName);\n    const shopSignals=await discoverShopSignals(productName);\n    const analysis=await analyzePage(source,{query:search.queries.join(" / "),results:search.results},socialSignals,shopSignals);
    return NextResponse.json({data:{source,analysis}});
  }catch(error){
    const message=error instanceof Error?error.message:"分析に失敗しました。";
    return NextResponse.json({error:message},{status:502});
  }
}
