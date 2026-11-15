import {Settings2,Video,Award,FileQuestion,Library,BedDouble,Package,DoorOpen,HeartPulse,MessageSquareWarning,GraduationCap,Fingerprint,type LucideIcon} from 'lucide-react';
import type{Bi}from './i18n';
import catalog from './erp-system.json';
export interface SoonModule{key:string;icon:LucideIcon;text:Bi;lines:Bi[]}
const ICONS:Record<string,LucideIcon>={Settings2,Video,Award,FileQuestion,Library,BedDouble,Package,DoorOpen,HeartPulse,MessageSquareWarning,GraduationCap,Fingerprint};
export const SOON_MODULES:SoonModule[]=catalog.features.filter(f=>f.status==='planned').map(f=>({key:f.id.split('/').at(-1)!,icon:ICONS[f.icon],text:f.title,lines:'features' in f?f.features||[]:[]}));
