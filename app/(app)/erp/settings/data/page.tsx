"use client";
import catalog from '@/lib/erp-system.json';
import {useL} from '@/lib/i18n';
export default function Data(){const L=useL(),f=catalog.features.find(f=>f.id==='settings/data')!;return <section className="row-card space-y-3"><h2 className="text-base font-semibold">{L(f.title)}</h2><p className="text-sm text-ink-500">{L({en:'Planned on ERP web and app. This module is not available yet.',hi:'ERP web / app: \u092f\u0939 \u092e\u0949\u0921\u094d\u092f\u0942\u0932 \u0905\u092d\u0940 \u0909\u092a\u0932\u092c\u094d\u0927 \u0928\u0939\u0940\u0902 \u0939\u0948\u0964'})}</p>{'features' in f&&<ul className="list-disc space-y-2 pl-5 text-sm">{f.features?.map((x,i)=><li key={i}>{L(x)}</li>)}</ul>}</section>;}
