import {Home,LayoutDashboard,Users,IndianRupee,CalendarCheck,MessageSquareText,CalendarClock,MessagesSquare,CalendarDays,Cake,Trophy,Table2,NotebookPen,ListChecks,ClipboardCheck,Briefcase,Bus,Settings2,Video,Award,FileQuestion,Library,BedDouble,Package,DoorOpen,HeartPulse,MessageSquareWarning,GraduationCap,Fingerprint,type LucideIcon} from 'lucide-react';
import type {Bi} from './i18n';
import catalog from './erp-system.json';
export interface ErpSub{text:Bi;href:string;soon?:boolean}
export interface ErpItem{text:Bi;icon:LucideIcon;href?:string;soon?:boolean;preview?:boolean;children?:ErpSub[]}
export interface ErpGroup{title:Bi|null;items:ErpItem[]}

const ICONS:Record<string,LucideIcon>={Home,LayoutDashboard,Users,IndianRupee,CalendarCheck,MessageSquareText,CalendarClock,MessagesSquare,CalendarDays,Cake,Trophy,Table2,NotebookPen,ListChecks,ClipboardCheck,Briefcase,Bus,Settings2,Video,Award,FileQuestion,Library,BedDouble,Package,DoorOpen,HeartPulse,MessageSquareWarning,GraduationCap,Fingerprint};
const reports=catalog.features.filter(f=>f.module.en==='Report');
export const ERP_MENU:ErpGroup[]=[{title:null,items:[{text:{hi:'\u0939\u094b\u092e',en:'Home'},icon:Home,href:'/'},{text:{hi:'\u0930\u093f\u092a\u094b\u0930\u094d\u091f',en:'Report'},icon:LayoutDashboard,children:[{text:{hi:'\u0938\u093e\u0930',en:'Overview'},href:'/erp/report/'},...reports.map(f=>({text:f.title,href:f.app}))]}]}];
export const ERP_SETTINGS:ErpItem={text:{hi:'\u0938\u0947\u091f\u093f\u0902\u0917',en:'Settings'},icon:Settings2,children:catalog.features.filter(f=>f.module.en==='Settings').map(f=>({text:f.title,href:f.app,soon:f.status==='planned'}))};
for(const f of catalog.features){if(f.module.en==='Settings'||f.module.en==='Report')continue;let group=ERP_MENU.find(g=>g.title?.en===f.group.en);if(!group){group={title:f.group,items:[]};ERP_MENU.push(group);}if(f.status==='planned'){group.items.push({text:f.title,icon:ICONS[f.icon]||LayoutDashboard,href:f.app,preview:true});continue;}let item=group.items.find(i=>i.text.en===f.module.en);if(!item){item={text:f.module,icon:ICONS[f.icon]||LayoutDashboard,children:[]};group.items.push(item);}item.children!.push({text:f.title,href:f.app});}
for(const g of ERP_MENU)for(const item of g.items)if(item.children?.length===1&&item.children[0].text.en===item.text.en){item.href=item.children[0].href;delete item.children;}
