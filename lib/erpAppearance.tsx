"use client";
import { createContext, useContext } from "react";
/** Appearance follows React ownership through portals; never infers a role from styling. */
export const ErpAppearance = createContext(false);
export const useErpAppearance = () => useContext(ErpAppearance);
