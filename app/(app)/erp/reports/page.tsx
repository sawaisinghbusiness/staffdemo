"use client";
import Link from 'next/link';
import {ArrowRight} from 'lucide-react';
import catalog from '@/lib/erp-system.json';
import {useL} from '@/lib/i18n';
export default function Reports(){const L=useL();const ids=['fees/reports','attendance/register','exams/report-cards','staff/payroll','syllabus'];const reports=catalog.features.filter(f=>ids.includes(f.id));return <div className="space-y-4"><p className="text-sm text-ink-500">{L({en:'Fee, attendance, exam, payroll and syllabus reports.',hi:'फ़ीस, हाज़िरी, परीक्षा, सैलरी और पाठ्यक्रम की रिपोर्ट।'})}</p><ul className="divide-y divide-ink-100 overflow-hidden rounded-2xl border border-ink-200 bg-white">{reports.map(f=><li key={f.id}><Link href={f.app} className="flex min-h-[64px] items-center justify-between gap-3 px-4 py-3"><span><span className="block text-sm font-semibold">{L(f.title)}</span><span className="mt-1 block text-xs text-ink-500">{L(f.module)}</span></span><ArrowRight className="h-4 w-4"/></Link></li>)}</ul></div>;}
