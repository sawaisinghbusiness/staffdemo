"use client";
import { useCallback, useEffect, useRef, useState } from "react";
export interface ErpSession { code:string; label:string; start:string; end:string }
export function validSession(value:unknown): value is ErpSession { const s=value as ErpSession|null; return !!s && typeof s.code==="string" && !!s.code && typeof s.label==="string" && !!s.label && /^\d{4}-\d{2}-\d{2}$/.test(s.start) && /^\d{4}-\d{2}-\d{2}$/.test(s.end) && !Number.isNaN(Date.parse(s.start)) && !Number.isNaN(Date.parse(s.end)) && new Date(s.start).toISOString().slice(0,10)===s.start && new Date(s.end).toISOString().slice(0,10)===s.end && s.start<=s.end; }
import { api } from "@/lib/api";
export function useErpSession(){
 const [session,setSession]=useState<ErpSession|null>(null);const [error,setError]=useState<string|null>(null);const [loading,setLoading]=useState(true);const request=useRef(0);
 const reload=useCallback(async()=>{const id=++request.current;setLoading(true);try{const body=await api<{session:unknown}>("/erp/school/session"); if(!validSession(body?.session))throw Error("The school academic session is not configured.");if(id===request.current){setSession(body.session);setError(null);}}catch(e){if(id===request.current){setSession(null);setError(e instanceof Error?e.message:"Academic session is unavailable.");}}finally{if(id===request.current)setLoading(false);}},[]);
 useEffect(()=>{void reload();return()=>{request.current++;};},[reload]);return {session,error,loading,reload};
}
