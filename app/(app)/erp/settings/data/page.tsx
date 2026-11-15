"use client";
import catalog from '@/lib/erp-system.json';
import {useL} from '@/lib/i18n';
export default function Data(){const L=useL(),f=catalog.features.find(f=>f.id==='settings/data')!;return <section className="row-card space-y-3"><h2 className="text-base font-semibold">{L(f.title)}</h2><p className="text-sm text-ink-500">{L({en:'These tools are planned and are not available yet.',hi:'ये सुविधाएँ नियोजित हैं और अभी उपलब्ध नहीं हैं।'})}</p>{'features' in f&&<ul className="list-disc space-y-2 pl-5 text-sm">{f.features?.map((x,i)=><li key={i}>{L(x)}</li>)}</ul>}</section>;}
