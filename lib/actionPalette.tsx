"use client";
import { createContext, useContext } from "react";
/** Route-owned action styling flows through portals; assistant and driver opt out. */
export const ActionPalette = createContext(false);
export const useActionPalette = () => useContext(ActionPalette);
