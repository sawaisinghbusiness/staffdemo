import { api } from "@/lib/api";
export interface TransportSnapshot {
  date:string; asOf:string; routes:{routeId:string;routeName:string;vehicleNo:string|null;driverName:string|null;driverPhone:string|null;students:number;stopsTotal:number;trip:null|{id:string;kind:"morning"|"afternoon";state:"running"|"completed";startedAt:string;endedAt:string|null;nextStop:string|null;stopsDone:number;childrenMarked:number;locationStatus:"inactive"|"waiting"|"stale"|"fresh";at:string|null;position:{lat:number;lng:number}|null;delay:{reason:string;minutes:number;at:string}|null}}[];
}
export async function loadTransportLive():Promise<TransportSnapshot>{return api<TransportSnapshot>("/erp/transport/live");}
